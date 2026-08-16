import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/libs/mongodb";
import Order from "@/models/order";
import { getUserFromRequest } from "@/libs/auth";
import { DHLStatus } from "@/types";
import { z } from "zod";

const DHL_STATUS_VALUES = [
  "shipment_picked_up",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "failed_delivery_attempt",
  "returned",
  "customs_cleared",
  "exception",
] as const satisfies readonly DHLStatus[];

const dhlStatusSchema = z.object({
  status: z.enum(DHL_STATUS_VALUES),
  description: z.string().optional(),
});

function normalizeDhlStatus(input: unknown): DHLStatus | null {
  const raw = typeof input === "string" ? input.trim() : "";
  if (!raw) return null;

  const directMatch = DHL_STATUS_VALUES.find(
    (value) => value.toLowerCase() === raw.toLowerCase()
  );
  if (directMatch) return directMatch;

  const normalizedAlias = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  const aliasMap: Record<string, DHLStatus> = {
    "shipment picked up": "shipment_picked_up",
    "picked up": "shipment_picked_up",
    "in transit": "in_transit",
    "out for delivery": "out_for_delivery",
    "delivered": "delivered",
    "failed delivery attempt": "failed_delivery_attempt",
    "returned to shipper": "returned",
    "return to shipper": "returned",
    "customs cleared": "customs_cleared",
    "exception": "exception",
  };

  return aliasMap[normalizedAlias] ?? null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = getUserFromRequest(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (auth.role !== "admin") {
    return NextResponse.json(
      { error: "Only admins can update DHL tracking status" },
      { status: 403 }
    );
  }

  await connectDB();
  const { id } = await params;

  const body = await req.json();
  const normalizedStatus = normalizeDhlStatus(body?.status);
  if (!normalizedStatus) {
    return NextResponse.json(
      {
        error:
          "Please pick a valid DHL status or type one of the supported status names.",
      },
      { status: 400 }
    );
  }

  const parsed = dhlStatusSchema.safeParse({
    ...body,
    status: normalizedStatus,
  });
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

  if (!order.externalTrackingNumber || order.carrierName !== "DHL") {
    return NextResponse.json(
      { error: "This order does not have a DHL tracking number assigned" },
      { status: 400 }
    );
  }

  // Initialize dhlStatusHistory if it doesn't exist
  if (!order.dhlStatusHistory) {
    order.dhlStatusHistory = [];
  }

  // Add the new status to the history
  order.dhlStatusHistory.push({
    status: parsed.data.status as DHLStatus,
    at: new Date(),
    description: parsed.data.description,
  });

  await order.save();

  return NextResponse.json({
    externalTrackingNumber: order.externalTrackingNumber,
    carrierName: order.carrierName,
    dhlStatusHistory: order.dhlStatusHistory.map(
      (h: { status: DHLStatus; at: Date; description?: string }) => ({
        status: h.status,
        at: h.at.toISOString(),
        description: h.description,
      })
    ),
  });
}
