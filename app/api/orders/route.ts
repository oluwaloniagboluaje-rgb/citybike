import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/libs/mongodb";
import Order from "@/models/order";
import "@/models/User";
import { getUserFromRequest } from "@/libs/auth";
import { serverBroadcast, ADMIN_NOTIFICATIONS_CHANNEL } from "@/libs/broadcast";
import { generateTrackingNumber } from "@/libs/tracking";
import { z } from "zod";

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
  recipientName: z.string().min(1),
  recipientPhone: z.string().min(1),
});

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
  // admin sees everything

  const orders = await Order.find(filter)
    .populate("customer", "name phone email")
    .populate("driver", "name phone")
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json({ orders });
}

async function createUniqueTrackingNumber(originCity: string): Promise<string> {
  // Extremely unlikely to collide, but guard against it anyway since the
  // field has a unique index.
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

    const { pickup, dropoff, serviceType } = parsed.data;

    const isInternational =
      pickup.country.trim().toLowerCase() !== dropoff.country.trim().toLowerCase();

    const trackingNumber = await createUniqueTrackingNumber(pickup.city);

    const order = await Order.create({
      ...parsed.data,
      trackingNumber,
      isInternational,
      serviceType:
        isInternational && serviceType === "local" ? "international" : serviceType,
      customer: auth.userId,
      status: "pending",
      statusHistory: [{ status: "pending", at: new Date() }],
    });

    const populated = await Order.findById(order._id)
      .populate("customer", "name phone email")
      .lean();

    serverBroadcast(ADMIN_NOTIFICATIONS_CHANNEL, "new-order", populated);

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