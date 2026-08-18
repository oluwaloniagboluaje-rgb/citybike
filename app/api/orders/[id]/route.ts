import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

import { connectDB } from "@/libs/mongodb";
import Order from "@/models/order";
import "@/models/User";
import { getUserFromRequest } from "@/libs/auth";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

/* =========================================================
   GET ORDER
   GET /api/orders/[id]
========================================================= */

export async function GET(
  req: NextRequest,
  { params }: Params
) {
  try {
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
      .populate(
        "customer",
        "name phone email"
      )
      .populate(
        "driver",
        "name phone"
      )
      .lean();

    if (!order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    /*
     * Return the order exactly as stored,
     * including statusHistory and descriptions.
     */
    return NextResponse.json(
      { order },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "GET /api/orders/[id] error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to load order",
      },
      { status: 500 }
    );
  }
}

/* =========================================================
   PATCH ORDER
   PATCH /api/orders/[id]

   This is for general order edits.

   IMPORTANT:
   Status updates should preferably use:

   POST /api/orders/[id]/status

   so status history, email and realtime
   notifications are handled in one place.
========================================================= */

export async function PATCH(
  req: NextRequest,
  { params }: Params
) {
  try {
    const auth = getUserFromRequest(req);

    if (!auth) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    /*
     * Only admins should make general order edits.
     *
     * Drivers should use the dedicated status
     * route for status/location-related updates.
     */
    if (auth.role !== "admin") {
      return NextResponse.json(
        {
          error:
            "You are not permitted to edit this order",
        },
        { status: 403 }
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

    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          error:
            "Invalid JSON request body",
        },
        { status: 400 }
      );
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        {
          error:
            "Request body must be an object",
        },
        { status: 400 }
      );
    }

    /*
     * Do NOT allow status to be changed through
     * this general PATCH route.
     *
     * Status changes belong in:
     * /api/orders/[id]/status
     */
    const updateData = {
      ...(body as Record<string, unknown>),
    };

    delete updateData.status;
    delete updateData.statusHistory;

    /*
     * Prevent clients from changing protected fields.
     */
    delete updateData._id;
    delete updateData.createdAt;
    delete updateData.updatedAt;

    const order = await Order.findByIdAndUpdate(
      id,
      updateData,
      {
        new: true,
        runValidators: true,
      }
    )
      .populate(
        "customer",
        "name phone email"
      )
      .populate(
        "driver",
        "name phone"
      )
      .lean();

    if (!order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { order },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "PATCH /api/orders/[id] error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to update order",
      },
      { status: 500 }
    );
  }
}

/* =========================================================
   DELETE ORDER
   DELETE /api/orders/[id]
========================================================= */

export async function DELETE(
  req: NextRequest,
  { params }: Params
) {
  try {
    const auth = getUserFromRequest(req);

    if (!auth) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    /*
     * Only admins can delete orders.
     */
    if (auth.role !== "admin") {
      return NextResponse.json(
        {
          error:
            "You are not permitted to delete this order",
        },
        { status: 403 }
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

    const order =
      await Order.findByIdAndDelete(id);

    if (!order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        message:
          "Order deleted successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "DELETE /api/orders/[id] error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to delete order",
      },
      { status: 500 }
    );
  }
}