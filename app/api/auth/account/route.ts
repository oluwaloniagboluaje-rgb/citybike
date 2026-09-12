import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AUTH_COOKIE_NAME, getUserFromRequest } from "@/libs/auth";
import { connectDB } from "@/libs/mongodb";
import User from "@/models/User";

const accountActionSchema = z.object({
  action: z.enum(["deactivate", "delete"]),
});

export async function POST(req: NextRequest) {
  try {
    const auth = getUserFromRequest(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const parsed = accountActionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid account action" },
        { status: 400 }
      );
    }

    await connectDB();

    const user = await User.findById(auth.userId);
    if (!user) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    if (parsed.data.action === "deactivate") {
      user.isActive = false;
      user.deactivatedAt = new Date();
      await user.save();
    } else {
      await User.findByIdAndDelete(auth.userId);
    }

    const response = NextResponse.json({
      success: true,
      action: parsed.data.action,
    });

    response.cookies.set(AUTH_COOKIE_NAME, "", {
      httpOnly: true,
      path: "/",
      maxAge: 0,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return response;
  } catch (error) {
    console.error("Account action failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Something went wrong while updating your account",
      },
      { status: 500 }
    );
  }
}
