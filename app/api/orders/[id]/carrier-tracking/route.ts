import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/libs/mongodb";
import Order from "@/models/order";
import { getUserFromRequest } from "@/libs/auth";
import { z } from "zod";

const carrierTrackingSchema = z.object({
  externalTrackingNumber: z.string().trim().min(1, "Tracking number is required"),
  carrierName: z.string().trim().min(1).default("DHL"),
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
      { error: "Only admins can record carrier tracking numbers" },
      { status: 403 }
    );
  }

  await connectDB();
  const { id } = await params;

  const body = await req.json();
  const parsed = carrierTrackingSchema.safeParse(body);
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

  order.externalTrackingNumber = parsed.data.externalTrackingNumber;
  order.carrierName = parsed.data.carrierName;
  await order.save();

  return NextResponse.json({
    externalTrackingNumber: order.externalTrackingNumber,
    carrierName: order.carrierName,
  });
}