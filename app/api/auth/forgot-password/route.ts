import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/libs/mongodb";
import User from "@/models/User";
import {
  generateResetToken,
  hashResetToken,
  RESET_TOKEN_EXPIRY_MS,
} from "@/libs/auth";
import { sendMail, getPasswordResetEmail } from "@/libs/mailer";
import { z } from "zod";

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();
    const parsed = forgotPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const { email } = parsed.data;
    const user = await User.findOne({ email });

    // Always return a generic success message, whether or not the email
    // exists — this prevents attackers from using this endpoint to check
    // which emails are registered.
    const genericResponse = NextResponse.json({
      message:
        "If an account exists with that email, a password reset link has been sent.",
    });

    if (!user) {
      return genericResponse;
    }

    const rawToken = generateResetToken();
    user.resetPasswordTokenHash = hashResetToken(rawToken);
    user.resetPasswordExpires = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);
    await user.save();

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
    const resetUrl = `${baseUrl}/reset-password?token=${rawToken}&email=${encodeURIComponent(
      user.email
    )}`;

    try {
      const resetEmail = getPasswordResetEmail(user.name, resetUrl);
      await sendMail({
        to: user.email,
        subject: resetEmail.subject,
        html: resetEmail.html,
      });
    } catch (mailError) {
      console.error("Password reset email failed:", mailError);
    }

    return genericResponse;
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}