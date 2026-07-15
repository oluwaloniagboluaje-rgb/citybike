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

function canUpdateOrderStatus(
  auth: { userId: string; role: string },
  order: { customer: { toString(): string }; driver?: { toString(): string } | null; status: string },
  status: string
) {
  if (auth.role === "admin") return true;

  if (status === "cancelled") {
    if (
      auth.role === "customer" &&
      order.customer?.toString() === auth.userId &&
      ["pending", "confirmed", "assigned"].includes(order.status)
    ) {
      return true;
    }

    if (
      auth.role === "driver" &&
      order.driver?.toString() === auth.userId &&
      ["assigned", "picked_up", "in_transit"].includes(order.status)
    ) {
      return true;
    }

    return false;
  }

  return auth.role === "driver" && order.driver?.toString() === auth.userId;
}

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

  if (order.status === "cancelled") {
    return NextResponse.json(
      { error: "This order is already cancelled" },
      { status: 400 }
    );
  }

  if (order.status === "delivered" && status === "cancelled") {
    return NextResponse.json(
      { error: "Delivered orders cannot be cancelled" },
      { status: 400 }
    );
  }

  if (!canUpdateOrderStatus(auth, order, status)) {
    return NextResponse.json(
      { error: "You are not permitted to update this order status" },
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