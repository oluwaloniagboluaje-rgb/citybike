import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { Resend } from "resend";
import { connectDB } from "@/libs/mongodb";
import MarketingCampaign from "@/models/marketingCampaign";
import MarketingCampaignRecipient from "@/models/marketingCampaignRecipient";

const EMAIL_EVENT_TYPES = new Set([
  "email.delivered",
  "email.bounced",
  "email.failed",
  "email.opened",
  "email.clicked",
]);

export async function POST(request: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY;
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (!apiKey || !webhookSecret) {
    return NextResponse.json(
      { error: "Email provider webhook is not configured." },
      { status: 503 }
    );
  }

  let event;
  try {
    const payload = await request.text();
    const resend = new Resend(apiKey);
    event = resend.webhooks.verify({
      payload,
      webhookSecret,
      headers: {
        id: request.headers.get("svix-id") || "",
        timestamp: request.headers.get("svix-timestamp") || "",
        signature: request.headers.get("svix-signature") || "",
      },
    });
  } catch (error) {
    console.error("Marketing provider webhook signature verification failed:", error);
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  if (!EMAIL_EVENT_TYPES.has(event.type)) {
    return NextResponse.json({ received: true });
  }
  if (!("email_id" in event.data) || !("tags" in event.data)) {
    return NextResponse.json({ received: true });
  }

  await connectDB();
  const recipientQueries: Array<{
    providerEmailId?: string;
    _id?: Types.ObjectId;
    campaign?: Types.ObjectId;
  }> = [{ providerEmailId: event.data.email_id }];
  const recipientTag = event.data.tags?.recipient_id;
  const campaignTag = event.data.tags?.campaign_id;
  if (
    recipientTag &&
    campaignTag &&
    Types.ObjectId.isValid(recipientTag) &&
    Types.ObjectId.isValid(campaignTag)
  ) {
    recipientQueries.push({
      _id: new Types.ObjectId(recipientTag),
      campaign: new Types.ObjectId(campaignTag),
    });
  }
  const recipient = await MarketingCampaignRecipient.findOne({
    $or: recipientQueries,
  }).select("_id campaign status deliveredAt bouncedAt failedAt openedAt clickedAt");
  if (!recipient) {
    return NextResponse.json({ received: true });
  }

  const increment: Record<string, number> = {};
  if (event.type === "email.delivered") {
    const result = await MarketingCampaignRecipient.updateOne(
      {
        _id: recipient._id,
        deliveredAt: { $exists: false },
        bouncedAt: { $exists: false },
        failedAt: { $exists: false },
      },
      { $set: { status: "delivered", deliveredAt: new Date(event.created_at) } }
    );
    if (result.modifiedCount) increment.deliveredCount = 1;
  } else if (event.type === "email.bounced") {
    const result = await MarketingCampaignRecipient.updateOne(
      {
        _id: recipient._id,
        deliveredAt: { $exists: false },
        bouncedAt: { $exists: false },
        failedAt: { $exists: false },
      },
      { $set: { status: "bounced", bouncedAt: new Date(event.created_at) } }
    );
    if (result.modifiedCount) increment.bouncedCount = 1;
  } else if (event.type === "email.failed") {
    const result = await MarketingCampaignRecipient.updateOne(
      {
        _id: recipient._id,
        deliveredAt: { $exists: false },
        bouncedAt: { $exists: false },
        failedAt: { $exists: false },
      },
      {
        $set: {
          status: "failed",
          failedAt: new Date(event.created_at),
          lastError: event.data.failed.reason,
        },
      }
    );
    if (result.modifiedCount) increment.failedCount = 1;
  } else if (event.type === "email.opened") {
    const result = await MarketingCampaignRecipient.updateOne(
      { _id: recipient._id, openedAt: { $exists: false } },
      { $set: { openedAt: new Date(event.created_at) } }
    );
    if (result.modifiedCount) increment.openedCount = 1;
  } else if (event.type === "email.clicked") {
    const result = await MarketingCampaignRecipient.updateOne(
      { _id: recipient._id, clickedAt: { $exists: false } },
      { $set: { clickedAt: new Date(event.created_at) } }
    );
    if (result.modifiedCount) increment.clickedCount = 1;
  }

  if (Object.keys(increment).length) {
    await MarketingCampaign.updateOne(
      { _id: recipient.campaign },
      { $inc: increment }
    );
  }
  return NextResponse.json({ received: true });
}
