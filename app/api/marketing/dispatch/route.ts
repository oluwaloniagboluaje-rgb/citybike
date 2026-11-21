import { Receiver } from "@upstash/qstash";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/libs/mongodb";
import MarketingCampaign from "@/models/marketingCampaign";
import {
  getMarketingDispatchUrl,
  publishMarketingDispatch,
} from "@/libs/marketingQueue";
import { processCampaignBatch } from "@/libs/marketingDelivery";

const dispatchSchema = z.object({
  campaignId: z.string().regex(/^[a-f\d]{24}$/i),
  scheduledAt: z.number().int().positive(),
  batchNumber: z.number().int().nonnegative(),
});

function isActiveCampaignStatus(status: string) {
  return ["scheduled", "preparing", "queued", "sending"].includes(status);
}

export async function POST(request: NextRequest) {
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
  if (!currentSigningKey || !nextSigningKey) {
    return NextResponse.json(
      { error: "QStash signature verification is not configured." },
      { status: 503 }
    );
  }

  let dispatchUrl: string;
  try {
    dispatchUrl = getMarketingDispatchUrl();
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Campaign dispatch URL is not configured.",
      },
      { status: 503 }
    );
  }

  const body = await request.text();
  try {
    const receiver = new Receiver({
      currentSigningKey,
      nextSigningKey,
      devMode: false,
    });
    await receiver.verify({
      body,
      signature: request.headers.get("upstash-signature") || "",
      url: dispatchUrl,
    });
  } catch (error) {
    console.error("Marketing QStash signature verification failed:", error);
    return NextResponse.json({ error: "Invalid QStash signature." }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid campaign dispatch payload." }, { status: 400 });
  }
  const parsed = dispatchSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid campaign dispatch payload." }, { status: 400 });
  }

  try {
    await connectDB();
    const dispatch = parsed.data;
    let campaign = await MarketingCampaign.findById(dispatch.campaignId).lean();
    if (!campaign || campaign.scheduledAt?.getTime() !== dispatch.scheduledAt) {
      return NextResponse.json({ received: true, stale: true });
    }
    if (!isActiveCampaignStatus(campaign.status)) {
      return NextResponse.json({ received: true, complete: true });
    }

    if (dispatch.batchNumber < campaign.batchNumber) {
      if (["queued", "sending"].includes(campaign.status)) {
        await publishMarketingDispatch({
          dispatch: {
            ...dispatch,
            batchNumber: campaign.batchNumber,
          },
          notBefore: campaign.workerLockedUntil,
        });
      }
      return NextResponse.json({ received: true, stale: true });
    }
    if (dispatch.batchNumber > campaign.batchNumber) {
      return NextResponse.json(
        { error: "Campaign batch is not ready yet." },
        { status: 503, headers: { "Retry-After": "30" } }
      );
    }

    const scheduledAt = campaign.scheduledAt;
    if (campaign.status === "scheduled" && scheduledAt && scheduledAt > new Date()) {
      await publishMarketingDispatch({
        dispatch,
        notBefore: scheduledAt,
        retry: true,
      });
      return NextResponse.json({ received: true, rescheduled: true });
    }

    const result = await processCampaignBatch(
      dispatch.campaignId,
      dispatch.batchNumber
    );
    campaign = await MarketingCampaign.findById(dispatch.campaignId).lean();
    if (
      !campaign ||
      campaign.scheduledAt?.getTime() !== dispatch.scheduledAt ||
      !isActiveCampaignStatus(campaign.status)
    ) {
      return NextResponse.json({ received: true, complete: true });
    }

    if (campaign.status === "queued") {
      const madeProgress = campaign.batchNumber > dispatch.batchNumber;
      await publishMarketingDispatch({
        dispatch: {
          ...dispatch,
          batchNumber: campaign.batchNumber,
        },
        notBefore:
          result.error || !madeProgress
            ? new Date(Date.now() + 60_000)
            : undefined,
        retry: !!result.error || !madeProgress,
      });
      return NextResponse.json({
        received: true,
        status: campaign.status,
        nextBatch: campaign.batchNumber,
      });
    }

    if (campaign.status === "preparing" || campaign.status === "sending") {
      await publishMarketingDispatch({
        dispatch: {
          ...dispatch,
          batchNumber: campaign.batchNumber,
        },
        notBefore:
          campaign.workerLockedUntil || new Date(Date.now() + 60_000),
        retry: true,
      });
      return NextResponse.json({ received: true, status: campaign.status });
    }

    return NextResponse.json({ received: true, status: campaign.status });
  } catch (error) {
    console.error("Marketing QStash dispatch failed:", error);
    return NextResponse.json(
      { error: "Campaign dispatch could not be processed." },
      { status: 500 }
    );
  }
}
