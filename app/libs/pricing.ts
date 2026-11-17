import type { ServiceType, ShippingSpeed } from "@/models/order";

export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

function normalizeCountry(country: string) {
  return country.trim().toLowerCase();
}

function isPhoneOrPowerbank(description: string) {
  return /phone|powerbank/.test(description);
}

function isLaptopOrIPad(description: string) {
  return /laptop|ipad/.test(description);
}

function isProteinToUK(origin: string, destination: string, description: string) {
  return destination === "united kingdom" && /protein/.test(description);
}

function isSeaCargoBarrel(description: string) {
  return /barrel/.test(description);
}

function isGhanaMustGo(origin: string, destination: string, description: string) {
  return (
    (origin === "united kingdom" && destination === "ghana") ||
    /ghana must go/.test(description)
  );
}

function roundNaira(value: number) {
  return Math.round(value * POUND_TO_NAIRA);
}

function calculateTieredExpressPrice(
  weightKg: number,
  tiers: ReadonlyArray<{ maxWeightKg: number; price: number }>
): number | null {
  const tier = tiers.find((candidate) => weightKg <= candidate.maxWeightKg);
  return tier
    ? tier.price + NIGERIA_EXPRESS_PACKAGING_FEE
    : null;
}

export function requiresCustomerServiceQuote(params: {
  pickupCountry: string;
  dropoffCountry: string;
  shippingSpeed: ShippingSpeed;
  weightKg: number;
}): boolean {
  const origin = normalizeCountry(params.pickupCountry);
  const destination = normalizeCountry(params.dropoffCountry);
  const hasCappedExpressRate =
    origin === "nigeria" &&
    (destination === "united kingdom" ||
      destination === "ireland" ||
      EU_COUNTRIES.has(destination));

  return (
    hasCappedExpressRate &&
    params.shippingSpeed === "express" &&
    params.weightKg > MAX_SELF_SERVICE_EXPRESS_WEIGHT_KG
  );
}

// ---- Domestic (distance-based) rates ----
const BASE_FEE = 500; // flat starting fee in Naira
const PER_KM_RATE = 150; // Naira per km

type DomesticServiceType = Extract<
  ServiceType,
  "local" | "interstate" | "ecommerce" | "errand" | "corporate"
>;

const DOMESTIC_SERVICE_MULTIPLIER: Record<DomesticServiceType, number> = {
  local: 1,
  interstate: 1.3,
  ecommerce: 1,
  errand: 0.8,
  corporate: 1.2,
};

// ---- International: priced per kg ----
// Other destinations use these rates as placeholders until confirmed.
const PER_KG_RATE_BY_COUNTRY: Record<string, number> = {
  ireland: 15000,
  canada: 16000,
};

export const EUROPEAN_COUNTRY_OPTIONS = [
  "Albania",
  "Andorra",
  "Armenia",
  "Austria",
  "Azerbaijan",
  "Belarus",
  "Belgium",
  "Bosnia and Herzegovina",
  "Bulgaria",
  "Croatia",
  "Cyprus",
  "Czech Republic",
  "Denmark",
  "Estonia",
  "Finland",
  "France",
  "Georgia",
  "Germany",
  "Greece",
  "Hungary",
  "Iceland",
  "Ireland",
  "Italy",
  "Kazakhstan",
  "Kosovo",
  "Latvia",
  "Liechtenstein",
  "Lithuania",
  "Luxembourg",
  "Malta",
  "Moldova",
  "Monaco",
  "Montenegro",
  "Netherlands",
  "North Macedonia",
  "Norway",
  "Poland",
  "Portugal",
  "Romania",
  "Russia",
  "San Marino",
  "Serbia",
  "Slovakia",
  "Slovenia",
  "Spain",
  "Sweden",
  "Switzerland",
  "Turkey",
  "Ukraine",
  "United Kingdom",
  "Vatican City",
] as const;

const EU_COUNTRIES = new Set(
  EUROPEAN_COUNTRY_OPTIONS.map(normalizeCountry)
);

const DEFAULT_INTERNATIONAL_PER_KG_RATE = 9000;
const EU_PER_KG_RATE = 16000;
const PROTEIN_TO_UK_RATE = 10000;
const NIGERIA_TO_UK_IRELAND_EXPRESS_TIERS = [
  { maxWeightKg: 2, price: 90000 },
  { maxWeightKg: 2.5, price: 135000 },
  { maxWeightKg: 3, price: 155000 },
  { maxWeightKg: 4, price: 171000 },
  { maxWeightKg: 5, price: 192000 },
] as const;
const NIGERIA_TO_EUROPE_EXPRESS_TIERS = [
  { maxWeightKg: 2, price: 115000 },
  { maxWeightKg: 2.5, price: 168000 },
  { maxWeightKg: 3, price: 194000 },
  { maxWeightKg: 4, price: 206000 },
  { maxWeightKg: 5, price: 225000 },
] as const;
const NIGERIA_EXPRESS_PACKAGING_FEE = 4000;
const NIGERIA_TO_CANADA_AND_EUROPE_RATE = 16500;
const NIGERIA_TO_USA_RATE = 18500;
const NIGERIA_INTERNATIONAL_HANDLING_FEE = 10000;
const MAX_SELF_SERVICE_EXPRESS_WEIGHT_KG = 5;

