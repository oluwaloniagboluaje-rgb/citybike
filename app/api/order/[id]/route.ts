import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/libs/mongodb";
import Order from "@/models/order";
import { getUserFromRequest } from "@/libs/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = getUserFromRequest(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const { id } = await params;

  const order = await Order.findById(id)
    .populate("customer", "name phone email")
    .populate("driver", "name phone")
    .lean();

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Authorization: customer can only see their own, driver only assigned ones
  const orderAny = order as unknown as {
    customer: { _id: string };
    driver?: { _id: string };
  };

  const isOwner = orderAny.customer._id.toString() === auth.userId;
  const isAssignedDriver =
    orderAny.driver && orderAny.driver._id.toString() === auth.userId;

  if (auth.role === "customer" && !isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (auth.role === "driver" && !isAssignedDriver) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ order });
}