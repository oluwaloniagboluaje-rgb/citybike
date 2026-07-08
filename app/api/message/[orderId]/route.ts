import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/libs/mongodb";
import Message from "@/models/message";
import Order from "@/models/order";
import User from "@/models/User";
import { getUserFromRequest } from "@/libs/auth";
import { z } from "zod";

const sendMessageSchema = z.object({
  text: z.string().min(1, "Message cannot be empty"),
});

function canAccessOrder(
  auth: { userId: string; role: string },
  order: { customer: { toString(): string }; driver?: { toString(): string } | null }
) {
  if (auth.role === "admin") return true;
  if (order.customer?.toString() === auth.userId) return true;
  if (order.driver && order.driver.toString() === auth.userId) return true;
  return false;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const auth = getUserFromRequest(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const { orderId } = await params;

  const order = await Order.findById(orderId);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (!canAccessOrder(auth, order)) {
    return NextResponse.json(
      { error: "You do not have access to this order's messages" },
      { status: 403 }
    );
  }

  const messages = await Message.find({ order: orderId })
    .sort({ createdAt: 1 })
    .lean();

  return NextResponse.json({ messages });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const auth = getUserFromRequest(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const { orderId } = await params;

  const body = await req.json();
  const parsed = sendMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid input" },
      { status: 400 }
    );
  }

  const order = await Order.findById(orderId);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (!canAccessOrder(auth, order)) {
    return NextResponse.json(
      { error: "You do not have access to this order's messages" },
      { status: 403 }
    );
  }

  const sender = await User.findById(auth.userId);
  if (!sender) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const message = await Message.create({
    order: orderId,
    sender: sender._id,
    senderRole: auth.role,
    senderName: sender.name,
    text: parsed.data.text,
  });

  return NextResponse.json({ message });
}