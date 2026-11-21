import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/libs/mongodb";
import MarketingCampaign from "@/models/marketingCampaign";
import {
  authorizeMarketingAdmin,
  marketingAuthError,
} from "@/libs/marketingAdmin";
import { marketingCampaignContentSchema } from "@/libs/marketingValidation";

export async function GET(request: NextRequest) {
  try {
    const auth = await authorizeMarketingAdmin(request);
    if (!auth.ok) return marketingAuthError(auth);
    await connectDB();

    const page = Math.max(
      1,
      Math.min(10000, Number(request.nextUrl.searchParams.get("page")) || 1)
    );
    const pageSize = 50;
    const [campaigns, total, totals] = await Promise.all([
      MarketingCampaign.find()
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .select(
          "name subject status scheduledAt sentAt recipientCount sentCount deliveredCount bouncedCount failedCount skippedCount openedCount clickedCount createdAt updatedAt lastError audienceType"
        )
        .lean(),
      MarketingCampaign.countDocuments(),
      MarketingCampaign.aggregate([
        {
          $group: {
            _id: null,
            sent: { $sum: "$sentCount" },
            delivered: { $sum: "$deliveredCount" },
            bounced: { $sum: "$bouncedCount" },
            failed: { $sum: "$failedCount" },
            opened: { $sum: "$openedCount" },
            clicked: { $sum: "$clickedCount" },
          },
        },
      ]),
    ]);
    return NextResponse.json({
      campaigns,
      total,
      page,
      pageSize,
      statistics: totals[0] || {
        sent: 0,
        delivered: 0,
        bounced: 0,
        failed: 0,
        opened: 0,
        clicked: 0,
      },
    });
  } catch (error) {
    console.error("Marketing campaign list failed:", error);
    return NextResponse.json(
      { error: "Could not load campaign history." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authorizeMarketingAdmin(request);
    if (!auth.ok) return marketingAuthError(auth);
    await connectDB();

    const parsed = marketingCampaignContentSchema.safeParse(
      await request.json()
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid campaign." },
        { status: 400 }
      );
    }

    const { audience, ...content } = parsed.data;
    if (
      audience.type === "selected_customers" &&
      audience.customerIds.length === 0
    ) {
      return NextResponse.json(
        { error: "Select at least one customer." },
        { status: 400 }
      );
    }
    if (
      audience.type === "locations" &&
      audience.countries.length === 0 &&
      audience.cities.length === 0
    ) {
      return NextResponse.json(
        { error: "Choose at least one customer location." },
        { status: 400 }
      );
    }

    const campaign = await MarketingCampaign.create({
      ...content,
      audienceType: audience.type,
      customerIds: audience.customerIds,
      countries: audience.countries,
      cities: audience.cities,
      status: "draft",
      createdBy: auth.userId,
    });
    return NextResponse.json({ campaign }, { status: 201 });
  } catch (error) {
    console.error("Marketing campaign creation failed:", error);
    return NextResponse.json(
      { error: "Could not save campaign draft." },
      { status: 500 }
    );
  }
}
