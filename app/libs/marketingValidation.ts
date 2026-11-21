import { z } from "zod";
import { MARKETING_AUDIENCE_TYPES } from "@/models/marketingCampaign";

const optionalHttpUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return url.protocol === "https:" || url.protocol === "http:";
    } catch {
      return false;
    }
  }, "Enter a valid http or https URL.")
  .optional()
  .or(z.literal(""));

export const marketingAudienceSchema = z.object({
  type: z.enum(MARKETING_AUDIENCE_TYPES),
  customerIds: z
    .array(z.string().regex(/^[a-f\d]{24}$/i))
    .max(5000)
    .default([]),
  countries: z.array(z.string().trim().min(1).max(100)).max(100).default([]),
  cities: z.array(z.string().trim().min(1).max(100)).max(200).default([]),
});

export const marketingCampaignContentSchema = z.object({
  name: z.string().trim().min(1).max(120),
  subject: z.string().trim().min(1).max(180),
  message: z.string().trim().min(1).max(20000),
  imageUrl: optionalHttpUrl,
  imageLink: optionalHttpUrl,
  ctaLabel: z.string().trim().max(60).optional().or(z.literal("")),
  ctaUrl: optionalHttpUrl,
  discountCode: z.string().trim().max(80).optional().or(z.literal("")),
  audience: marketingAudienceSchema,
});

export const marketingCampaignPatchSchema =
  marketingCampaignContentSchema.partial();
