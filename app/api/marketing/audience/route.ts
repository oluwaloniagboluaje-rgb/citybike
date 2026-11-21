import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/libs/mongodb";
import User from "@/models/User";
import {
  authorizeMarketingAdmin,
  marketingAuthError,
} from "@/libs/marketingAdmin";
import {
  findEligibleCustomerPage,
  getCampaignLocationOptions,
} from "@/libs/marketingRecipients";

export async function GET(request: NextRequest) {
  try {
    const auth = await authorizeMarketingAdmin(request);
    if (!auth.ok) return marketingAuthError(auth);
    await connectDB();

    const params = request.nextUrl.searchParams;
    const page = Math.max(1, Math.min(10000, Number(params.get("page")) || 1));
    const pageSize = 50;
    const countries = params.getAll("country").filter(Boolean);
    const cities = params.getAll("city").filter(Boolean);
    const previousCustomersOnly = params.get("previousCustomers") === "true";
    const [pageResult, customerCount, locations] = await Promise.all([
      findEligibleCustomerPage({
        page,
        pageSize,
        search: params.get("search") || "",
        countries,
        cities,
        previousCustomersOnly,
      }),
      User.countDocuments({
        role: "customer",
        isActive: { $ne: false },
        email: { $exists: true, $ne: "" },
        $or: [
          { marketingUnsubscribedAt: { $exists: false } },
          { marketingUnsubscribedAt: null },
        ],
      }),
      getCampaignLocationOptions(),
    ]);

    return NextResponse.json({
      ...pageResult,
      page,
      pageSize,
      customerCount,
      ...locations,
    });
  } catch (error) {
    console.error("Marketing audience lookup failed:", error);
    return NextResponse.json(
      { error: "Could not load customer recipients." },
      { status: 500 }
    );
  }
}
