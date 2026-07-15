import { ServiceType } from "@/models/order";

type DomesticServiceType = "local" | "interstate" | "ecommerce" | "errand" | "corporate";

const DOMESTIC_AVG_SPEED_KMH: Record<DomesticServiceType, number> = { local: 25, interstate: 50, ecommerce: 30, errand: 20, corporate: 30 };

const INTERNATIONAL_TRANSIT_DAYS = 7;
const DHL_EXPRESS_TRANSIT_DAYS = 3;
const PROCESSING_BUFFER_HOURS = 2;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export function estimateTransitDurationMs(distanceKm: number, serviceType: ServiceType): number {
  if (serviceType === "international") {
    return INTERNATIONAL_TRANSIT_DAYS * DAY_MS;
  }
  if (serviceType === "dhl_express") {
    return DHL_EXPRESS_TRANSIT_DAYS * DAY_MS;
  }
  const speed = DOMESTIC_AVG_SPEED_KMH[serviceType as DomesticServiceType];
  const travelHours = distanceKm / speed;
  return (PROCESSING_BUFFER_HOURS + travelHours) * HOUR_MS;
}