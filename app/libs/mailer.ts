import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT ?? "");
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const FROM_EMAIL = process.env.FROM_EMAIL || "no-reply@citybike.co";

function createTransporter() {
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
  const transporter = createTransporter();
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
