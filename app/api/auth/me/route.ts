import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, getUserFromRequest } from "@/libs/auth";
import { connectDB } from "@/libs/mongodb";
import User from "@/models/User";

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  await connectDB();

  const dbUser = await User.findById(user.userId)
    .select("name email role isActive")
    .lean();

  if (!dbUser || dbUser.isActive === false) {
    const res = NextResponse.json({ user: null }, { status: 200 });
    res.cookies.set(AUTH_COOKIE_NAME, "", {
      httpOnly: true,
      path: "/",
      maxAge: 0,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    return res;
  }

  return NextResponse.json({
    user: {
      userId: dbUser._id.toString(),
      role: dbUser.role,
      name: dbUser.name,
      email: dbUser.email,
    },
  });
}