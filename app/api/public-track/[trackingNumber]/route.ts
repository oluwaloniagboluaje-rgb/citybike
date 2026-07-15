import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/libs/mongodb";
import Order, { OrderStatus } from "@/models/order";
import { PublicTrackingResult } from "@/types";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ trackingNumber: string }> }
) {
  await connectDB();
  const { trackingNumber } = await params;

  const order = await Order.findOne({
    trackingNumber: trackingNumber.trim().toUpperCase(),
  }).lean();

  if (!order) {
    return NextResponse.json(
      { error: "No package found with that tracking number. Please check and try again." },
      { status: 404 }
    );
  }

  const result: PublicTrackingResult = {
    trackingNumber: order.trackingNumber,
    status: order.status as OrderStatus,
    statusHistory: order.statusHistory.map((h: { status: OrderStatus; at: Date }) => ({
      status: h.status,
      at: h.at.toISOString(),
    })),
    serviceType: order.serviceType,
    isInternational: order.isInternational,
    packageDescription: order.packageDescription,
    recipientName: order.recipientName,
    pickupTime: order.pickupTime.toISOString(),
    eta: order.eta?.toISOString(),
    pickup: {
      city: order.pickup.city,
      country: order.pickup.country,
      lat: order.pickup.lat,
      lng: order.pickup.lng,
    },
    dropoff: {
      city: order.dropoff.city,
      country: order.dropoff.country,
      lat: order.dropoff.lat,
      lng: order.dropoff.lng,
    },
    locationHistory: order.locationHistory?.map((point: { lat: number; lng: number; updatedAt: Date }) => ({
      lat: point.lat,
      lng: point.lng,
      updatedAt: point.updatedAt.toISOString(),
    })),
    lastLocation: order.lastLocation
      ? {
          lat: order.lastLocation.lat,
          lng: order.lastLocation.lng,
          updatedAt: order.lastLocation.updatedAt.toISOString(),
        }
      : null,
    createdAt: order.createdAt.toISOString(),
  };

  return NextResponse.json(result);
}
