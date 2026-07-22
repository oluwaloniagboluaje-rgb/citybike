import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/libs/mongodb";
import Order from "@/models/order";
import User from "@/models/User";
import { getUserFromRequest } from "@/libs/auth";
import { generateTrackingNumber } from "@/libs/tracking";
import { haversineDistanceKm, calculatePrice } from "@/libs/pricing";
import { estimateTransitDurationMs } from "@/libs/eta";
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

const createAdminOrderSchema = z.object({
  senderName: z.string().min(1, "Sender name is required"),
  senderPhone: z.string().min(1, "Sender phone is required"),
  pickup: locationSchema,
  dropoff: locationSchema,
  serviceType: z.enum([
    "local",
    "interstate",
    "international",
    "dhl_express",
    "ecommerce",
    "errand",
    "corporate",
  ]),
  packageDescription: z.string().min(1),
  packageSize: z.enum(["small", "medium", "large"]).default("small"),
  weightKg: z.number().positive().optional(),
  recipientName: z.string().min(1),
  recipientPhone: z.string().min(1),
  paymentMethod: z.enum(["bank_transfer", "cash"]),
});

const WHATSAPP_PRICED_TYPES = new Set(["local", "interstate"]);
const NO_AUTO_ETA_TYPES = new Set(["interstate"]);

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
    if (auth.role !== "admin") {
      return NextResponse.json(
        { error: "Only admins can create orders this way" },
        { status: 403 }
      );
    }

    await connectDB();

    const body = await req.json();
    const parsed = createAdminOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const {
      pickup,
      dropoff,
      serviceType,
      packageSize,
      weightKg,
      paymentMethod,
    } = parsed.data;

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

    const eta = NO_AUTO_ETA_TYPES.has(finalServiceType)
      ? undefined
      : new Date(Date.now() + estimateTransitDurationMs(distanceKm, finalServiceType));

    // Cash payments are recorded as already collected in person; bank
    // transfer starts pending, same as the regular customer flow, so the
    // admin can mark it paid later once confirmed.
    const paymentStatus = paymentMethod === "cash" ? "paid" : "pending";

    const order = await Order.create({
      ...parsed.data,
      trackingNumber,
      isInternational,
      serviceType: finalServiceType,
      // No registered customer account — this order was created directly
      // by an admin on behalf of a walk-in client.
      customer: undefined,
      isAdminCreated: true,
      status: "confirmed",
      statusHistory: [
        { status: "pending", at: new Date() },
        { status: "confirmed", at: new Date() },
      ],
      price,
      eta,
      paymentStatus,
    });

    const populated = await Order.findById(order._id)
      .populate("driver", "name phone")
      .lean();

    return NextResponse.json({ order: populated }, { status: 201 });
  } catch (error) {
    console.error("Admin order creation failed", error);
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