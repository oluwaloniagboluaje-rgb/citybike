import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/libs/mongodb";
import Order from "@/models/order";
import { getUserFromRequest } from "@/libs/auth";
import { z } from "zod";

import type {
  InternationalStatus,
  OrderStatus,
} from "@/types";

const INTERNATIONAL_STATUS_VALUES = [
  "shipment_picked_up",
  "in_transit",
  "cleared_customs",
  "out_for_delivery",
  "delivered",
  "delayed",
  "exception",
] as const;

type InternationalStatusValue =
  (typeof INTERNATIONAL_STATUS_VALUES)[number];

const internationalStatusSchema = z.object({
  status: z.enum(INTERNATIONAL_STATUS_VALUES),
  description: z.string().optional(),
});

function normalizeInternationalStatus(
  input: unknown
): InternationalStatusValue | null {
  const raw =
    typeof input === "string"
      ? input.trim()
      : "";

  if (!raw) {
    return null;
  }

  const directMatch =
    INTERNATIONAL_STATUS_VALUES.find(
      (value) =>
        value.toLowerCase() ===
        raw.toLowerCase()
    );

  if (directMatch) {
    return directMatch;
  }

  const normalizedAlias = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  const aliasMap: Record<
    string,
    InternationalStatusValue
  > = {
    "shipment picked up":
      "shipment_picked_up",

    "picked up":
      "shipment_picked_up",

    "in transit":
      "in_transit",

    "cleared customs":
      "cleared_customs",

    "customs cleared":
      "cleared_customs",

    "out for delivery":
      "out_for_delivery",

    delivered:
      "delivered",

    delayed:
      "delayed",

    exception:
      "exception",
  };

  return aliasMap[normalizedAlias] ?? null;
}

/**
 * Convert an international cargo status into the
 * main OrderStatus used by the customer tracking page.
 */
function getMainOrderStatus(
  status: InternationalStatusValue
): OrderStatus | null {
  switch (status) {
    case "shipment_picked_up":
      return "picked_up";

    case "in_transit":
      return "in_transit";

    case "cleared_customs":
      return "customs_processing";

    case "out_for_delivery":
      return "out_for_delivery";

    case "delivered":
      return "delivered";

    /*
     * There is no dedicated delayed/exception value
     * in OrderStatus, so leave the main status unchanged.
     */
    case "delayed":
    case "exception":
      return null;

    default:
      return null;
  }
}

export async function POST(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    /*
     * ---------------------------------------------------------
     * AUTHENTICATION
     * ---------------------------------------------------------
     */

    const auth = getUserFromRequest(req);

    if (!auth) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    if (auth.role !== "admin") {
      return NextResponse.json(
        {
          error:
            "Only admins can update international tracking status",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * ---------------------------------------------------------
     * DATABASE
     * ---------------------------------------------------------
     */

    await connectDB();

    const { id } = await params;

    /*
     * ---------------------------------------------------------
     * REQUEST BODY
     * ---------------------------------------------------------
     */

    const body = await req.json();

    const normalizedStatus =
      normalizeInternationalStatus(
        body?.status
      );

    if (!normalizedStatus) {
      return NextResponse.json(
        {
          error:
            "Please pick a valid international status or type one of the supported status names.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * ---------------------------------------------------------
     * VALIDATE REQUEST
     * ---------------------------------------------------------
     */

    const parsed =
      internationalStatusSchema.safeParse({
        ...body,
        status: normalizedStatus,
      });

    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ||
            "Invalid input",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * ---------------------------------------------------------
     * FIND ORDER
     * ---------------------------------------------------------
     */

    const order =
      await Order.findById(id);

    if (!order) {
      return NextResponse.json(
        {
          error: "Order not found",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * ---------------------------------------------------------
     * MAKE SURE IT IS INTERNATIONAL
     * ---------------------------------------------------------
     */

    if (
      order.serviceType !==
      "international"
    ) {
      return NextResponse.json(
        {
          error:
            "This order is not an international cargo shipment",
        },
        {
          status: 400,
        }
      );
    }

    const now = new Date();

    /*
     * ---------------------------------------------------------
     * 1. ADD INTERNATIONAL TRACKING EVENT
     * ---------------------------------------------------------
     */

    if (
      !order.internationalStatusHistory
    ) {
      order.internationalStatusHistory =
        [];
    }

    order.internationalStatusHistory.push({
      status: parsed.data.status,
      at: now,
      description:
        parsed.data.description,
    });

    /*
     * ---------------------------------------------------------
     * 2. SYNCHRONIZE MAIN ORDER STATUS
     * ---------------------------------------------------------
     */

    const mainStatus =
      getMainOrderStatus(
        parsed.data.status
      );

    if (mainStatus) {
      order.status = mainStatus;

      /*
       * Keep the normal status history synchronized
       * with the international tracking history.
       */

      if (!order.statusHistory) {
        order.statusHistory = [];
      }

      order.statusHistory.push({
        status: mainStatus,
        at: now,
      });
    }

    /*
     * ---------------------------------------------------------
     * 3. DELIVERED = COMPLETED
     * ---------------------------------------------------------
     */

    if (
      parsed.data.status ===
      "delivered"
    ) {
      order.status = "delivered";
    }

    /*
     * ---------------------------------------------------------
     * SAVE
     * ---------------------------------------------------------
     */

    await order.save();

    /*
     * ---------------------------------------------------------
     * RESPONSE
     * ---------------------------------------------------------
     */

    return NextResponse.json({
      success: true,

      message:
        "International tracking status updated successfully.",

      serviceType:
        order.serviceType,

      status:
        order.status,

      internationalStatusHistory:
        order.internationalStatusHistory.map(
          (h: {
            status: InternationalStatus;
            at: Date;
            description?: string;
          }) => ({
            status: h.status,
            at: h.at.toISOString(),
            description:
              h.description,
          })
        ),

      statusHistory:
        order.statusHistory.map(
          (h: {
            status: OrderStatus;
            at: Date;
          }) => ({
            status: h.status,
            at: h.at.toISOString(),
          })
        ),
    });
  } catch (error) {
    console.error(
      "International tracking update error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to update international tracking status.",
      },
      {
        status: 500,
      }
    );
  }
}