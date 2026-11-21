import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/libs/mongodb";
import User from "@/models/User";
import { verifyUnsubscribeToken } from "@/libs/marketingConsent";

export async function POST(request: NextRequest) {
  const token =
    request.nextUrl.searchParams.get("token") ||
    (await request.json().catch(() => null))?.token;
  if (typeof token !== "string") {
    return NextResponse.json({ error: "Invalid unsubscribe link." }, { status: 400 });
  }
  const userId = verifyUnsubscribeToken(token);
  if (!userId) {
    return NextResponse.json(
      { error: "This unsubscribe link is invalid or has expired." },
      { status: 400 }
    );
  }

  await connectDB();
  const result = await User.updateOne(
    { _id: userId, role: "customer" },
    {
      $set: {
        marketingConsent: false,
        marketingUnsubscribedAt: new Date(),
      },
    }
  );
  if (!result.matchedCount) {
    return NextResponse.json({ error: "Customer account not found." }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
