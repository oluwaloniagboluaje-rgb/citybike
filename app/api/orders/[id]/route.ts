import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/libs/mongodb";
import Order from "@/models/order";
import "@/models/User";
import { getUserFromRequest } from "@/libs/auth";
import mongoose from "mongoose";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(req: NextRequest, { params }: Params) {
  const auth = getUserFromRequest(req);

  if (!auth) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  await connectDB();

  const { id } = await params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json(
      { error: "Invalid order ID" },
      { status: 400 }
    );
  }

  const order = await Order.findById(id)
    .populate("customer", "name phone email")
    .populate("driver", "name phone")
    .lean();

  if (!order) {
    return NextResponse.json(
      { error: "Order not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ order });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = getUserFromRequest(req);

  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const { id } = await params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
  }

  const body = await req.json();

  let order;

  // If status is included, handle it explicitly so we record history,
  // notify the customer, and broadcast the update for realtime tracking.
  if (body && body.status) {
    order = await Order.findById(id);
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    order.status = body.status;
    order.statusHistory.push({ status: body.status, at: new Date() });
    const { status, statusHistory, ...rest } = body;
    Object.assign(order, rest);
    await order.save();

    order = await Order.findById(order._id)
      .populate("customer", "name phone email")
      .populate("driver", "name phone")
      .lean();

    // Notify customer if possible
    if (order?.customer?.email && order?.customer?.name) {
      try {
        const { sendMail, getOrderStatusUpdateEmail } = await import("@/libs/mailer");
        const statusEmail = getOrderStatusUpdateEmail(order.customer.name, order.trackingNumber, body.status);
        await sendMail({ to: order.customer.email, subject: statusEmail.subject, html: statusEmail.html });
      } catch (err) {
        console.error("Status update notification failed:", err);
      }
    }

    try {
      const { serverBroadcast } = await import("@/libs/broadcast");
      const { orderStatusChannel } = await import("@/libs/supabaseClient");
      await serverBroadcast(orderStatusChannel(order._id.toString()), "status-update", order);
    } catch (err) {
      console.error("Broadcast failed", err);
    }
  } else {
    order = await Order.findByIdAndUpdate(id, body, { new: true })
      .populate("customer", "name phone email")
      .populate("driver", "name phone");

    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json({ order });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = getUserFromRequest(req);

  if (!auth) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  await connectDB();

  const { id } = await params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json(
      { error: "Invalid order ID" },
      { status: 400 }
    );
  }

  const order = await Order.findByIdAndDelete(id);

  if (!order) {
    return NextResponse.json(
      { error: "Order not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    message: "Order deleted successfully",
  });
}