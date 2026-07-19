import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/libs/mongodb";
import Order from "@/models/order";
import User from "@/models/User";
import { getUserFromRequest } from "@/libs/auth";
import { serverBroadcast, ADMIN_NOTIFICATIONS_CHANNEL } from "@/libs/broadcast";
import { generateTrackingNumber } from "@/libs/tracking";
import { haversineDistanceKm, calculatePrice } from "@/libs/pricing";
import { estimateTransitDurationMs } from "@/libs/eta";
import { sendMail, getOrderCreatedEmail, getAdminNewOrderEmail } from "@/libs/mailer";
import { z } from "zod";

// Referencing User here (even trivially) prevents production bundlers
// from tree-shaking this import, which would otherwise silently drop
// the mongoose.model("User", ...) registration and break populate().
void User;

const locationSchema = z.object({
  address: z.string().min(1),
  city: z.string().min(1),
  country: z.string().min(1).default("Nigeria"),
  lat: z.number(),
  lng: z.number(),
});

const createOrderSchema = z.object({
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
  paymentMethod: z.enum(["bank_transfer", "paystack"]),
});

// Service types where payment is negotiated directly on WhatsApp instead
// of being calculated automatically — no price is computed or stored.
const WHATSAPP_PRICED_TYPES = new Set(["local", "interstate"]);

export async function GET(req: NextRequest) {
  const auth = getUserFromRequest(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  let filter = {};
  if (auth.role === "customer") {
    filter = { customer: auth.userId };
  } else if (auth.role === "driver") {
    filter = { driver: auth.userId };
  }

  const orders = await Order.find(filter)
    .populate("customer", "name phone email")
    .populate("driver", "name phone")
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json({ orders });
}

async function createUniqueTrackingNumber(originCity: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateTrackingNumber(originCity);
    const existing = await Order.findOne({ trackingNumber: candidate }).lean();
    if (!existing) return candidate;
  }
  throw new Error("Could not generate a unique tracking number");
}

export async function POST(req: NextRequest) {
  try {
    const auth = getUserFromRequest(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (auth.role !== "customer") {
      return NextResponse.json(
        { error: "Only customers can create orders" },
        { status: 403 }
      );
    }

    await connectDB();

    const body = await req.json();
    const parsed = createOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const { pickup, dropoff, serviceType, packageSize, weightKg } = parsed.data;

    const isInternational =
      pickup.country.trim().toLowerCase() !== dropoff.country.trim().toLowerCase();

    const finalServiceType =
      isInternational && serviceType === "local" ? "international" : serviceType;

    if (finalServiceType === "international" && !weightKg) {
      return NextResponse.json(
        { error: "Package weight (kg) is required for international shipments" },
        { status: 400 }
      );
    }

    const trackingNumber = await createUniqueTrackingNumber(pickup.city);

    const distanceKm = haversineDistanceKm(
      pickup.lat,
      pickup.lng,
      dropoff.lat,
      dropoff.lng
    );

    // Local/interstate orders skip automatic pricing entirely — payment
    // amount is communicated directly to the customer on WhatsApp.
    const price = WHATSAPP_PRICED_TYPES.has(finalServiceType)
      ? undefined
      : calculatePrice({
          distanceKm,
          serviceType: finalServiceType,
          packageSize,
          weightKg,
          pickupCountry: pickup.country,
          dropoffCountry: dropoff.country,
          packageDescription: parsed.data.packageDescription,
        });

    const etaMs = estimateTransitDurationMs(distanceKm, finalServiceType);
    const eta = new Date(Date.now() + etaMs);

    const order = await Order.create({
      ...parsed.data,
      trackingNumber,
      isInternational,
      serviceType: finalServiceType,
      customer: auth.userId,
      status: "pending",
      statusHistory: [{ status: "pending", at: new Date() }],
      price,
      eta,
    });

    const populated = await Order.findById(order._id)
      .populate("customer", "name phone email")
      .lean();

    serverBroadcast(ADMIN_NOTIFICATIONS_CHANNEL, "new-order", populated);

    if (populated?.customer?.email) {
      try {
        const orderEmail = getOrderCreatedEmail(
          populated.customer.name,
          populated.trackingNumber,
          populated.eta ? new Date(populated.eta).toLocaleString() : undefined
        );
        await sendMail({
          to: populated.customer.email,
          subject: orderEmail.subject,
          html: orderEmail.html,
        });
      } catch (mailError) {
        console.error("Order confirmation email failed:", mailError);
      }
    }

    // Notify every admin by email that a new order needs review, so they
    // know to log in and confirm/assign a driver — separate from the
    // realtime dashboard bell notification above.
    try {
      const admins = await User.find({ role: "admin" }).select("email name").lean();
      const adminEmail = getAdminNewOrderEmail({
        trackingNumber: populated?.trackingNumber || trackingNumber,
        customerName: populated?.customer?.name || "Unknown customer",
        serviceType: finalServiceType,
        pickupCity: pickup.city,
        dropoffCity: dropoff.city,
      });
      await Promise.all(
        admins
          .filter((a) => a.email)
          .map((a) =>
            sendMail({
              to: a.email,
              subject: adminEmail.subject,
              html: adminEmail.html,
            }).catch((err) =>
              console.error(`Admin notification email to ${a.email} failed:`, err)
            )
          )
      );
    } catch (adminMailError) {
      console.error("Admin notification email lookup/send failed:", adminMailError);
    }

    return NextResponse.json({ order: populated }, { status: 201 });
  } catch (error) {
    console.error("Order creation failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Something went wrong while creating the order",
      },
      { status: 500 }
    );
  }
}