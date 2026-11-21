import mongoose, { Document, Schema, Types } from "mongoose";

export const MARKETING_AUDIENCE_TYPES = [
  "all_subscribers",
  "selected_customers",
  "locations",
  "previous_customers",
] as const;

export type MarketingAudienceType =
  (typeof MARKETING_AUDIENCE_TYPES)[number];

export const MARKETING_CAMPAIGN_STATUSES = [
  "draft",
  "scheduled",
  "preparing",
  "queued",
  "sending",
  "sent",
  "partial",
  "failed",
] as const;

export type MarketingCampaignStatus =
  (typeof MARKETING_CAMPAIGN_STATUSES)[number];

export interface IMarketingCampaign extends Document {
  name: string;
  subject: string;
  message: string;
  imageUrl?: string;
  imageLink?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  discountCode?: string;
  audienceType: MarketingAudienceType;
  customerIds: Types.ObjectId[];
  countries: string[];
  cities: string[];
  status: MarketingCampaignStatus;
  scheduledAt?: Date;
  sentAt?: Date;
  recipientCount: number;
  sentCount: number;
  deliveredCount: number;
  bouncedCount: number;
  failedCount: number;
  skippedCount: number;
  openedCount: number;
  clickedCount: number;
  batchNumber: number;
  workerLockedUntil?: Date;
  lastError?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const MarketingCampaignSchema = new Schema<IMarketingCampaign>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    subject: { type: String, required: true, trim: true, maxlength: 180 },
    message: { type: String, required: true, maxlength: 20000 },
    imageUrl: { type: String, trim: true, maxlength: 2048 },
    imageLink: { type: String, trim: true, maxlength: 2048 },
    ctaLabel: { type: String, trim: true, maxlength: 60 },
    ctaUrl: { type: String, trim: true, maxlength: 2048 },
    discountCode: { type: String, trim: true, maxlength: 80 },
    audienceType: {
      type: String,
      enum: MARKETING_AUDIENCE_TYPES,
      required: true,
      default: "all_subscribers",
    },
    customerIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    countries: [{ type: String, trim: true }],
    cities: [{ type: String, trim: true }],
    status: {
      type: String,
      enum: MARKETING_CAMPAIGN_STATUSES,
      required: true,
      default: "draft",
      index: true,
    },
    scheduledAt: Date,
    sentAt: Date,
    recipientCount: { type: Number, default: 0 },
    sentCount: { type: Number, default: 0 },
    deliveredCount: { type: Number, default: 0 },
    bouncedCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    skippedCount: { type: Number, default: 0 },
    openedCount: { type: Number, default: 0 },
    clickedCount: { type: Number, default: 0 },
    batchNumber: { type: Number, default: 0 },
    workerLockedUntil: Date,
    lastError: String,
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

const MarketingCampaign =
  mongoose.models.MarketingCampaign ||
  mongoose.model<IMarketingCampaign>(
    "MarketingCampaign",
    MarketingCampaignSchema
  );

export default MarketingCampaign;
