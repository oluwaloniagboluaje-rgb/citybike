import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/libs/mongodb";
import Order from "@/models/order";
import { getUserFromRequest } from "@/libs/auth";
import { z } from "zod";

const proofSchema = z.object({
  proofUrl: z.string().url("A valid file URL is required"),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = getUserFromRequest(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const { id } = await params;

  const body = await req.json();
  const parsed = proofSchema.safeParse(body);
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

  if (order.customer.toString() !== auth.userId) {
    return NextResponse.json(
      { error: "You can only upload proof for your own order" },
      { status: 403 }
    );
  }

  order.proofOfPaymentUrl = parsed.data.proofUrl;
  await order.save();

  return NextResponse.json({ order });
}