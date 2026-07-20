import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/libs/mongodb";
import User from "@/models/User";
import { hashPassword, hashResetToken } from "@/libs/auth";
import { z } from "zod";

const resetPasswordSchema = z.object({
  email: z.string().email(),
  token: z.string().min(1, "Reset token is required"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
});

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();
    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const { email, token, newPassword } = parsed.data;
    const tokenHash = hashResetToken(token);

    const user = await User.findOne({
      email,
      resetPasswordTokenHash: tokenHash,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      return NextResponse.json(
        { error: "This reset link is invalid or has expired. Please request a new one." },
        { status: 400 }
      );
    }

    user.password = await hashPassword(newPassword);
    user.resetPasswordTokenHash = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return NextResponse.json({
      message: "Your password has been reset. You can now log in.",
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}