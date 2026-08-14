import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/libs/mongodb";
import Order from "@/models/order";
import { getUserFromRequest } from "@/libs/auth";
import { z } from "zod";

const locationSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = getUserFromRequest(req);
  if (!auth || auth.role !== "driver") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectDB();
  const { id } = await params;

  const body = await req.json();
  const parsed = locationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
  }

  const order = await Order.findById(id);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.driver?.toString() !== auth.userId) {
    return NextResponse.json(
      { error: "You are not assigned to this order" },
      { status: 403 }
    );
  }

  order.lastLocation = {
    lat: parsed.data.lat,
    lng: parsed.data.lng,
    updatedAt: new Date(),
  };
  await order.save();

  return NextResponse.json({ success: true });
}