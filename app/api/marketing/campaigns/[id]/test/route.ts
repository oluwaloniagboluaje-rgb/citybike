import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/libs/mongodb";
import MarketingCampaign from "@/models/marketingCampaign";
import User from "@/models/User";
import {
  authorizeMarketingAdmin,
  marketingAuthError,
} from "@/libs/marketingAdmin";
import { sendMarketingTestEmail } from "@/libs/marketingDelivery";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await authorizeMarketingAdmin(request);
    if (!auth.ok) return marketingAuthError(auth);
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    }

    await connectDB();
    const [campaign, admin] = await Promise.all([
      MarketingCampaign.findById(id).lean(),
      User.findById(auth.userId).select("email").lean(),
    ]);
    if (!campaign || !admin?.email) {
      return NextResponse.json(
        { error: "Campaign or administrator email not found." },
        { status: 404 }
      );
    }

    await sendMarketingTestEmail(campaign, admin.email);
    return NextResponse.json({ success: true, recipient: admin.email });
  } catch (error) {
    console.error("Marketing test email failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not send test email.",
      },
      { status: 502 }
    );
  }
}
