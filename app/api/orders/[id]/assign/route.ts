import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/libs/mongodb";
import Order from "@/models/order";
import User from "@/models/User";
import { getUserFromRequest } from "@/libs/auth";
import { sendMail, getDriverAssignedEmail, getOrderStatusUpdateEmail } from "@/libs/mailer";
import { z } from "zod";

const assignSchema = z.object({
  driverId: z.string().min(1, "driverId is required"),
});

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
      { error: "Only admins can assign drivers" },
      { status: 403 }
    );
  }

  await connectDB();
  const { id } = await params;

  const body = await req.json();
  const parsed = assignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid input" },
      { status: 400 }
    );
  }

  const { driverId } = parsed.data;

  const driver = await User.findById(driverId);
  if (!driver || driver.role !== "driver") {
    return NextResponse.json(
      { error: "Selected user is not a valid driver" },
      { status: 400 }
    );
  }

  const order = await Order.findById(id);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  order.driver = driver._id;
  order.status = "assigned";
  order.statusHistory.push({ status: "assigned", at: new Date() });
  await order.save();

  const populated = await Order.findById(order._id)
    .populate("customer", "name phone email")
    .populate("driver", "name phone email")
    .lean();

  // Registered-customer orders have a customer name; walk-in orders
  // (admin-created, no account) fall back to the sender name captured
  // at creation time.
  const senderDisplayName =
    populated?.customer?.name || populated?.senderName || "a customer";

  if (populated?.driver?.email) {
    try {
      const driverEmail = getDriverAssignedEmail(
        senderDisplayName,
        driver.name,
        populated.trackingNumber,
        order._id.toString()
      );
      await sendMail({
        to: populated.driver.email,
        subject: driverEmail.subject,
        html: driverEmail.html,
      });
    } catch (mailError) {
      console.error("Driver assignment email failed:", mailError);
    }
  }

  // Every order type now gets a customer email when a driver is
  // assigned, not just interstate. Walk-in orders have no customer email
  // on file, so this simply won't fire for them.
  if (
    populated?.customer?.email &&
    populated?.customer?.name
  ) {
    try {
      const statusEmail = getOrderStatusUpdateEmail(
        populated.customer.name,
        populated.trackingNumber,
        "assigned"
      );
      await sendMail({
        to: populated.customer.email,
        subject: statusEmail.subject,
        html: statusEmail.html,
      });
    } catch (mailError) {
      console.error("Assignment email to customer failed:", mailError);
    }
  }

  return NextResponse.json({ order: populated });
}