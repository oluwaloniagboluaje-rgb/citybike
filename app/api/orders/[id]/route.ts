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

  const body = await req.json();

  const order = await Order.findByIdAndUpdate(id, body, {
    new: true,
  })
    .populate("customer", "name phone email")
    .populate("driver", "name phone");

  if (!order) {
    return NextResponse.json(
      { error: "Order not found" },
      { status: 404 }
    );
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