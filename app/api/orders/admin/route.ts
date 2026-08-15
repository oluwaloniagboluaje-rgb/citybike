import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/libs/mongodb";
import Order from "@/models/order";
import User from "@/models/User";
import {
  getUserFromRequest,
  hashPassword,
  generateResetToken,
  hashResetToken,
  RESET_TOKEN_EXPIRY_MS,
} from "@/libs/auth";
import {
  serverBroadcast,
  ADMIN_NOTIFICATIONS_CHANNEL,
} from "@/libs/broadcast";
import {
  sendMail,
  getOrderCreatedEmail,
  getPasswordResetEmail,
  getWelcomeEmail,
} from "@/libs/mailer";
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
  state: z.string().optional(),
  postalCode: z.string().optional(),
  lat: z.number(),
  lng: z.number(),
});

const adminCreateSchema = z.object({
  senderName: z.string().optional(),
  senderPhone: z.string().optional(),

  // Optional: link to existing customer by id or email
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

  /**
   * Examples:
   * +234
   * 234
   * +44
   * 44
   * +1
   */
  recipientPhoneCode: z.string().optional(),

  paymentMethod: z.enum(["bank_transfer", "cash"]).default("cash"),
});

async function createUniqueTrackingNumber(
  originCity: string
): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateTrackingNumber(originCity);

    const existing = await Order.findOne({
      trackingNumber: candidate,
    }).lean();

    if (!existing) {
      return candidate;
    }
  }

  throw new Error("Could not generate a unique tracking number");
}

/**
 * Convert a phone number + optional country code into E.164 format.
 *
 * Examples:
 *
 *   code: +44
 *   phone: 07123456789
 *   => +447123456789
 *
 *   code: 44
 *   phone: 07123456789
 *   => +447123456789
 *
 *   code: +44
 *   phone: +447123456789
 *   => +447123456789
 *
 *   code: +234
 *   phone: 08012345678
 *   => +2348012345678
 *
 *   code: +234
 *   phone: 2348012345678
 *   => +2348012345678
 *
 *   phone: +447123456789
 *   => +447123456789
 */
function normalizePhoneNumber(
  phone?: string | null,
  countryCode?: string | null
): string | null {
  if (!phone) {
    return null;
  }

  let cleanPhone = phone.trim();

  if (!cleanPhone) {
    return null;
  }

  let cleanCode = countryCode?.trim() || "";

  // Remove spaces, brackets, hyphens and other formatting characters.
  cleanPhone = cleanPhone.replace(/[^\d+]/g, "");
  cleanCode = cleanCode.replace(/[^\d+]/g, "");

  // If the phone itself already starts with +,
  // it is already an international number.
  if (cleanPhone.startsWith("+")) {
    return cleanPhone;
  }

  // Normalize country code to +XXXXXXXX.
  if (cleanCode) {
    if (!cleanCode.startsWith("+")) {
      cleanCode = `+${cleanCode}`;
    }

    // Remove accidental duplicate + signs.
    cleanCode = `+${cleanCode.replace(/\+/g, "")}`;

    // If phone was entered as 447123456789 while code is +44,
    // don't produce +44447123456789.
    const numericCode = cleanCode.slice(1);

    if (cleanPhone.startsWith(numericCode)) {
      return `+${cleanPhone}`;
    }

    // Most international numbers are entered locally with a leading 0.
    // Remove that zero before attaching the country code.
    if (cleanPhone.startsWith("0")) {
      cleanPhone = cleanPhone.substring(1);
    }

    return `${cleanCode}${cleanPhone}`;
  }

  // No country code was supplied.
  //
  // If it begins with 00, convert international dialing format:
  // 00447123456789 -> +447123456789
  if (cleanPhone.startsWith("00")) {
    return `+${cleanPhone.substring(2)}`;
  }

  // If no country code is available, return the cleaned number.
  // This is still useful for Nigerian numbers already stored as +234...
  return cleanPhone;
}

/**
 * Build a public tracking URL.
 *
 * We don't extract this from email HTML because that is fragile.
 */
function getTrackingUrl(
  req: NextRequest,
  trackingNumber: string
): string {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    `${req.nextUrl.protocol}//${req.nextUrl.host}`;

  return `${baseUrl}/track?tracking=${encodeURIComponent(
    trackingNumber
  )}`;
}