const POUND_TO_NAIRA = 1600;
const UK_TO_NIGERIA_GENERAL_RATE_POUND = 6.8;
const UK_TO_NIGERIA_HANDLING_FEE_POUND = 5;
const UK_TO_NIGERIA_PHONE_RATE_POUND = 30;
const UK_TO_NIGERIA_LAPTOP_RATE_POUND = 40;
const SEA_CARGO_BARREL_RATE_POUND = 120;
const GHANA_MUST_GO_RATE_POUND = 90;

// DHL Express rate not yet confirmed — placeholder flat fee.
const DHL_EXPRESS_FLAT_RATE = 60000;

const PACKAGE_SIZE_FEE: Record<"small" | "medium" | "large", number> = {
  small: 0,
  medium: 500,
  large: 1200,
};

export function calculatePrice(params: {
  distanceKm: number;
  serviceType: ServiceType;
  packageSize: "small" | "medium" | "large";
  weightKg?: number;
  pickupCountry?: string;
  dropoffCountry?: string;
  packageDescription?: string;
  shippingSpeed?: ShippingSpeed;
}): number {
  const {
    serviceType,
    packageSize,
    distanceKm,
    weightKg,
    pickupCountry,
    dropoffCountry,
    packageDescription,
    shippingSpeed = "standard",
  } = params;

  const origin = normalizeCountry(pickupCountry || "Nigeria");
  const destination = normalizeCountry(dropoffCountry || "");
  const description = (packageDescription || "").trim().toLowerCase();
  const weight = weightKg ?? 1;

  if (serviceType === "international") {
    if (origin === "nigeria") {
      if (
        destination === "united kingdom" ||
        destination === "ireland"
      ) {
        if (shippingSpeed === "express") {
          const price = calculateTieredExpressPrice(
            weight,
            NIGERIA_TO_UK_IRELAND_EXPRESS_TIERS
          );
          if (price === null) {
            throw new Error(
              "For shipments above 5kg, please contact customer service for a personalized express shipping quote."
            );
          }
          return price;
        }

        return Math.round(
          weight * NIGERIA_TO_CANADA_AND_EUROPE_RATE +
            NIGERIA_INTERNATIONAL_HANDLING_FEE
        );
      }

      if (destination === "canada") {
        return Math.round(
          weight * NIGERIA_TO_CANADA_AND_EUROPE_RATE +
            NIGERIA_INTERNATIONAL_HANDLING_FEE
        );
      }

      if (destination === "united states") {
        return Math.round(
          weight * NIGERIA_TO_USA_RATE +
            NIGERIA_INTERNATIONAL_HANDLING_FEE
        );
      }

      if (EU_COUNTRIES.has(destination)) {
        if (shippingSpeed === "express") {
          const price = calculateTieredExpressPrice(
            weight,
            NIGERIA_TO_EUROPE_EXPRESS_TIERS
          );
          if (price === null) {
            throw new Error(
              "For shipments above 5kg, please contact customer service for a personalized express shipping quote."
            );
          }
          return price;
        }

        return Math.round(
          weight * NIGERIA_TO_CANADA_AND_EUROPE_RATE +
            NIGERIA_INTERNATIONAL_HANDLING_FEE
        );
      }
    }

    if (isSeaCargoBarrel(description)) {
      return roundNaira(SEA_CARGO_BARREL_RATE_POUND + PACKAGE_SIZE_FEE[packageSize]);
    }

    if (isGhanaMustGo(origin, destination, description)) {
      return roundNaira(GHANA_MUST_GO_RATE_POUND + PACKAGE_SIZE_FEE[packageSize]);
    }

    if (isProteinToUK(origin, destination, description)) {
      return Math.round(weight * PROTEIN_TO_UK_RATE + PACKAGE_SIZE_FEE[packageSize]);
    }

    if (origin === "united kingdom" && destination === "nigeria") {
      if (isLaptopOrIPad(description)) {
        return roundNaira(UK_TO_NIGERIA_LAPTOP_RATE_POUND);
      }
      if (isPhoneOrPowerbank(description)) {
        return roundNaira(UK_TO_NIGERIA_PHONE_RATE_POUND);
      }
      return roundNaira(
        weight * UK_TO_NIGERIA_GENERAL_RATE_POUND +
          UK_TO_NIGERIA_HANDLING_FEE_POUND
      );
    }

    if (destination === "ireland") {
      return Math.round(weight * PER_KG_RATE_BY_COUNTRY.ireland + PACKAGE_SIZE_FEE[packageSize]);
    }

    if (destination === "canada") {
      return Math.round(weight * PER_KG_RATE_BY_COUNTRY.canada + PACKAGE_SIZE_FEE[packageSize]);
    }

    if (EU_COUNTRIES.has(destination)) {
      return Math.round(weight * EU_PER_KG_RATE + PACKAGE_SIZE_FEE[packageSize]);
    }

    const perKgRate =
      PER_KG_RATE_BY_COUNTRY[destination] ?? DEFAULT_INTERNATIONAL_PER_KG_RATE;
    return Math.round(weight * perKgRate + PACKAGE_SIZE_FEE[packageSize]);
  }

  if (serviceType === "dhl_express") {
    return Math.round(DHL_EXPRESS_FLAT_RATE + PACKAGE_SIZE_FEE[packageSize]);
  }

  const distanceCost = BASE_FEE + distanceKm * PER_KM_RATE;
  const withMultiplier =
    distanceCost * DOMESTIC_SERVICE_MULTIPLIER[serviceType];
  const total = withMultiplier + PACKAGE_SIZE_FEE[packageSize];

  return Math.round(total);
}