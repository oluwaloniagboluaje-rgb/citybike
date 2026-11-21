import { QueryFilter, Types } from "mongoose";
import Order from "@/models/order";
import User, { IUser } from "@/models/User";
import type { MarketingAudienceType } from "@/models/marketingCampaign";

export interface MarketingAudience {
  type: MarketingAudienceType;
  customerIds?: string[];
  countries?: string[];
  cities?: string[];
}

export interface EligibleCustomer {
  _id: Types.ObjectId;
  name: string;
  email: string;
}

function escapedRegex(value: string): RegExp {
  return new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
}

async function getMatchingCustomerIds(
  audience: MarketingAudience
): Promise<Types.ObjectId[] | null> {
  if (audience.type === "selected_customers") {
    return (audience.customerIds || [])
      .filter(Types.ObjectId.isValid)
      .map((id) => new Types.ObjectId(id));
  }

  if (audience.type === "previous_customers") {
    const ids = await Order.distinct("customer", {
      customer: { $exists: true, $ne: null },
    });
    return ids.filter((id): id is Types.ObjectId => id instanceof Types.ObjectId);
  }

  if (audience.type === "locations") {
    const countries = audience.countries || [];
    const cities = audience.cities || [];
    if (!countries.length && !cities.length) return [];

    const locationConditions: Record<string, unknown>[] = [];
    for (const point of ["pickup", "dropoff"]) {
      const conditions: Record<string, unknown>[] = [];
      if (countries.length) {
        conditions.push({ [`${point}.country`]: { $in: countries } });
      }
      if (cities.length) {
        conditions.push({ [`${point}.city`]: { $in: cities } });
      }
      locationConditions.push({ $and: conditions });
    }

    const ids = await Order.distinct("customer", {
      customer: { $exists: true, $ne: null },
      $or: locationConditions,
    });
    return ids.filter((id): id is Types.ObjectId => id instanceof Types.ObjectId);
  }

  return null;
}

export async function findEligibleCustomers(
  audience: MarketingAudience
): Promise<EligibleCustomer[]> {
  const matchingIds = await getMatchingCustomerIds(audience);
  if (matchingIds && matchingIds.length === 0) return [];

  const filter: QueryFilter<IUser> = {
    role: "customer",
    isActive: { $ne: false },
    email: { $exists: true, $ne: "" },
    $or: [
      { marketingUnsubscribedAt: { $exists: false } },
      { marketingUnsubscribedAt: null },
    ],
  };
  if (matchingIds) filter._id = { $in: matchingIds };

  return User.find(filter)
    .select("_id name email")
    .sort({ _id: 1 })
    .lean() as Promise<EligibleCustomer[]>;
}

export async function findEligibleCustomerPage(options: {
  page: number;
  pageSize: number;
  search?: string;
  country?: string;
  city?: string;
  countries?: string[];
  cities?: string[];
  previousCustomersOnly: boolean;
  audience?: MarketingAudience;
  afterId?: string;
}): Promise<{ customers: EligibleCustomer[]; total: number }> {
  const audience: MarketingAudience = options.audience || {
    type: options.previousCustomersOnly
      ? "previous_customers"
      : options.country ||
          options.city ||
          options.countries?.length ||
          options.cities?.length
        ? "locations"
        : "all_subscribers",
    countries: options.countries || (options.country ? [options.country] : []),
    cities: options.cities || (options.city ? [options.city] : []),
  };
  const matchingIds = await getMatchingCustomerIds(audience);
  if (matchingIds && matchingIds.length === 0) {
    return { customers: [], total: 0 };
  }

  const filter: QueryFilter<IUser> = {
    role: "customer",
    isActive: { $ne: false },
    email: { $exists: true, $ne: "" },
    $or: [
      { marketingUnsubscribedAt: { $exists: false } },
      { marketingUnsubscribedAt: null },
    ],
  };
  if (matchingIds) filter._id = { $in: matchingIds };
  const conjunction: QueryFilter<IUser>[] = [];
  if (options.afterId && Types.ObjectId.isValid(options.afterId)) {
    conjunction.push({ _id: { $gt: new Types.ObjectId(options.afterId) } });
  }
  if (options.search?.trim()) {
    const pattern = escapedRegex(options.search.trim().slice(0, 100));
    conjunction.push({ $or: [{ name: pattern }, { email: pattern }] });
  }
  if (conjunction.length) filter.$and = conjunction;

  const [customers, total] = await Promise.all([
    User.find(filter)
      .select("_id name email")
      .sort({ _id: 1 })
      .skip((options.page - 1) * options.pageSize)
      .limit(options.pageSize)
      .lean(),
    User.countDocuments(filter),
  ]);
  return {
    customers: customers as EligibleCustomer[],
    total,
  };
}

export async function getCampaignLocationOptions(): Promise<{
  countries: string[];
  cities: string[];
}> {
  const [pickupCountries, dropoffCountries, pickupCities, dropoffCities] =
    await Promise.all([
      Order.distinct("pickup.country"),
      Order.distinct("dropoff.country"),
      Order.distinct("pickup.city"),
      Order.distinct("dropoff.city"),
    ]);

  return {
    countries: [...new Set([...pickupCountries, ...dropoffCountries])]
      .filter((value): value is string => typeof value === "string" && !!value.trim())
      .sort((a, b) => a.localeCompare(b))
      .slice(0, 300),
    cities: [...new Set([...pickupCities, ...dropoffCities])]
      .filter((value): value is string => typeof value === "string" && !!value.trim())
      .sort((a, b) => a.localeCompare(b))
      .slice(0, 500),
  };
}
