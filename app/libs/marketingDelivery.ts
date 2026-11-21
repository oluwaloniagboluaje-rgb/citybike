import { Resend } from "resend";
import MarketingCampaign from "@/models/marketingCampaign";
import MarketingCampaignRecipient from "@/models/marketingCampaignRecipient";
import { connectDB } from "@/libs/mongodb";
import User from "@/models/User";
import { createUnsubscribeToken } from "@/libs/marketingConsent";
import {
  findEligibleCustomerPage,
  type MarketingAudience,
} from "@/libs/marketingRecipients";
import {
  getCampaignPlainText,
  marketingAppUrl,
  renderMarketingEmail,
} from "@/libs/marketingEmail";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL;
const BATCH_SIZE = 100;
const MAX_ATTEMPTS = 5;
const WORKER_LOCK_MS = 5 * 60 * 1000;

let resendClient: Resend | null = null;

function getResendClient(): Resend {
  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) {
    throw new Error(
      "Marketing email delivery requires RESEND_API_KEY and RESEND_FROM_EMAIL. Configure them in the hosting environment."
    );
  }
  if (!resendClient) resendClient = new Resend(RESEND_API_KEY);
  return resendClient;
}

export interface CampaignEmailContent {
  name: string;
  subject: string;
  message: string;
  imageUrl?: string;
  imageLink?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  discountCode?: string;
}

function buildMessage(
  content: CampaignEmailContent,
  unsubscribeUrl: string
) {
  const html = renderMarketingEmail(content, unsubscribeUrl);
  const text = getCampaignPlainText(content, unsubscribeUrl);
  return { html, text };
}

export async function sendMarketingTestEmail(
  content: CampaignEmailContent,
  recipient: string
): Promise<void> {
  const resend = getResendClient();
  const { html, text } = buildMessage(content, "#unsubscribe");
  const response = await resend.emails.send({
    from: `CityBike Logistics <${RESEND_FROM_EMAIL}>`,
    to: recipient,
    subject: `[TEST] ${content.subject}`,
    html,
    text,
    tags: [{ name: "campaign_test", value: "true" }],
  });
  if (response.error) {
    throw new Error(response.error.message);
  }
}

async function prepareCampaign(campaignId: string): Promise<boolean> {
  const now = new Date();
  const campaign = await MarketingCampaign.findOneAndUpdate(
    {
      _id: campaignId,
      status: { $in: ["scheduled", "preparing"] },
      scheduledAt: { $lte: now },
      $or: [
        { workerLockedUntil: { $exists: false } },
        { workerLockedUntil: null },
        { workerLockedUntil: { $lt: now } },
      ],
    },
    {
      $set: {
        status: "preparing",
        workerLockedUntil: new Date(now.getTime() + WORKER_LOCK_MS),
      },
    },
    { new: true }
  );
  if (!campaign) return false;

  try {
    const audience: MarketingAudience = {
      type: campaign.audienceType,
      customerIds: campaign.customerIds.map(String),
      countries: campaign.countries,
      cities: campaign.cities,
    };
    let afterId = "";
    while (true) {
      const { customers } = await findEligibleCustomerPage({
        page: 1,
        pageSize: 500,
        previousCustomersOnly: audience.type === "previous_customers",
        search: "",
        afterId,
        audience,
      });
      if (!customers.length) break;

      await MarketingCampaignRecipient.bulkWrite(
        customers.map((recipient) => ({
          updateOne: {
            filter: { campaign: campaign._id, user: recipient._id },
            update: {
              $setOnInsert: {
                campaign: campaign._id,
                user: recipient._id,
                email: recipient.email,
                name: recipient.name,
                status: "pending",
                attempts: 0,
              },
            },
            upsert: true,
          },
        })),
        { ordered: false }
      );
      afterId = customers[customers.length - 1]._id.toString();
    }
    const recipientCount = await MarketingCampaignRecipient.countDocuments({
      campaign: campaign._id,
    });

    if (!recipientCount) {
      await MarketingCampaign.updateOne(
        { _id: campaign._id, status: "preparing" },
        {
          $set: {
            status: "failed",
            recipientCount: 0,
            lastError: "No active, subscribed customer accounts were found.",
          },
          $unset: { workerLockedUntil: 1 },
        }
      );
      return false;
    }

    await MarketingCampaign.updateOne(
      { _id: campaign._id, status: "preparing" },
      {
        $set: {
          status: "queued",
          recipientCount,
          lastError: "",
        },
        $unset: { workerLockedUntil: 1 },
      }
    );
    return true;
  } catch (error) {
    await MarketingCampaign.updateOne(
      { _id: campaign._id, status: "preparing" },
      {
        $set: {
          status: "scheduled",
          lastError:
            error instanceof Error ? error.message : "Could not prepare campaign recipients.",
        },
        $unset: { workerLockedUntil: 1 },
      }
    );
    throw error;
  }
}

