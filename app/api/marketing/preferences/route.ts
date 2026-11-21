import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/libs/mongodb";
import { getUserFromRequest } from "@/libs/auth";
import User from "@/models/User";
import { z } from "zod";

const preferenceSchema = z.object({
  marketingConsent: z.boolean(),
});

export async function GET(request: NextRequest) {
  const auth = getUserFromRequest(request);
  if (!auth || auth.role !== "customer") {
    return NextResponse.json({ error: "Customer sign-in required." }, { status: 401 });
  }
  await connectDB();
  const customer = await User.findById(auth.userId)
    .select("role isActive marketingConsent marketingConsentAt marketingUnsubscribedAt")
    .lean();
  if (!customer || customer.role !== "customer" || customer.isActive === false) {
    return NextResponse.json({ error: "Customer account not found." }, { status: 404 });
  }
  return NextResponse.json({
    marketingConsent: !customer.marketingUnsubscribedAt,
    marketingConsentAt: customer.marketingConsentAt || null,
  });
}

export async function POST(request: NextRequest) {
  const auth = getUserFromRequest(request);
  if (!auth || auth.role !== "customer") {
    return NextResponse.json({ error: "Customer sign-in required." }, { status: 401 });
  }
  const parsed = preferenceSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid marketing preference." }, { status: 400 });
  }

  await connectDB();
  const update = parsed.data.marketingConsent
    ? {
        $set: {
          marketingConsent: true,
          marketingConsentAt: new Date(),
        },
        $unset: { marketingUnsubscribedAt: 1 },
      }
    : {
        $set: {
          marketingConsent: false,
          marketingUnsubscribedAt: new Date(),
        },
      };
  const result = await User.updateOne(
    {
      _id: auth.userId,
      role: "customer",
      isActive: { $ne: false },
    },
    update
  );
  if (!result.matchedCount) {
    return NextResponse.json({ error: "Customer account not found." }, { status: 404 });
  }
  return NextResponse.json({ marketingConsent: parsed.data.marketingConsent });
}
