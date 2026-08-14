import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/libs/mongodb";
import Order, { OrderStatus } from "@/models/order";
import { sendMail, getOrderStatusUpdateEmail } from "@/libs/mailer";
import { serverBroadcast } from "@/libs/broadcast";
import { orderStatusChannel } from "@/libs/supabaseClient";
import { getUserFromRequest } from "@/libs/auth";
import { z } from "zod";

const statusSchema = z.object({
  status: z.enum([
    "pending",
    "shipment_created",
    "awaiting_batching",
    "added_to_batch",
    "ready_for_shipping",
    "left_origin",
    "in_transit",
    "landed",
    "customs_processing",
    "confirmed",
    "assigned",
    "assigned_courier",
    "picked_up",
    "awaiting_dispatch",
    "dispatched",
    "destination_hub",
    "out_for_delivery",
    "delivered_by_courier",
    "delivery_confirmed",
    "delivered",
    "cancelled",
  ]),
});

// Who is allowed to move an order INTO a given status
const ALLOWED_TRANSITIONS: Record<
  OrderStatus,
  ("admin" | "driver" | "customer")[]
> = {
  pending: [],
  shipment_created: ["admin"],
  awaiting_batching: ["admin"],
  added_to_batch: ["admin"],
  ready_for_shipping: ["admin"],
  left_origin: ["admin"],
  in_transit: ["driver"],
  landed: ["admin", "driver"],
  customs_processing: ["admin"],
  confirmed: ["admin"],
  assigned: ["admin"],
  assigned_courier: ["admin"],
  picked_up: ["driver", "admin"],
  awaiting_dispatch: ["admin", "driver"],
  dispatched: ["admin", "driver"],
  destination_hub: ["admin", "driver"],
  out_for_delivery: ["admin", "driver"],
  delivered_by_courier: ["driver"],
  delivery_confirmed: ["admin"],
  delivered: ["driver", "admin"],
  cancelled: ["admin", "driver", "customer"],
};

// Valid forward-progress map to stop status from jumping arbitrarily.
// The interstate flow must remain in the requested order:
// confirmed -> picked_up -> awaiting_dispatch -> dispatched -> in_transit -> destination_hub -> out_for_delivery -> delivered -> cancelled.
const NEXT_VALID: Record<OrderStatus, OrderStatus[]> = {
  pending: ["shipment_created", "confirmed", "cancelled"],
  shipment_created: ["awaiting_batching", "confirmed", "cancelled"],
  awaiting_batching: ["added_to_batch", "cancelled"],
  added_to_batch: ["ready_for_shipping", "cancelled"],
  ready_for_shipping: ["left_origin", "cancelled"],
  left_origin: ["in_transit", "landed"],
  in_transit: ["landed", "delivered_by_courier", "destination_hub", "cancelled"],
  landed: ["customs_processing", "assigned_courier", "delivered_by_courier"],
  customs_processing: ["assigned_courier", "delivered_by_courier"],
  assigned_courier: ["picked_up", "delivered_by_courier"],
  picked_up: ["awaiting_dispatch", "in_transit", "cancelled"],
  awaiting_dispatch: ["dispatched", "cancelled"],
  dispatched: ["in_transit", "cancelled"],
  destination_hub: ["out_for_delivery", "cancelled"],
  out_for_delivery: ["delivered", "cancelled"],
  delivered_by_courier: ["delivery_confirmed", "delivered"],
  delivery_confirmed: ["delivered"],
  confirmed: ["assigned", "picked_up", "cancelled"],
  assigned: ["picked_up", "cancelled"],
  delivered: [],
  cancelled: [],
};

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
  const parsed = statusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const nextStatus = parsed.data.status;

  const order = await Order.findById(id);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Admins may set any status; other roles must be in the allowed list.
  if (auth.role !== "admin" && !ALLOWED_TRANSITIONS[nextStatus].includes(auth.role)) {
    return NextResponse.json(
      { error: `Your role cannot set status to '${nextStatus}'` },
      { status: 403 }
    );
  }

  if (auth.role === "driver" && order.driver?.toString() !== auth.userId) {
    return NextResponse.json(
      { error: "You are not assigned to this order" },
      { status: 403 }
    );
  }

  if (auth.role === "customer" && order.customer.toString() !== auth.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Admins may jump statuses; non-admins must follow NEXT_VALID.
  if (auth.role !== "admin" && !NEXT_VALID[order.status as OrderStatus].includes(nextStatus)) {
    return NextResponse.json(
      { error: `Cannot move from '${order.status}' to '${nextStatus}'` },
      { status: 400 }
    );
  }

  order.status = nextStatus;
  order.statusHistory.push({ status: nextStatus, at: new Date() });
  await order.save();

  const populated = await Order.findById(order._id)
    .populate("customer", "name phone email")
    .populate("driver", "name phone")
    .lean();

  // Notify customer by email when possible
  if (populated?.customer?.email && populated?.customer?.name) {
    try {
      const statusEmail = getOrderStatusUpdateEmail(
        populated.customer.name,
        populated.trackingNumber,
        nextStatus as OrderStatus
      );
      await sendMail({
        to: populated.customer.email,
        subject: statusEmail.subject,
        html: statusEmail.html,
      });
    } catch (mailError) {
      console.error("Status update email failed:", mailError);
    }
  }

  // Broadcast realtime status update for tracking viewers
  try {
    await serverBroadcast(orderStatusChannel(order._id.toString()), "status-update", populated);
  } catch (err) {
    console.error("Broadcast failed", err);
  }

  return NextResponse.json({ order: populated });
}