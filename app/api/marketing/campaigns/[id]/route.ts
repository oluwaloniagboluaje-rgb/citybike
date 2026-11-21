import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/libs/mongodb";
import MarketingCampaign from "@/models/marketingCampaign";
import {
  authorizeMarketingAdmin,
  marketingAuthError,
} from "@/libs/marketingAdmin";
import { marketingCampaignPatchSchema } from "@/libs/marketingValidation";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  const auth = await authorizeMarketingAdmin(request);
  if (!auth.ok) return marketingAuthError(auth);
  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  }

  await connectDB();
  const campaign = await MarketingCampaign.findById(id).lean();
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  }
  return NextResponse.json({ campaign });
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await authorizeMarketingAdmin(request);
    if (!auth.ok) return marketingAuthError(auth);
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    }
    await connectDB();

    const parsed = marketingCampaignPatchSchema.safeParse(
      await request.json()
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid campaign." },
        { status: 400 }
      );
    }

    const updatedAudience = parsed.data.audience;
    if (
      updatedAudience?.type === "selected_customers" &&
      updatedAudience.customerIds.length === 0
    ) {
      return NextResponse.json(
        { error: "Select at least one customer." },
        { status: 400 }
      );
    }
    if (
      updatedAudience?.type === "locations" &&
      updatedAudience.countries.length === 0 &&
      updatedAudience.cities.length === 0
    ) {
      return NextResponse.json(
        { error: "Choose at least one customer location." },
        { status: 400 }
      );
    }

    const { audience, ...content } = parsed.data;
    const update: Record<string, unknown> = { ...content };
    if (audience) {
      update.audienceType = audience.type;
      update.customerIds = audience.customerIds;
      update.countries = audience.countries;
      update.cities = audience.cities;
    }

    const campaign = await MarketingCampaign.findOneAndUpdate(
      { _id: id, status: { $in: ["draft", "scheduled"] } },
      { $set: update },
      { new: true, runValidators: true }
    );
    if (!campaign) {
      return NextResponse.json(
        { error: "Only draft or scheduled campaigns can be edited." },
        { status: 409 }
      );
    }
    return NextResponse.json({ campaign });
  } catch (error) {
    console.error("Marketing campaign update failed:", error);
    return NextResponse.json(
      { error: "Could not update campaign." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const auth = await authorizeMarketingAdmin(request);
  if (!auth.ok) return marketingAuthError(auth);
  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  }
  await connectDB();
  const campaign = await MarketingCampaign.findOneAndDelete({
    _id: id,
    status: { $in: ["draft", "scheduled"] },
  });
  if (!campaign) {
    return NextResponse.json(
      { error: "Only draft or scheduled campaigns can be deleted." },
      { status: 409 }
    );
  }
  return NextResponse.json({ success: true });
}
