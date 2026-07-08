import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/libs/mongodb";
import User from "@/models/User";
import { getUserFromRequest } from "@/libs/auth";

export async function GET(req: NextRequest) {
  const auth = getUserFromRequest(req);
  if (!auth || auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectDB();

  const drivers = await User.find({ role: "driver" })
    .select("name phone email vehicleType isAvailable")
    .sort({ name: 1 })
    .lean();

  return NextResponse.json({ drivers });
}