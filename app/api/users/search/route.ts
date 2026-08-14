import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/libs/mongodb";
import User from "@/models/User";
import { getUserFromRequest } from "@/libs/auth";

export async function GET(req: NextRequest) {
  const auth = getUserFromRequest(req);
  if (!auth || auth.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const q = String(req.nextUrl.searchParams.get("q") || "").trim();
  if (!q) return NextResponse.json({ users: [] });

  try {
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const users = await User.find({ $or: [{ name: regex }, { email: regex }] })
      .limit(10)
      .select("_id name email phone")
      .lean();
    return NextResponse.json({ users });
  } catch (err) {
    console.error("user search failed", err);
    return NextResponse.json({ users: [] });
  }
}