export async function processCampaignBatch(
  campaignId: string
): Promise<{ processed: number; status: string; error?: string }> {
  await connectDB();
  const id = campaignId;
  let campaign = await MarketingCampaign.findById(id);
  if (
    campaign &&
    ["scheduled", "preparing"].includes(campaign.status) &&
    campaign.scheduledAt &&
    campaign.scheduledAt <= new Date()
  ) {
    await prepareCampaign(id);
  }

  const now = new Date();
  campaign = await MarketingCampaign.findOneAndUpdate(
    {
      _id: id,
      status: { $in: ["queued", "sending"] },
      $or: [
        { workerLockedUntil: { $exists: false } },
        { workerLockedUntil: null },
        { workerLockedUntil: { $lt: now } },
      ],
    },
    {
      $set: {
        status: "sending",
        workerLockedUntil: new Date(now.getTime() + WORKER_LOCK_MS),
      },
    },
    { new: true }
  );
  if (!campaign) {
    const current = await MarketingCampaign.findById(id).select("status").lean();
    return { processed: 0, status: current?.status || "not_found" };
  }

  const pending = await MarketingCampaignRecipient.find({
    campaign: campaign._id,
    $or: [
      { status: "pending" },
      {
        status: "processing",
        updatedAt: { $lt: new Date(Date.now() - WORKER_LOCK_MS) },
      },
    ],
  })
    .sort({ _id: 1 })
    .limit(BATCH_SIZE)
    .lean();

  if (!pending.length) {
    const remaining = await MarketingCampaignRecipient.countDocuments({
      campaign: campaign._id,
      status: { $in: ["pending", "processing"] },
    });
    const failed = await MarketingCampaignRecipient.countDocuments({
      campaign: campaign._id,
      status: "failed",
    });
    const sentAt = remaining === 0 ? new Date() : undefined;
    await MarketingCampaign.updateOne(
      { _id: campaign._id },
      {
        $set: {
              status:
                remaining > 0
                  ? "queued"
                  : failed > 0
                    ? failed === campaign.recipientCount
                      ? "failed"
                      : "partial"
                    : campaign.sentCount > 0
                      ? "sent"
                      : "failed",
          ...(sentAt ? { sentAt } : {}),
        },
        $unset: { workerLockedUntil: 1 },
      }
    );
    return { processed: 0, status: remaining > 0 ? "queued" : failed ? "partial" : "sent" };
  }

  const currentUsers = await User.find({
    _id: { $in: pending.map((recipient) => recipient.user) },
    role: "customer",
    isActive: { $ne: false },
    $or: [
      { marketingUnsubscribedAt: { $exists: false } },
      { marketingUnsubscribedAt: null },
    ],
  })
    .select("_id")
    .lean();
  const eligibleUserIds = new Set(
    currentUsers.map((user) => user._id.toString())
  );
  const skipped = pending.filter(
    (recipient) => !eligibleUserIds.has(recipient.user.toString())
  );
  if (skipped.length) {
    await MarketingCampaignRecipient.updateMany(
      { _id: { $in: skipped.map((recipient) => recipient._id) } },
      {
        $set: {
          status: "skipped",
          lastError: "Customer unsubscribed before this send.",
        },
      }
    );
    await MarketingCampaign.updateOne(
      { _id: campaign._id },
      { $inc: { skippedCount: skipped.length } }
    );
  }
  const eligiblePending = pending.filter((recipient) =>
    eligibleUserIds.has(recipient.user.toString())
  );
  if (!eligiblePending.length) {
    await MarketingCampaign.updateOne(
      { _id: campaign._id },
      { $unset: { workerLockedUntil: 1 }, $set: { status: "queued" } }
    );
    return { processed: 0, status: "queued" };
  }
  const recipientIds = eligiblePending.map((recipient) => recipient._id);
  await MarketingCampaignRecipient.updateMany(
    { _id: { $in: recipientIds } },
    { $set: { status: "processing" }, $inc: { attempts: 1 } }
  );

  try {
    const resend = getResendClient();
    const batch = await resend.batch.send(
      eligiblePending.map((recipient) => {
        const unsubscribeToken = createUnsubscribeToken(recipient.user.toString());
        const unsubscribeUrl = marketingAppUrl(
          `/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`
        );
        const oneClickUnsubscribeUrl = marketingAppUrl(
          `/api/marketing/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`
        );
        const { html, text } = buildMessage(campaign, unsubscribeUrl);
        return {
          from: `CityBike Logistics <${RESEND_FROM_EMAIL}>`,
          to: recipient.email,
          subject: campaign.subject,
          html,
          text,
          headers: {
            "List-Unsubscribe": `<${oneClickUnsubscribeUrl}>, <mailto:info@citybikelogistics.com?subject=Unsubscribe>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
          tags: [
            { name: "campaign_id", value: campaign._id.toString() },
            { name: "recipient_id", value: recipient._id.toString() },
          ],
        };
      }),
      { idempotencyKey: `citybike-campaign-${campaign._id}-${campaign.batchNumber}` }
    );

    if (batch.error) {
      throw new Error(batch.error.message);
    }
    const emailIds = batch.data?.data || [];
    if (emailIds.length !== eligiblePending.length) {
      throw new Error("Email provider returned an incomplete batch response.");
    }

    const sentAt = new Date();
    await MarketingCampaignRecipient.bulkWrite(
      eligiblePending.flatMap((recipient, index) => [
        {
          updateOne: {
            filter: { _id: recipient._id, status: "processing" },
            update: {
              $set: {
                status: "sent",
                sentAt,
                providerEmailId: emailIds[index].id,
                lastError: "",
              },
            },
          },
        },
        {
          updateOne: {
            filter: {
              _id: recipient._id,
              status: { $in: ["delivered", "bounced", "failed"] },
            },
            update: {
              $set: {
                sentAt,
                providerEmailId: emailIds[index].id,
              },
            },
          },
        },
      ])
    );
    await MarketingCampaign.updateOne(
      { _id: campaign._id },
      {
        $inc: { sentCount: emailIds.length, batchNumber: 1 },
        $unset: { workerLockedUntil: 1, lastError: 1 },
      }
    );

    const remaining = await MarketingCampaignRecipient.countDocuments({
      campaign: campaign._id,
      status: { $in: ["pending", "processing"] },
    });
    if (remaining === 0) {
      const failed = await MarketingCampaignRecipient.countDocuments({
        campaign: campaign._id,
        status: "failed",
      });
      await MarketingCampaign.updateOne(
        { _id: campaign._id },
        {
          $set: {
            status: failed
              ? failed === campaign.recipientCount
                ? "failed"
                : "partial"
              : "sent",
            sentAt: new Date(),
          },
        }
      );
    } else {
      await MarketingCampaign.updateOne(
        { _id: campaign._id },
        { $set: { status: "queued" } }
      );
    }
    return {
      processed: emailIds.length,
      status:
        remaining === 0
          ? campaign.failedCount
            ? "partial"
            : campaign.sentCount + emailIds.length > 0
              ? "sent"
              : "failed"
          : "queued",
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Email provider batch failed.";
    console.error(`Marketing email batch failed for campaign ${campaign._id}:`, error);
    const reachedMaxAttempts = eligiblePending.filter(
      (recipient) => (recipient.attempts || 0) + 1 >= MAX_ATTEMPTS
    );
    const retryableIds = eligiblePending
      .filter((recipient) => !reachedMaxAttempts.includes(recipient))
      .map((recipient) => recipient._id);
    const failedIds = reachedMaxAttempts.map((recipient) => recipient._id);

    if (retryableIds.length) {
      await MarketingCampaignRecipient.updateMany(
        { _id: { $in: retryableIds }, status: "processing" },
        { $set: { status: "pending", lastError: errorMessage } }
      );
    }
    if (failedIds.length) {
      await MarketingCampaignRecipient.updateMany(
        { _id: { $in: failedIds }, status: "processing" },
        {
          $set: { status: "failed", failedAt: new Date(), lastError: errorMessage },
        }
      );
      await MarketingCampaign.updateOne(
        { _id: campaign._id },
        { $inc: { failedCount: failedIds.length } }
      );
    }
    await MarketingCampaign.updateOne(
      { _id: campaign._id },
      {
        $set: { status: "queued", lastError: errorMessage },
        $unset: { workerLockedUntil: 1 },
      }
    );
    return { processed: 0, status: "queued", error: errorMessage };
  }
}

export async function processDueMarketingCampaigns(): Promise<{
  processedCampaigns: number;
  sentEmails: number;
}> {
  await connectDB();
  const now = new Date();
  const due = await MarketingCampaign.find({
    $or: [
      { status: "queued" },
      { status: "sending" },
      { status: "scheduled", scheduledAt: { $lte: now } },
      {
        status: "preparing",
        scheduledAt: { $lte: now },
        workerLockedUntil: { $lt: now },
      },
    ],
  })
    .select("_id")
    .sort({ scheduledAt: 1, createdAt: 1 })
    .limit(25)
    .lean();

  let sentEmails = 0;
  let processedCampaigns = 0;
  for (const campaign of due) {
    const result = await processCampaignBatch(campaign._id.toString());
    sentEmails += result.processed;
    processedCampaigns += 1;
  }
  return { processedCampaigns, sentEmails };
}

export function getMarketingWorkerAuthorization(
  authorization: string | null
): boolean {
  const secret = process.env.CRON_SECRET;
  return !!secret && authorization === `Bearer ${secret}`;
}

