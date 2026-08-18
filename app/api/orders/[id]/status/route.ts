import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";

import { connectDB } from "@/libs/mongodb";
import Order, { OrderStatus } from "@/models/order";
import { getUserFromRequest } from "@/libs/auth";
import {
  sendMail,
  getOrderStatusUpdateEmail,
} from "@/libs/mailer";
import { serverBroadcast } from "@/libs/broadcast";
import { orderStatusChannel } from "@/libs/supabaseClient";

/* =========================================================
   ORDER STATUSES
========================================================= */

const ORDER_STATUSES = [
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
] as const;

/* =========================================================
   STATUS VALIDATION
========================================================= */

const statusUpdateSchema = z.object({
  status: z.enum(ORDER_STATUSES),

  description: z
    .string()
    .trim()
    .max(2000)
    .optional(),
});

/* =========================================================
   ALLOWED ROLES
========================================================= */

const ALLOWED_ROLES = [
  "admin",
  "driver",
] as const;

/* =========================================================
   ROUTE PARAMS
========================================================= */

type Params = {
  params: Promise<{
    id: string;
  }>;
};

/* =========================================================
   POST
   POST /api/orders/[id]/status
========================================================= */

export async function POST(
  req: NextRequest,
  { params }: Params
) {
  try {
    /* =====================================================
       AUTHENTICATION
    ===================================================== */

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

    /* =====================================================
       ROLE AUTHORIZATION
    ===================================================== */

    if (
      !ALLOWED_ROLES.includes(
        auth.role as (typeof ALLOWED_ROLES)[number]
      )
    ) {
      return NextResponse.json(
        {
          error:
            "You are not permitted to update order status",
        },
        {
          status: 403,
        }
      );
    }

    /* =====================================================
       DATABASE
    ===================================================== */

    await connectDB();

    /* =====================================================
       ORDER ID
    ===================================================== */

    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        {
          error: "Invalid order ID",
        },
        {
          status: 400,
        }
      );
    }

    /* =====================================================
       REQUEST BODY
    ===================================================== */

    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          error: "Invalid JSON request body",
        },
        {
          status: 400,
        }
      );
    }

    /* =====================================================
       VALIDATE REQUEST
    ===================================================== */

    const parsed =
      statusUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ||
            "Invalid status update",
        },
        {
          status: 400,
        }
      );
    }

    const {
      status,
      description,
    } = parsed.data;

    const cleanDescription =
      description?.trim() || undefined;

    /* =====================================================
       FIND ORDER
    ===================================================== */

    const order = await Order.findById(id);

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

    /* =====================================================
       DRIVER PERMISSION
    ===================================================== */

    if (auth.role === "driver") {
      const assignedDriverId =
        order.driver?.toString();

      if (
        !assignedDriverId ||
        assignedDriverId !== auth.userId
      ) {
        return NextResponse.json(
          {
            error:
              "This order is not assigned to you",
          },
          {
            status: 403,
          }
        );
      }
    }

    /* =====================================================
       PREVIOUS STATUS
    ===================================================== */

    const previousStatus =
      order.status as OrderStatus;

    /* =====================================================
       DUPLICATE STATUS
    ===================================================== */

    /*
     * If the status has not changed and there is
     * no new description, don't create another
     * identical history entry.
     *
     * If a description was supplied, we still allow
     * the update so the description can be recorded.
     */

    if (
      previousStatus === status &&
      !cleanDescription
    ) {
      const populated =
        await Order.findById(order._id)
          .populate(
            "customer",
            "name phone email"
          )
          .populate(
            "driver",
            "name phone"
          )
          .lean();

      return NextResponse.json(
        {
          success: true,
          message:
            "Order already has this status",
          unchanged: true,
          order: populated,
          previousStatus,
          status,
        },
        {
          status: 200,
        }
      );
    }

    /* =====================================================
       UPDATE CURRENT STATUS
    ===================================================== */

    order.status =
      status as OrderStatus;

    /* =====================================================
       STATUS HISTORY
    ===================================================== */

    if (!Array.isArray(order.statusHistory)) {
      order.statusHistory = [];
    }

    order.statusHistory.push({
      status: status as OrderStatus,
      at: new Date(),

      ...(cleanDescription
        ? {
            description:
              cleanDescription,
          }
        : {}),
    });

    /* =====================================================
       SAVE
    ===================================================== */

    await order.save();

    /* =====================================================
       LOAD UPDATED ORDER
    ===================================================== */

    const populated =
      await Order.findById(order._id)
        .populate(
          "customer",
          "name phone email"
        )
        .populate(
          "driver",
          "name phone"
        )
        .lean();

    if (!populated) {
      return NextResponse.json(
        {
          error:
            "Status was saved, but the updated order could not be loaded",
        },
        {
          status: 500,
        }
      );
    }

    /* =====================================================
       CUSTOMER EMAIL
    ===================================================== */

    const customer =
      populated.customer &&
      typeof populated.customer === "object"
        ? populated.customer
        : null;

    const customerEmail =
      customer &&
      "email" in customer &&
      typeof customer.email === "string"
        ? customer.email
        : null;

    const customerName =
      customer &&
      "name" in customer &&
      typeof customer.name === "string"
        ? customer.name
        : null;

    if (
      customerEmail &&
      customerName
    ) {
      try {
        const statusEmail =
          getOrderStatusUpdateEmail(
            customerName,
            populated.trackingNumber,
            status as OrderStatus
          );

        await sendMail({
          to: customerEmail,
          subject: statusEmail.subject,
          html: statusEmail.html,
        });
      } catch (mailError) {
        /*
         * Email failure should NOT cause
         * the status update to fail.
         */
        console.error(
          "Status update email failed:",
          mailError
        );
      }
    }

    /* =====================================================
       REALTIME BROADCAST
    ===================================================== */

    try {
      await serverBroadcast(
        orderStatusChannel(
          order._id.toString()
        ),
        "status-update",
        populated
      );
    } catch (broadcastError) {
      /*
       * Realtime failure should NOT cause
       * the status update to fail.
       */
      console.error(
        "Order status broadcast failed:",
        broadcastError
      );
    }

    /* =====================================================
       RESPONSE
    ===================================================== */

    return NextResponse.json(
      {
        success: true,
        message:
          "Order status updated successfully",
        order: populated,
        previousStatus,
        status,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "ORDER STATUS UPDATE ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Something went wrong while updating the order status",
      },
      {
        status: 500,
      }
    );
  }
}