export async function POST(req: NextRequest) {
  try {
    const auth = getUserFromRequest(req);

    if (!auth) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (auth.role !== "admin") {
      return NextResponse.json(
        { error: "Only admins may create orders here" },
        { status: 403 }
      );
    }

    await connectDB();

    const body = await req.json();

    const parsed = adminCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ||
            "Invalid input",
        },
        { status: 400 }
      );
    }

    const {
      pickup,
      dropoff,
      customerId,
      customerEmail,
    } = parsed.data;

    /*
     * ------------------------------------------------------------
     * Resolve customer
     * ------------------------------------------------------------
     */

    let linkedCustomerId: string | undefined = undefined;

    try {
      if (customerId) {
        const mongoose = require("mongoose");

        if (mongoose.Types.ObjectId.isValid(customerId)) {
          const user = await User.findById(customerId)
            .select("_id name email phone")
            .lean();

          if (user) {
            linkedCustomerId = user._id.toString();
          }
        }
      } else if (customerEmail) {
        const emailNorm = customerEmail
          .trim()
          .toLowerCase();

        const user = await User.findOne({
          email: emailNorm,
        })
          .select("_id name email phone")
          .lean();

        if (user) {
          linkedCustomerId = user._id.toString();
        } else {
          /*
           * --------------------------------------------------------
           * Automatically create customer account
           * --------------------------------------------------------
           */

          const name =
            parsed.data.recipientName ||
            emailNorm.split("@")[0] ||
            "Customer";

          const phone =
            parsed.data.recipientPhone ||
            parsed.data.senderPhone ||
            "0000000000";

          try {
            const rawPassword = Math.random()
              .toString(36)
              .slice(2, 10);

            const passwordHash =
              await hashPassword(rawPassword);

            const newUser = await User.create({
              name,
              email: emailNorm,
              password: passwordHash,
              phone,
              role: "customer",
            });

            linkedCustomerId = newUser._id.toString();

            /*
             * Create password reset token so the customer
             * can set their own password.
             */

            const rawToken = generateResetToken();

            newUser.resetPasswordTokenHash =
              hashResetToken(rawToken);

            newUser.resetPasswordExpires = new Date(
              Date.now() + RESET_TOKEN_EXPIRY_MS
            );

            await newUser.save();

            const baseUrl =
              process.env.NEXT_PUBLIC_APP_URL ||
              `${req.nextUrl.protocol}//${req.nextUrl.host}`;

            const resetUrl =
              `${baseUrl}/reset-password?token=${rawToken}` +
              `&email=${encodeURIComponent(newUser.email)}`;

            try {
              const welcome = getWelcomeEmail(
                newUser.name,
                "customer"
              );

              await sendMail({
                to: newUser.email,
                subject: welcome.subject,
                html: welcome.html,
              });

              const resetEmail =
                getPasswordResetEmail(
                  newUser.name,
                  resetUrl
                );

              await sendMail({
                to: newUser.email,
                subject: resetEmail.subject,
                html: resetEmail.html,
              });
            } catch (mailErr) {
              console.error(
                "New user welcome/reset mail failed:",
                mailErr
              );
            }
          } catch (createErr) {
            console.error(
              "Auto-create user failed:",
              createErr
            );
          }
        }
      }
    } catch (err) {
      console.error(
        "Customer link lookup failed:",
        err
      );
    }

    /*
     * ------------------------------------------------------------
     * Determine international shipment
     * ------------------------------------------------------------
     */

    const isInternational =
      pickup.country.trim().toLowerCase() !==
      dropoff.country.trim().toLowerCase();

    const finalServiceType =
      isInternational &&
      parsed.data.serviceType === "local"
        ? "international"
        : parsed.data.serviceType;

    /*
     * ------------------------------------------------------------
     * Tracking number
     * ------------------------------------------------------------
     */

    const trackingNumber =
      await createUniqueTrackingNumber(pickup.city);

    /*
     * ------------------------------------------------------------
     * Normalize recipient phone
     *
     * This is the important fix for international numbers.
     * ------------------------------------------------------------
     */

    const normalizedRecipientPhone =
      normalizePhoneNumber(
        parsed.data.recipientPhone,
        parsed.data.recipientPhoneCode
      );

    if (!normalizedRecipientPhone) {
      return NextResponse.json(
        {
          error:
            "A valid recipient phone number is required",
        },
        { status: 400 }
      );
    }

    /*
     * ------------------------------------------------------------
     * Normalize sender phone too, when available.
     * ------------------------------------------------------------
     */

    const normalizedSenderPhone =
      parsed.data.senderPhone
        ? normalizePhoneNumber(
            parsed.data.senderPhone,
            // Sender phone doesn't currently have a separate
            // sender country-code field, so leave its prefix alone.
            undefined
          )
        : undefined;

    /*
     * ------------------------------------------------------------
     * Create order
     * ------------------------------------------------------------
     */

    const order = await Order.create({
      ...parsed.data,

      // Store the clean E.164 recipient number.
      recipientPhone: normalizedRecipientPhone,

      // Store normalized sender number when supplied.
      ...(normalizedSenderPhone
        ? {
            senderPhone: normalizedSenderPhone,
          }
        : {}),

      trackingNumber,

      isInternational,

      serviceType: finalServiceType,

      customer: linkedCustomerId,

      isAdminCreated: true,

      status: "shipment_created",

      statusHistory: [
        {
          status: "shipment_created",
          at: new Date(),
        },
      ],
    });

    /*
     * ------------------------------------------------------------
     * Populate customer
     * ------------------------------------------------------------
     */

    const populated = await Order.findById(order._id)
      .populate(
        "customer",
        "name phone email"
      )
      .lean();

    if (!populated) {
      return NextResponse.json(
        { error: "Order was created but could not be loaded" },
        { status: 500 }
      );
    }

    /*
     * ------------------------------------------------------------
     * Notify admins via realtime channel
     * ------------------------------------------------------------
     */

    serverBroadcast(
      ADMIN_NOTIFICATIONS_CHANNEL,
      "new-order",
      populated
    );

    /*
     * ------------------------------------------------------------
     * Customer email notification
     * ------------------------------------------------------------
     */

    const recipientEmail =
      populated?.customer?.email ||
      (customerEmail
        ? customerEmail.trim().toLowerCase()
        : undefined);

    if (
      recipientEmail &&
      parsed.data.notifyByEmail !== false
    ) {
      try {
        const name =
          populated?.customer?.name ||
          parsed.data.recipientName ||
          "Customer";

        const orderEmail =
          getOrderCreatedEmail(
            name,
            populated.trackingNumber,
            populated.eta
              ? new Date(
                  populated.eta
                ).toLocaleString()
              : undefined
          );

        await sendMail({
          to: recipientEmail,
          subject: orderEmail.subject,
          html: orderEmail.html,
        });
      } catch (mailError) {
        console.error(
          "Order created email failed:",
          mailError
        );
      }
    }

    /*
     * ------------------------------------------------------------
     * SMS / WhatsApp notification
     * ------------------------------------------------------------
     *
     * IMPORTANT:
     * We now ALWAYS use the normalized E.164 phone number.
     *
     * Example:
     *
     * recipientPhoneCode = "+44"
     * recipientPhone     = "07123456789"
     *
     * becomes:
     *
     * "+447123456789"
     *
     * This is the format expected by most SMS/WhatsApp providers.
     * ------------------------------------------------------------
     */

    if (parsed.data.notifyBySms) {
      try {
        const customerPhone =
          populated?.customer?.phone;

        /*
         * Priority:
         *
         * 1. recipient phone + recipient country code
         * 2. customer account phone
         * 3. sender phone
         */

        const notificationPhone =
          normalizedRecipientPhone ||
          normalizePhoneNumber(customerPhone) ||
          normalizedSenderPhone;

        if (!notificationPhone) {
          console.warn(
            "No valid phone number available for notification"
          );
        } else {
          const trackingUrl =
            getTrackingUrl(
              req,
              populated.trackingNumber
            );

          const text =
            `Your shipment has been created.\n\n` +
            `Tracking Number: ${populated.trackingNumber}\n\n` +
            `Track your shipment here:\n${trackingUrl}`;

          /*
           * Send SMS.
           *
           * The number is already normalized:
           * +447123456789
           */

          try {
            await sendSms(
              notificationPhone,
              text
            );
          } catch (smsError) {
            console.error(
              "SMS notification failed:",
              smsError
            );
          }

          /*
           * Send WhatsApp using the SAME normalized
           * international number.
           */

          try {
            await sendWhatsApp(
              notificationPhone,
              text
            );
          } catch (whatsappError) {
            console.error(
              "WhatsApp notification failed:",
              whatsappError
            );
          }
        }
      } catch (notifyErr) {
        console.error(
          "Notification processing failed:",
          notifyErr
        );
      }
    }

    /*
     * ------------------------------------------------------------
     * Broadcast initial status for tracking clients
     * ------------------------------------------------------------
     */

    try {
      await serverBroadcast(
        orderStatusChannel(
          order._id.toString()
        ),
        "status-update",
        populated
      );
    } catch (err) {
      console.error(
        "Status broadcast failed:",
        err
      );
    }

    /*
     * ------------------------------------------------------------
     * Return created order
     * ------------------------------------------------------------
     */

    return NextResponse.json(
      { order: populated },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "Admin order creation failed:",
      error
    );

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