import { ServiceType } from "@/models/order";

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
// Confirmed rate: UK = ₦9,000/kg. Other destinations use this as a
// placeholder until you confirm their actual rates.
const PER_KG_RATE_BY_COUNTRY: Record<string, number> = {
  ireland: 15000,
  canada: 16000,
};

const EU_COUNTRIES = new Set([
  "austria",
  "belgium",
  "bulgaria",
  "croatia",
  "cyprus",
  "czech republic",
  "czechia",
  "denmark",
  "estonia",
  "finland",
  "france",
  "germany",
  "greece",
  "hungary",
  "latvia",
  "lithuania",
  "luxembourg",
  "malta",
  "netherlands",
  "poland",
  "portugal",
  "romania",
  "slovakia",
  "slovenia",
  "spain",
  "sweden",
  "slovenia",
  "croatia",
  "estonia",
  "latvia",
  "lithuania",
]);

const DEFAULT_INTERNATIONAL_PER_KG_RATE = 9000;
const EU_PER_KG_RATE = 16000;
const PROTEIN_TO_UK_RATE = 10000;
const NIGERIA_TO_UK_RATE = 9000;

const POUND_TO_NAIRA = 1600;
const UK_TO_NIGERIA_GENERAL_RATE_POUND = 7;
const UK_TO_NIGERIA_PHONE_RATE_POUND = 20;
const UK_TO_NIGERIA_LAPTOP_RATE_POUND = 55;
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
}): number {
  const {
    serviceType,
    packageSize,
    distanceKm,
    weightKg,
    pickupCountry,
    dropoffCountry,
    packageDescription,
  } = params;

  const origin = normalizeCountry(pickupCountry || "Nigeria");
  const destination = normalizeCountry(dropoffCountry || "");
  const description = (packageDescription || "").trim().toLowerCase();
  const weight = weightKg ?? 1;

  if (serviceType === "international") {
    if (isSeaCargoBarrel(description)) {
      return roundNaira(SEA_CARGO_BARREL_RATE_POUND + PACKAGE_SIZE_FEE[packageSize]);
    }

    if (isGhanaMustGo(origin, destination, description)) {
      return roundNaira(GHANA_MUST_GO_RATE_POUND + PACKAGE_SIZE_FEE[packageSize]);
    }

    if (isProteinToUK(origin, destination, description)) {
      return Math.round(weight * PROTEIN_TO_UK_RATE + PACKAGE_SIZE_FEE[packageSize]);
    }

    if (origin === "nigeria" && destination === "united kingdom") {
      return Math.round(weight * NIGERIA_TO_UK_RATE + PACKAGE_SIZE_FEE[packageSize]);
    }

    if (origin === "united kingdom" && destination === "nigeria") {
      if (isLaptopOrIPad(description)) {
        return roundNaira(UK_TO_NIGERIA_LAPTOP_RATE_POUND + PACKAGE_SIZE_FEE[packageSize]);
      }
      if (isPhoneOrPowerbank(description)) {
        return roundNaira(UK_TO_NIGERIA_PHONE_RATE_POUND + PACKAGE_SIZE_FEE[packageSize]);
      }
      return roundNaira(UK_TO_NIGERIA_GENERAL_RATE_POUND + PACKAGE_SIZE_FEE[packageSize]);
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