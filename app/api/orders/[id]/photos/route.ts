import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/libs/mongodb";
import Order from "@/models/order";
import { getUserFromRequest } from "@/libs/auth";
import { z } from "zod";

const photoSchema = z.object({
  stage: z.enum(["pickup", "delivery"]),
  photoUrl: z.string().url("A valid photo URL is required"),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = getUserFromRequest(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (auth.role !== "driver" && auth.role !== "admin") {
    return NextResponse.json(
      { error: "Only the assigned driver or an admin can upload package photos" },
      { status: 403 }
    );
  }

  await connectDB();
  const { id } = await params;

  const body = await req.json();
  const parsed = photoSchema.safeParse(body);
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

  if (auth.role === "driver" && order.driver?.toString() !== auth.userId) {
    return NextResponse.json(
      { error: "This order is not assigned to you" },
      { status: 403 }
    );
  }

  const { stage, photoUrl } = parsed.data;
  if (stage === "pickup") {
    order.pickupPhotoUrl = photoUrl;
  } else {
    order.deliveryPhotoUrl = photoUrl;
  }
  await order.save();

  return NextResponse.json({
    pickupPhotoUrl: order.pickupPhotoUrl,
    deliveryPhotoUrl: order.deliveryPhotoUrl,
  });
}