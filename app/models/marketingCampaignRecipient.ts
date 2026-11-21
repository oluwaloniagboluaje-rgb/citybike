import mongoose, { Document, Schema, Types } from "mongoose";

export const CAMPAIGN_DELIVERY_STATUSES = [
  "pending",
  "processing",
  "sent",
  "delivered",
  "bounced",
  "failed",
  "skipped",
] as const;

export type CampaignDeliveryStatus =
  (typeof CAMPAIGN_DELIVERY_STATUSES)[number];

export interface IMarketingCampaignRecipient extends Document {
  campaign: Types.ObjectId;
  user: Types.ObjectId;
  email: string;
  name: string;
  status: CampaignDeliveryStatus;
  providerEmailId?: string;
  attempts: number;
  sentAt?: Date;
  deliveredAt?: Date;
  bouncedAt?: Date;
  failedAt?: Date;
  openedAt?: Date;
  clickedAt?: Date;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

const MarketingCampaignRecipientSchema =
  new Schema<IMarketingCampaignRecipient>(
    {
      campaign: {
        type: Schema.Types.ObjectId,
        ref: "MarketingCampaign",
        required: true,
        index: true,
      },
      user: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      email: { type: String, required: true, lowercase: true, trim: true },
      name: { type: String, required: true },
      status: {
        type: String,
        enum: CAMPAIGN_DELIVERY_STATUSES,
        default: "pending",
        required: true,
        index: true,
      },
      providerEmailId: { type: String, index: true, sparse: true },
      attempts: { type: Number, default: 0 },
      sentAt: Date,
      deliveredAt: Date,
      bouncedAt: Date,
      failedAt: Date,
      openedAt: Date,
      clickedAt: Date,
      lastError: String,
    },
    { timestamps: true }
  );

MarketingCampaignRecipientSchema.index(
  { campaign: 1, user: 1 },
  { unique: true }
);

const MarketingCampaignRecipient =
  mongoose.models.MarketingCampaignRecipient ||
  mongoose.model<IMarketingCampaignRecipient>(
    "MarketingCampaignRecipient",
    MarketingCampaignRecipientSchema
  );

export default MarketingCampaignRecipient;
