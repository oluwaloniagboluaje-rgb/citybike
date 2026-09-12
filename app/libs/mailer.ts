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

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://citybikelogistic.com";

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

// Builds a link to the public tracking page with the tracking number
// pre-filled, so recipients just click "Track" instead of typing it in.
export function getTrackingUrl(trackingNumber: string): string {
  return `${APP_URL}/track?number=${encodeURIComponent(trackingNumber)}`;
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
  const trackingUrl = getTrackingUrl(trackingNumber);
  return {
    subject: `Your CityBike delivery is booked (#${trackingNumber})`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #1f2937;">
        <h1 style="color: #f97316;">Order Confirmed</h1>
        <p>Hi ${name},</p>
        <p>Your order has been successfully created with tracking number <strong>#${trackingNumber}</strong>.</p>
        ${eta ? `<p>Estimated delivery time: <strong>${eta}</strong></p>` : ""}
        <p style="margin: 20px 0;">
          <a href="${trackingUrl}" style="background-color: #ea580c; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">
            Track Your Package
          </a>
        </p>
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
  const trackingUrl = getTrackingUrl(trackingNumber);
  return {
    subject: `You have been assigned a CityBike delivery (#${trackingNumber})`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #1f2937;">
        <h1 style="color: #f97316;">New Delivery Assignment</h1>
        <p>Hi ${driverName},</p>
        <p>You have been assigned a new delivery for customer <strong>${customerName}</strong>.</p>
        <p>Tracking number: <strong>#${trackingNumber}</strong></p>
        <p style="margin: 20px 0;">
          <a href="${trackingUrl}" style="background-color: #ea580c; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">
            View Tracking Page
          </a>
        </p>
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
  shipment_created: {
    title: "Your shipment has been created",
    body: "We have created your shipment and assigned a tracking number. You can track its progress using the link below.",
  },
  awaiting_batching: {
    title: "Your shipment is awaiting batching",
    body: "Your shipment is queued and will be assigned to a batch for processing shortly.",
  },
  added_to_batch: {
    title: "Your shipment has been added to a batch",
    body: "Your shipment has been grouped with other packages and will be prepared for shipping.",
  },
  ready_for_shipping: {
    title: "Your shipment is ready for shipping",
    body: "Your shipment is prepared and ready to be dispatched.",
  },
  left_origin: {
    title: "Your shipment has left the origin",
    body: "Your shipment has departed from the origin facility and is en route to the destination country or hub.",
  },
  in_transit: {
    title: "Your package is in transit",
    body: "Your package is currently in transit toward its destination.",
  },
  landed: {
    title: "Your shipment has landed",
    body: "Your shipment has arrived at the destination country and will continue local processing shortly.",
  },
  customs_processing: {
    title: "Your shipment is with customs",
    body: "Your shipment is currently undergoing customs processing. We will notify you when it clears and proceeds to local delivery.",
  },
  assigned: {
    title: "A driver has been assigned to your shipment",
    body: "Your package has been assigned to one of our drivers and will be picked up shortly.",
  },
  assigned_courier: {
    title: "A courier has been assigned",
    body: "A courier has been assigned to deliver your shipment and will contact you if necessary.",
  },
  picked_up: {
    title: "Your package has been picked up",
    body: "Your package has been picked up by our driver and is on its way to the next stage of its journey.",
  },
  delivered_by_courier: {
    title: "Your package was delivered by courier",
    body: "Your package was handed to the courier for final delivery. We'll confirm once delivery is complete.",
  },
  delivery_confirmed: {
    title: "Delivery confirmed",
    body: "Delivery has been confirmed. Thank you for using CityBike Logistics.",
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
  const trackingUrl = getTrackingUrl(trackingNumber);

  return {
    subject: `${info.title} (#${trackingNumber})`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #1f2937;">
        <h1 style="color: #f97316;">${info.title}</h1>
        <p>Hi ${name},</p>
        <p>${info.body}</p>
        <p>Tracking number: <strong>#${trackingNumber}</strong></p>
        <p style="margin: 20px 0;">
          <a href="${trackingUrl}" style="background-color: #ea580c; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">
            Track Your Package
          </a>
        </p>
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
  const trackingUrl = getTrackingUrl(trackingNumber);
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
        <p style="margin: 20px 0;">
          <a href="${trackingUrl}" style="background-color: #ea580c; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">
            View Tracking Page
          </a>
        </p>
        <p>Log in to the admin dashboard to confirm this order and assign a driver.</p>
        <p><strong>CityBike Logistics System</strong></p>
      </div>
    `,
  };
}

export function getQuoteRequestCustomerEmail(params: {
  name: string;
  route: string;
  cargoType: string;
  shippingSpeed: string;
  approxWeight: string;
  phoneCount: number;
  laptopCount: number;
  notes: string;
}) {
  return {
    subject: "Your CityBike shipment quote request has been received",
    html: `
      <div style="background-color: #f4f1ee; padding: 36px 20px; font-family: Arial, sans-serif; color: #1f2937;">
        <div style="max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 22px; border: 1px solid #e9e0db; overflow: hidden; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);">
          <div style="background: linear-gradient(135deg, #111827 0%, #1f2937 100%); padding: 24px 28px;">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 16px;">
              <div>
                <p style="margin: 0; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: #f7b38f; font-weight: 700;">
                  CityBike Logistics
                </p>
              </div>
              <div style="padding: 6px 10px; border-radius: 999px; background: rgba(249, 115, 22, 0.14); color: #fbbf24; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;">
                Quote Received
              </div>
            </div>
          </div>

          <div style="padding: 28px;">
            <p style="margin: 0 0 8px; font-size: 16px; color: #374151;">Hi ${params.name},</p>
            <h1 style="margin: 0 0 14px; color: #111827; font-size: 30px; line-height: 1.2;">
              Your shipment quote request is in.
            </h1>
            <p style="margin: 0; font-size: 16px; line-height: 1.7; color: #4b5563;">
              Thanks for reaching out to CityBike Logistics. We have received your request and our team will review the details below shortly.
            </p>

            <div style="margin-top: 24px; background: #fff7f2; border: 1px solid #f7d8c8; border-radius: 18px; padding: 20px;">
              <p style="margin: 0 0 14px; font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; color: #9a4d2a; font-weight: 700;">
                Shipment summary
              </p>

              <div style="display: grid; gap: 10px;">
                <div style="display: flex; justify-content: space-between; gap: 16px; padding-bottom: 8px; border-bottom: 1px solid #f3ddd0;">
                  <span style="color: #6b7280;">Route</span>
                  <strong style="color: #111827; text-align: right;">${params.route}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; gap: 16px; padding-bottom: 8px; border-bottom: 1px solid #f3ddd0;">
                  <span style="color: #6b7280;">Cargo type</span>
                  <strong style="color: #111827; text-align: right;">${params.cargoType}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; gap: 16px; padding-bottom: 8px; border-bottom: 1px solid #f3ddd0;">
                  <span style="color: #6b7280;">Shipping speed</span>
                  <strong style="color: #111827; text-align: right;">${params.shippingSpeed}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; gap: 16px; padding-bottom: 8px; border-bottom: 1px solid #f3ddd0;">
                  <span style="color: #6b7280;">Approx. weight</span>
                  <strong style="color: #111827; text-align: right;">${params.approxWeight} kg</strong>
                </div>
                <div style="display: flex; justify-content: space-between; gap: 16px; padding-bottom: 8px; border-bottom: 1px solid #f3ddd0;">
                  <span style="color: #6b7280;">Phones</span>
                  <strong style="color: #111827; text-align: right;">${params.phoneCount}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; gap: 16px;">
                  <span style="color: #6b7280;">Laptops</span>
                  <strong style="color: #111827; text-align: right;">${params.laptopCount}</strong>
                </div>
              </div>
            </div>

            ${
              params.notes
                ? `<div style="margin-top: 20px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 16px; padding: 18px;">
                    <p style="margin: 0 0 8px; font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; color: #6b7280; font-weight: 700;">Additional details</p>
                    <p style="margin: 0; font-size: 15px; line-height: 1.7; color: #374151;">${params.notes}</p>
                  </div>`
                : ""
            }

            <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #ece4e1;">
              <p style="margin: 0 0 10px; font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; color: #6b7280; font-weight: 700;">
                What happens next?
              </p>
              <p style="margin: 0; font-size: 16px; line-height: 1.7; color: #4b5563;">
                Our team will review your request and get back to you shortly by email with the best available option.
              </p>
            </div>
          </div>

          <div style="background: #faf7f5; border-top: 1px solid #eee4df; padding: 18px 28px; text-align: center; font-size: 12px; color: #6b7280;">
            CityBike Logistics • Support Team
          </div>
        </div>
      </div>
    `,
  };
}

export function getQuoteRequestAdminEmail(params: {
  customerName: string;
  customerEmail: string;
  phone: string;
  route: string;
  cargoType: string;
  shippingSpeed: string;
  approxWeight: string;
  phoneCount: number;
  laptopCount: number;
  notes: string;
}) {
  return {
    subject: `New shipment quote request from ${params.customerName}`,
    html: `
      <div style="background-color: #f4f1ee; padding: 36px 20px; font-family: Arial, sans-serif; color: #1f2937;">
        <div style="max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 22px; border: 1px solid #e9e0db; overflow: hidden; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);">
          <div style="background: linear-gradient(135deg, #111827 0%, #1f2937 100%); padding: 24px 28px;">
            <p style="margin: 0; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: #f7b38f; font-weight: 700;">
              CityBike Logistics Admin
            </p>
          </div>

          <div style="padding: 28px;">
            <h1 style="margin: 0 0 12px; color: #111827; font-size: 28px; line-height: 1.2;">
              New shipment quote request
            </h1>
            <p style="margin: 0 0 18px; font-size: 16px; line-height: 1.7; color: #4b5563;">
              A new quote request has been submitted through the website.
            </p>

            <div style="background: #fff7f2; border: 1px solid #f7d8c8; border-radius: 18px; padding: 20px;">
              <div style="display: grid; gap: 10px;">
                <div style="display: flex; justify-content: space-between; gap: 16px; padding-bottom: 8px; border-bottom: 1px solid #f3ddd0;">
                  <span style="color: #6b7280;">Customer</span>
                  <strong style="color: #111827; text-align: right;">${params.customerName}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; gap: 16px; padding-bottom: 8px; border-bottom: 1px solid #f3ddd0;">
                  <span style="color: #6b7280;">Email</span>
                  <strong style="color: #111827; text-align: right;">${params.customerEmail}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; gap: 16px; padding-bottom: 8px; border-bottom: 1px solid #f3ddd0;">
                  <span style="color: #6b7280;">Phone</span>
                  <strong style="color: #111827; text-align: right;">${params.phone || "Not provided"}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; gap: 16px; padding-bottom: 8px; border-bottom: 1px solid #f3ddd0;">
                  <span style="color: #6b7280;">Route</span>
                  <strong style="color: #111827; text-align: right;">${params.route}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; gap: 16px; padding-bottom: 8px; border-bottom: 1px solid #f3ddd0;">
                  <span style="color: #6b7280;">Cargo type</span>
                  <strong style="color: #111827; text-align: right;">${params.cargoType}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; gap: 16px; padding-bottom: 8px; border-bottom: 1px solid #f3ddd0;">
                  <span style="color: #6b7280;">Shipping speed</span>
                  <strong style="color: #111827; text-align: right;">${params.shippingSpeed}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; gap: 16px; padding-bottom: 8px; border-bottom: 1px solid #f3ddd0;">
                  <span style="color: #6b7280;">Approx. weight</span>
                  <strong style="color: #111827; text-align: right;">${params.approxWeight} kg</strong>
                </div>
                <div style="display: flex; justify-content: space-between; gap: 16px; padding-bottom: 8px; border-bottom: 1px solid #f3ddd0;">
                  <span style="color: #6b7280;">Phones</span>
                  <strong style="color: #111827; text-align: right;">${params.phoneCount}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; gap: 16px;">
                  <span style="color: #6b7280;">Laptops</span>
                  <strong style="color: #111827; text-align: right;">${params.laptopCount}</strong>
                </div>
              </div>
            </div>

            ${
              params.notes
                ? `<div style="margin-top: 20px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 16px; padding: 18px;">
                    <p style="margin: 0 0 8px; font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; color: #6b7280; font-weight: 700;">Additional details</p>
                    <p style="margin: 0; font-size: 15px; line-height: 1.7; color: #374151;">${params.notes}</p>
                  </div>`
                : ""
            }

            <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #ece4e1;">
              <p style="margin: 0; font-size: 16px; line-height: 1.7; color: #4b5563;">
                Please respond to the customer using the email above.
              </p>
            </div>
          </div>

          <div style="background: #faf7f5; border-top: 1px solid #eee4df; padding: 18px 28px; text-align: center; font-size: 12px; color: #6b7280;">
            CityBike Logistics System
          </div>
        </div>
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