import { NextRequest, NextResponse } from "next/server";
import {
  getMarketingWorkerAuthorization,
  processDueMarketingCampaigns,
} from "@/libs/marketingDelivery";

export async function GET(request: NextRequest) {
  if (!getMarketingWorkerAuthorization(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processDueMarketingCampaigns();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Marketing campaign worker failed:", error);
    return NextResponse.json(
      { error: "Campaign worker could not process pending deliveries." },
      { status: 500 }
    );
  }
}
