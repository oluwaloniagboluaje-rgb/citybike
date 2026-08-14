import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/libs/mongodb";
import Order from "@/models/order";
import User from "@/models/Users";
import { getUserFromRequest } from "@/libs/auth";
import { serverBroadcast } from "@/libs/broadcast";
import { driverNotificationChannel } from "@/libs/supabaseClient";
import { z } from "zod";

const assignSchema = z.object({
  driverId: z.string().min(1),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = getUserFromRequest(req);
  if (!auth || auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectDB();
  const { id } = await params;

  const body = await req.json();
  const parsed = assignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "driverId is required" }, { status: 400 });
  }

  const driver = await User.findOne({
    _id: parsed.data.driverId,
    role: "driver",
  });
  if (!driver) {
    return NextResponse.json({ error: "Driver not found" }, { status: 404 });
  }

  const order = await Order.findById(id);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (!["pending", "confirmed"].includes(order.status)) {
    return NextResponse.json(
      { error: `Cannot assign a driver while order is '${order.status}'` },
      { status: 400 }
    );
  }

  order.driver = driver._id;
  order.status = "assigned";
  order.statusHistory.push({ status: "assigned", at: new Date() });
  await order.save();

  const populated = await Order.findById(order._id)
    .populate("customer", "name phone email")
    .populate("driver", "name phone")
    .lean();

  serverBroadcast(
    driverNotificationChannel(driver._id.toString()),
    "new-assignment",
    populated
  );

  return NextResponse.json({ order: populated });
}