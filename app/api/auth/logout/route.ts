import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/libs/auth";

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  return res;
}