import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/libs/mongodb";
import Order from "@/models/order";
import { getUserFromRequest } from "@/libs/auth";
import { DHLStatus } from "@/types";
import { z } from "zod";

const dhlStatusSchema = z.object({
  status: z.enum([
    "shipment_picked_up",
    "in_transit",
    "out_for_delivery",
    "delivered",
    "failed_delivery_attempt",
    "returned",
    "customs_cleared",
    "exception",
  ] as const),
  description: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = getUserFromRequest(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (auth.role !== "admin") {
    return NextResponse.json(
      { error: "Only admins can update DHL tracking status" },
      { status: 403 }
    );
  }

  await connectDB();
  const { id } = await params;

  const body = await req.json();
  const parsed = dhlStatusSchema.safeParse(body);
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

  if (!order.externalTrackingNumber || order.carrierName !== "DHL") {
    return NextResponse.json(
      { error: "This order does not have a DHL tracking number assigned" },
      { status: 400 }
    );
  }

  // Initialize dhlStatusHistory if it doesn't exist
  if (!order.dhlStatusHistory) {
    order.dhlStatusHistory = [];
  }

  // Add the new status to the history
  order.dhlStatusHistory.push({
    status: parsed.data.status as DHLStatus,
    at: new Date(),
    description: parsed.data.description,
  });

  await order.save();

  return NextResponse.json({
    externalTrackingNumber: order.externalTrackingNumber,
    carrierName: order.carrierName,
    dhlStatusHistory: order.dhlStatusHistory.map((h: any) => ({
      status: h.status,
      at: h.at.toISOString(),
      description: h.description,
    })),
  });
}
