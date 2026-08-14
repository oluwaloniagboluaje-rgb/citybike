import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/libs/mongodb";
import Order from "@/models/order";
import User from "@/models/User";
import { getUserFromRequest, hashPassword, generateResetToken, hashResetToken, RESET_TOKEN_EXPIRY_MS } from "@/libs/auth";
import { serverBroadcast, ADMIN_NOTIFICATIONS_CHANNEL } from "@/libs/broadcast";
import { sendMail, getOrderCreatedEmail, getPasswordResetEmail, getWelcomeEmail } from "@/libs/mailer";
import { sendSms, sendWhatsApp } from "@/libs/notify";
import { orderStatusChannel } from "@/libs/supabaseClient";
import { generateTrackingNumber } from "@/libs/tracking";
import { z } from "zod";

// Referencing User ensures mongoose model registration for populate().
void User;

const locationSchema = z.object({
  address: z.string().min(1),
  city: z.string().min(1),
  country: z.string().min(1).default("Nigeria"),
  lat: z.number(),
  lng: z.number(),
});

const adminCreateSchema = z.object({
  senderName: z.string().optional(),
  senderPhone: z.string().optional(),
  // Optional: link to existing customer by id or email so order appears in their account
  customerId: z.string().optional(),
  customerEmail: z.string().email().optional(),
  notifyByEmail: z.boolean().optional(),
  notifyBySms: z.boolean().optional(),
  pickup: locationSchema,
  dropoff: locationSchema,
  serviceType: z
    .enum([
      "local",
      "interstate",
      "international",
      "dhl_express",
      "ecommerce",
      "errand",
      "corporate",
    ])
    .default("local"),
  packageDescription: z.string().min(1),
  packageSize: z.enum(["small", "medium", "large"]).default("small"),
  weightKg: z.number().positive().optional(),
  recipientName: z.string().min(1),
  recipientPhone: z.string().min(1),
  paymentMethod: z.enum(["bank_transfer", "cash"]).default("cash"),
});

async function createUniqueTrackingNumber(originCity: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateTrackingNumber(originCity);
    const existing = await Order.findOne({ trackingNumber: candidate }).lean();
    if (!existing) return candidate;
  }
  throw new Error("Could not generate a unique tracking number");
}

export async function POST(req: NextRequest) {
  const auth = getUserFromRequest(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (auth.role !== "admin") {
    return NextResponse.json({ error: "Only admins may create orders here" }, { status: 403 });
  }

  await connectDB();

  const body = await req.json();
  const parsed = adminCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
  }

  const { pickup, dropoff, customerId, customerEmail } = parsed.data;

  // Attempt to resolve customer by id or email so the order appears in their account
  let linkedCustomerId: string | undefined = undefined;
  try {
    if (customerId) {
      // validate and find
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mongoose = require("mongoose");
      if (mongoose.Types.ObjectId.isValid(customerId)) {
        const u = await User.findById(customerId).select("_id name email").lean();
        if (u) linkedCustomerId = u._id.toString();
      }
    } else if (customerEmail) {
      const emailNorm = customerEmail.trim().toLowerCase();
      const u = await User.findOne({ email: emailNorm }).select("_id name email phone").lean();
      if (u) linkedCustomerId = u._id.toString();
      else {
        // Auto-create a lightweight customer record so the admin-created
        // order appears in their account. Use available phones or a placeholder.
        const name = parsed.data.recipientName || emailNorm.split("@")[0] || "Customer";
        const phone = parsed.data.recipientPhone || parsed.data.senderPhone || "0000000000";
        try {
          const rawPassword = Math.random().toString(36).slice(2, 10);
          const passwordHash = await hashPassword(rawPassword);
          const newUser = await User.create({ name, email: emailNorm, password: passwordHash, phone, role: "customer" });
          linkedCustomerId = newUser._id.toString();

          // Create a reset token so the user can set their own password securely
          const rawToken = generateResetToken();
          newUser.resetPasswordTokenHash = hashResetToken(rawToken);
          newUser.resetPasswordExpires = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);
          await newUser.save();

          // Send welcome + reset email so they can set their password
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
          const resetUrl = `${baseUrl}/reset-password?token=${rawToken}&email=${encodeURIComponent(newUser.email)}`;
          try {
            const welcome = getWelcomeEmail(newUser.name, "customer");
            await sendMail({ to: newUser.email, subject: welcome.subject, html: welcome.html });
            const resetEmail = getPasswordResetEmail(newUser.name, resetUrl);
            await sendMail({ to: newUser.email, subject: resetEmail.subject, html: resetEmail.html });
          } catch (mailErr) {
            console.error("new user mail/send failed", mailErr);
          }
        } catch (createErr) {
          console.error("auto-create user failed", createErr);
        }
      }
    }
  } catch (err) {
    console.error("Customer link lookup failed", err);
  }

  const isInternational = pickup.country.trim().toLowerCase() !== dropoff.country.trim().toLowerCase();

  const trackingNumber = await createUniqueTrackingNumber(pickup.city);

  const order = await Order.create({
    ...parsed.data,
    trackingNumber,
    isInternational,
    serviceType: isInternational && parsed.data.serviceType === "local" ? "international" : parsed.data.serviceType,
    customer: linkedCustomerId,
    isAdminCreated: true,
    status: "shipment_created",
    statusHistory: [{ status: "shipment_created", at: new Date() }],
  });

  const populated = await Order.findById(order._id)
    .populate("customer", "name phone email")
    .lean();

  // Notify admins via realtime channel
  serverBroadcast(ADMIN_NOTIFICATIONS_CHANNEL, "new-order", populated);

  // If the order is linked to a registered customer, or an admin supplied
  // a recipient email, and the admin requested email notifications, send the order-created email so they can track it.
  const recipientEmail = populated?.customer?.email || (customerEmail ? customerEmail.trim().toLowerCase() : undefined);

  if (recipientEmail && parsed.data.notifyByEmail !== false) {
    try {
      const name = populated?.customer?.name || parsed.data.recipientName || "Customer";
      const orderEmail = getOrderCreatedEmail(
        name,
        populated.trackingNumber,
        populated.eta ? new Date(populated.eta).toLocaleString() : undefined
      );
      await sendMail({
        to: recipientEmail,
        subject: orderEmail.subject,
        html: orderEmail.html,
      });
    } catch (mailError) {
      console.error("Order created email failed:", mailError);
    }
  }

  // Also send SMS/WhatsApp to the recipient phone with tracking link when available
  if (parsed.data.notifyBySms) {
    try {
      const phone = populated?.customer?.phone || parsed.data.recipientPhone || parsed.data.senderPhone;
      const trackingUrl = getOrderCreatedEmail(populated?.customer?.name || parsed.data.recipientName || "Customer", populated.trackingNumber).html.match(/href="([^"]+)"/)?.[1];
      if (phone && trackingUrl) {
        const text = `Your shipment is created. Track it here: ${trackingUrl}`;
        // prefer SMS then WhatsApp; both are best-effort
        await sendSms(phone, text);
        await sendWhatsApp(phone, text);
      }
    } catch (notifyErr) {
      console.error("notify send failed", notifyErr);
    }
  }

  // Broadcast initial status for any tracking clients
  try {
    await serverBroadcast(orderStatusChannel(order._id.toString()), "status-update", populated);
  } catch (err) {
    console.error("Broadcast failed", err);
  }

  return NextResponse.json({ order: populated }, { status: 201 });
}
