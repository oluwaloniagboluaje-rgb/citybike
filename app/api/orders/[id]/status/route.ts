import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/libs/mongodb";
import Order, { OrderStatus } from "@/models/order";
import User from "@/models/User";
import { getUserFromRequest } from "@/libs/auth";
import { z } from "zod";

const statusUpdateSchema = z.object({
  status: z.enum([
    "pending",
    "confirmed",
    "assigned",
    "picked_up",
    "in_transit",
    "delivered",
    "cancelled",
  ]),
});

// Only these roles may update order status. Adjust if customers should
// be able to cancel their own orders, etc.
const ALLOWED_ROLES = ["admin", "driver"];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = getUserFromRequest(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!ALLOWED_ROLES.includes(auth.role)) {
    return NextResponse.json(
      { error: "You are not permitted to update order status" },
      { status: 403 }
    );
  }

  await connectDB();
  const { id } = await params;

  const body = await req.json();
  const parsed = statusUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid status" },
      { status: 400 }
    );
  }

  const { status } = parsed.data;

  const order = await Order.findById(id);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // If it's a driver, only allow them to update orders assigned to them.
  if (auth.role === "driver" && order.driver?.toString() !== auth.userId) {
    return NextResponse.json(
      { error: "This order is not assigned to you" },
      { status: 403 }
    );
  }

  order.status = status as OrderStatus;
  order.statusHistory.push({ status: status as OrderStatus, at: new Date() });
  await order.save();

  const populated = await Order.findById(order._id)
    .populate("customer", "name phone email")
    .populate("driver", "name phone")
    .lean();

  return NextResponse.json({ order: populated });
}