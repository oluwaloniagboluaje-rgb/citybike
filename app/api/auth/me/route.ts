import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/libs/auth";

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ user: null }, { status: 200 });
  }
  return NextResponse.json({ user });
}