import nodemailer from "nodemailer";
import { Resend } from "resend";
import { OrderStatus } from "@/models/order";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_NAME = "CityBike Logistics";
// Set this once your domain is verified in Resend, e.g. "no-reply@citybikelogistics.com".
// Until then, leave unset and the app falls back to Gmail SMTP so emails
// keep working during development.
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL;

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT ?? "");
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const FROM_EMAIL = process.env.FROM_EMAIL || "no-reply@citybike.co";

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

function createSmtpTransporter() {
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    throw new Error(
      "SMTP configuration is missing. Set SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS in your environment."
    );
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
}

export async function sendMail(options: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  // Use Resend with your verified domain once it's set up — this is the
  // reliable, production-ready path with proper inbox delivery.
  if (resend && RESEND_FROM_EMAIL) {
    return resend.emails.send({
      from: `${RESEND_FROM_NAME} <${RESEND_FROM_EMAIL}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });
  }

  // Fallback: Gmail SMTP. Used automatically until RESEND_FROM_EMAIL is
  // set (i.e. until a domain is verified in Resend), so emails keep
  // working during development without any code changes needed later.
  const transporter = createSmtpTransporter();
  return transporter.sendMail({
    from: FROM_EMAIL,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
  });
}

export function getWelcomeEmail(name: string, role: string) {
  return {
    subject: `Welcome to CityBike Logistics, ${name}!`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #1f2937;">
        <h1 style="color: #f97316;">Welcome to CityBike Logistics</h1>
        <p>Hi ${name},</p>
        <p>
          Thank you for joining CityBike Logistics as a ${role}.
          We&apos;re excited to help you deliver packages safely and reliably.
        </p>
        <p>
          If you have any questions, just reply to this email and our support team will assist you.
        </p>
        <p>Safe travels,</p>
        <p><strong>CityBike Logistics Team</strong></p>
      </div>
    `,
  };
}

export function getOrderCreatedEmail(name: string, trackingNumber: string, eta?: string) {
  return {
    subject: `Your CityBike delivery is booked (#${trackingNumber})`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #1f2937;">
        <h1 style="color: #f97316;">Order Confirmed</h1>
        <p>Hi ${name},</p>
        <p>Your order has been successfully created with tracking number <strong>#${trackingNumber}</strong>.</p>
        ${eta ? `<p>Estimated delivery time: <strong>${eta}</strong></p>` : ""}
        <p>We&apos;ll notify you again when a driver is assigned to your shipment.</p>
        <p>Thanks for choosing CityBike Logistics.</p>
        <p><strong>CityBike Logistics Team</strong></p>
      </div>
    `,
  };
}

export function getDriverAssignedEmail(
  customerName: string,
  driverName: string,
  trackingNumber: string,
  orderId: string
) {
  return {
    subject: `You have been assigned a CityBike delivery (#${trackingNumber})`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #1f2937;">
        <h1 style="color: #f97316;">New Delivery Assignment</h1>
        <p>Hi ${driverName},</p>
        <p>You have been assigned a new delivery for customer <strong>${customerName}</strong>.</p>
        <p>Tracking number: <strong>#${trackingNumber}</strong></p>
        <p>Visit your dashboard to view the order details and start the delivery.</p>
        <p><strong>CityBike Logistics Team</strong></p>
      </div>
    `,
  };
}

// Sent to the customer for interstate orders whenever an admin manually
// updates the order status (assigned, picked up, in transit, delivered).
// Local orders are handled entirely over WhatsApp and never use this.
const STATUS_MESSAGES: Partial<Record<OrderStatus, { title: string; body: string }>> = {
  assigned: {
    title: "A driver has been assigned to your shipment",
    body: "Your package has been assigned to one of our drivers and will be picked up shortly.",
  },
  picked_up: {
    title: "Your package has been picked up",
    body: "Your package has been picked up by our driver and is on its way to the next stage of its journey.",
  },
  in_transit: {
    title: "Your package is in transit",
    body: "Your package is currently in transit toward its destination.",
  },
  delivered: {
    title: "Your package has been delivered",
    body: "Your package has arrived and been delivered. Thank you for shipping with CityBike Logistics.",
  },
  cancelled: {
    title: "Your order has been cancelled",
    body: "Your order has been cancelled. If you believe this was a mistake, please contact us.",
  },
};

export function getOrderStatusUpdateEmail(
  name: string,
  trackingNumber: string,
  status: OrderStatus
) {
  const info = STATUS_MESSAGES[status] ?? {
    title: "Your order status has been updated",
    body: `Your order status is now: ${status}.`,
  };

  return {
    subject: `${info.title} (#${trackingNumber})`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #1f2937;">
        <h1 style="color: #f97316;">${info.title}</h1>
        <p>Hi ${name},</p>
        <p>${info.body}</p>
        <p>Tracking number: <strong>#${trackingNumber}</strong></p>
        <p>You can check the latest status anytime on our tracking page.</p>
        <p><strong>CityBike Logistics Team</strong></p>
      </div>
    `,
  };
}

// Sent to every admin user whenever a new order is created, so they know
// to log in and confirm/assign a driver. This is separate from the
// realtime dashboard bell notification — this is an actual email.
export function getAdminNewOrderEmail(params: {
  trackingNumber: string;
  customerName: string;
  serviceType: string;
  pickupCity: string;
  dropoffCity: string;
}) {
  const { trackingNumber, customerName, serviceType, pickupCity, dropoffCity } = params;
  return {
    subject: `New order received (#${trackingNumber})`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #1f2937;">
        <h1 style="color: #f97316;">New Order Received</h1>
        <p>A new order has just been placed and needs review.</p>
        <p>
          <strong>Tracking number:</strong> #${trackingNumber}<br />
          <strong>Customer:</strong> ${customerName}<br />
          <strong>Service type:</strong> ${serviceType}<br />
          <strong>Route:</strong> ${pickupCity} → ${dropoffCity}
        </p>
        <p>Log in to the admin dashboard to confirm this order and assign a driver.</p>
        <p><strong>CityBike Logistics System</strong></p>
      </div>
    `,
  };
}

export function getPasswordResetEmail(name: string, resetUrl: string) {
  return {
    subject: "Reset your CityBike Logistics password",
    html: `
      <div style="font-family: Arial, sans-serif; color: #1f2937;">
        <h1 style="color: #f97316;">Reset Your Password</h1>
        <p>Hi ${name},</p>
        <p>We received a request to reset your password. Click the button below to choose a new one:</p>
        <p style="margin: 24px 0;">
          <a href="${resetUrl}" style="background-color: #ea580c; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">
            Reset Password
          </a>
        </p>
        <p>This link will expire in 1 hour. If you didn't request this, you can safely ignore this email — your password will remain unchanged.</p>
        <p><strong>CityBike Logistics Team</strong></p>
      </div>
    `,
  };
}