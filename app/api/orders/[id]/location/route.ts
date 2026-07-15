import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/libs/mongodb";
import Order from "@/models/order";
import { getUserFromRequest } from "@/libs/auth";
import { z } from "zod";

const locationUpdateSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = getUserFromRequest(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const { id } = await params;

  const order = await Order.findById(id).select("lastLocation").lean();
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json({ lastLocation: order.lastLocation || null });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = getUserFromRequest(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (auth.role !== "driver") {
    return NextResponse.json(
      { error: "Only drivers can update location" },
      { status: 403 }
    );
  }

  await connectDB();
  const { id } = await params;

  const body = await req.json();
  const parsed = locationUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid input" },
      { status: 400 }
    );
  }

  const order = await Order.findById(id);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.driver?.toString() !== auth.userId) {
    return NextResponse.json(
      { error: "This order is not assigned to you" },
      { status: 403 }
    );
  }

  const locationEntry = {
    lat: parsed.data.lat,
    lng: parsed.data.lng,
    updatedAt: new Date(),
  };

  order.lastLocation = locationEntry;
  order.locationHistory = [
    ...(order.locationHistory ?? []),
    locationEntry,
  ];

  await order.save();

  return NextResponse.json({ lastLocation: order.lastLocation });
}