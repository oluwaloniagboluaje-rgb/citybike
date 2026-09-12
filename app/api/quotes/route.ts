import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/libs/mongodb";
import User from "@/models/User";
import {
  getQuoteRequestAdminEmail,
  getQuoteRequestCustomerEmail,
  sendMail,
} from "@/libs/mailer";

const quoteSchema = z.object({
  name: z.string().min(1, "Full name is required."),
  email: z.string().email("Please provide a valid email address."),
  phone: z.string().optional().default(""),
  route: z.string().min(1, "Please choose a shipping route."),
  cargoType: z.string().min(1, "Please choose a cargo type."),
  shippingSpeed: z.string().min(1, "Please choose a shipping speed."),
  approxWeight: z
    .union([z.number(), z.string()])
    .transform((value) => String(value || 0))
    .default("1"),
  phoneCount: z
    .union([z.number(), z.string()])
    .transform((value) => Number(value || 0))
    .default(0),
  laptopCount: z
    .union([z.number(), z.string()])
    .transform((value) => Number(value || 0))
    .default(0),
  notes: z.string().optional().default(""),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = quoteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid quote request" },
        { status: 400 }
      );
    }

    const quote = parsed.data;

    await connectDB();

    const admins = await User.find({ role: "admin" }).select("email name").lean();

    const customerEmail = getQuoteRequestCustomerEmail({
      name: quote.name,
      route: quote.route,
      cargoType: quote.cargoType,
      shippingSpeed: quote.shippingSpeed,
      approxWeight: quote.approxWeight,
      phoneCount: quote.phoneCount,
      laptopCount: quote.laptopCount,
      notes: quote.notes,
    });

    await sendMail({
      to: quote.email,
      subject: customerEmail.subject,
      html: customerEmail.html,
    });

    const adminEmail = getQuoteRequestAdminEmail({
      customerName: quote.name,
      customerEmail: quote.email,
      phone: quote.phone,
      route: quote.route,
      cargoType: quote.cargoType,
      shippingSpeed: quote.shippingSpeed,
      approxWeight: quote.approxWeight,
      phoneCount: quote.phoneCount,
      laptopCount: quote.laptopCount,
      notes: quote.notes,
    });

    await Promise.all(
      admins
        .filter((admin) => admin.email)
        .map((admin) =>
          sendMail({
            to: admin.email,
            subject: adminEmail.subject,
            html: adminEmail.html,
          }).catch((error) => {
            console.error(`Admin quote notification email to ${admin.email} failed:`, error);
          })
        )
    );

    return NextResponse.json({
      message:
        "Your quote request has been submitted successfully. A confirmation email is on its way.",
    });
  } catch (error) {
    console.error("Quote request failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Something went wrong while processing your quote request.",
      },
      { status: 500 }
    );
  }
}
