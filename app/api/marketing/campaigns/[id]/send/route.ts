import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectDB } from "@/libs/mongodb";
import MarketingCampaign from "@/models/marketingCampaign";
import {
  authorizeMarketingAdmin,
  marketingAuthError,
} from "@/libs/marketingAdmin";
import { processCampaignBatch } from "@/libs/marketingDelivery";

const sendSchema = z.object({
  scheduledAt: z.string().datetime().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await authorizeMarketingAdmin(request);
    if (!auth.ok) return marketingAuthError(auth);
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = sendSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid schedule time." },
        { status: 400 }
      );
    }
    await connectDB();
    const campaignToSend = await MarketingCampaign.findById(id).lean();
    if (!campaignToSend) {
      return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    }
    if (
      campaignToSend.audienceType === "selected_customers" &&
      campaignToSend.customerIds.length === 0
    ) {
      return NextResponse.json(
        { error: "Select at least one customer before sending." },
        { status: 400 }
      );
    }
    if (
      campaignToSend.audienceType === "locations" &&
      campaignToSend.countries.length === 0 &&
      campaignToSend.cities.length === 0
    ) {
      return NextResponse.json(
        { error: "Choose at least one customer location before sending." },
        { status: 400 }
      );
    }

    const requestedDate = parsed.data.scheduledAt
      ? new Date(parsed.data.scheduledAt)
      : new Date();
    const isScheduled = requestedDate.getTime() > Date.now() + 60_000;
    if (
      isScheduled &&
      requestedDate.getTime() > Date.now() + 365 * 24 * 60 * 60 * 1000
    ) {
      return NextResponse.json(
        { error: "Campaigns cannot be scheduled more than one year ahead." },
        { status: 400 }
      );
    }

    const campaign = await MarketingCampaign.findOneAndUpdate(
      { _id: id, status: { $in: ["draft", "scheduled"] } },
      {
        $set: {
          status: "scheduled",
          scheduledAt: isScheduled ? requestedDate : new Date(),
          lastError: "",
          recipientCount: 0,
          sentCount: 0,
          deliveredCount: 0,
          bouncedCount: 0,
          failedCount: 0,
          skippedCount: 0,
          openedCount: 0,
          clickedCount: 0,
          batchNumber: 0,
        },
      },
      { new: true }
    );
    if (!campaign) {
      return NextResponse.json(
        { error: "Only draft or scheduled campaigns can be sent." },
        { status: 409 }
      );
    }

    if (isScheduled) {
      return NextResponse.json({
        campaign,
        message: "Campaign scheduled successfully.",
      });
    }

    const result = await processCampaignBatch(id);
    const updatedCampaign = await MarketingCampaign.findById(id).lean();
    if (result.status === "failed") {
      return NextResponse.json(
        {
          error:
            updatedCampaign?.lastError ||
            "No active, subscribed customers were found.",
          campaign: updatedCampaign,
        },
        { status: 400 }
      );
    }
    if (result.error) {
      return NextResponse.json(
        {
          error: result.error,
          campaign: updatedCampaign,
          message: "Campaign remains queued and will retry in a later batch.",
        },
        { status: 502 }
      );
    }
    return NextResponse.json({
      campaign: updatedCampaign,
      message: "Campaign queued and the first batch was processed.",
    });
  } catch (error) {
    console.error("Marketing campaign send failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not start campaign delivery.",
      },
      { status: 502 }
    );
  }
}
