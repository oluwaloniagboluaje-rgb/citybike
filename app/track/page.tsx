"use client";

import {
  Suspense,
  useEffect,
  useState,
  FormEvent,
} from "react";

import { useSearchParams } from "next/navigation";

import {
  OrderStatus,
  PublicTrackingResult,
  SERVICE_TYPE_LABELS,
  DHLStatus,
  DHL_STATUS_LABELS,
  INTERNATIONAL_STATUS_LABELS,
  InternationalStatus,
  TrackingEvent,
} from "@/types";

import {
  supabase,
  orderStatusChannel,
} from "@/libs/supabaseClient";

import StatusBadge from "@/components/ui/statusbadge";
import LiveMap from "@/components/map/livemapClient";

import {
  Search,
  Globe2,
  PackageSearch,
  Truck,
  CheckCircle2,
  Circle,
  AlertCircle,
  Plane,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";

/* =========================================================
   SERVICE TYPE HELPERS
========================================================= */

function isDhlExpress(
  result: PublicTrackingResult
): boolean {
  return result.serviceType === "dhl_express";
}

function isInternationalCargo(
  result: PublicTrackingResult
): boolean {
  return result.serviceType === "international";
}

function isInternationalShipment(
  result: PublicTrackingResult
): boolean {
  return (
    isInternationalCargo(result) ||
    isDhlExpress(result) ||
    result.isInternational
  );
}

/* =========================================================
   INTERNAL ORDER STATUS DESCRIPTION
========================================================= */

function getOrderTimelineDescription(
  status: OrderStatus,
  order: Pick<
    PublicTrackingResult,
    "pickup" | "dropoff"
  >
): string {
  switch (status) {
    case "pending":
      return "Order placed";

    case "shipment_created":
      return "Shipment has been created";

    case "awaiting_batching":
      return "Shipment is awaiting batching";

    case "added_to_batch":
      return "Shipment has been added to a shipment batch";

    case "ready_for_shipping":
      return "Shipment is ready for shipping";

    case "left_origin":
      return `Shipment has left ${order.pickup.city}`;

    case "confirmed":
      return "Order confirmed by CityBike Logistics";

    case "assigned":
      return "Driver assigned to this delivery";

    case "assigned_courier":
      return "Courier assigned to this shipment";

    case "picked_up":
      return `Picked up from ${order.pickup.city}`;

    case "awaiting_dispatch":
      return "Awaiting dispatch for the next shipment stage";

    case "dispatched":
      return "Package dispatched";

    case "in_transit":
      return `In transit to ${order.dropoff.city}`;

    case "landed":
      return `Shipment has arrived in ${order.dropoff.city}`;

    case "customs_processing":
      return `Shipment is undergoing customs processing in ${order.dropoff.city}`;

    case "destination_hub":
      return `Arrived at destination hub in ${order.dropoff.city}`;

    case "out_for_delivery":
      return `Out for delivery in ${order.dropoff.city}`;

    case "delivered_by_courier":
      return `Delivered to ${order.dropoff.city}`;

    case "delivery_confirmed":
      return "Delivery has been confirmed";

    case "delivered":
      return `Delivered to ${order.dropoff.city}`;

    case "cancelled":
      return "Order cancelled";

    default:
      return "Shipment status updated";
  }
}

/* =========================================================
   DHL EVENT DESCRIPTION
========================================================= */

function getDHLTimelineDescription(
  status: DHLStatus,
  description?: string,
  order?: Pick<
    PublicTrackingResult,
    "pickup" | "dropoff"
  >
): string {
  if (description) {
    return description;
  }

  switch (status) {
    case "shipment_picked_up":
      return order
        ? `Shipment picked up from ${order.pickup.city}`
        : "Shipment picked up";

    case "in_transit":
      return order
        ? `Shipment is in transit to ${order.dropoff.city}`
        : "Shipment is in transit";

    case "out_for_delivery":
      return order
        ? `Shipment is out for delivery in ${order.dropoff.city}`
        : "Shipment is out for delivery";

    case "delivered":
      return order
        ? `Shipment delivered to ${order.dropoff.city}`
        : "Shipment delivered";

    case "failed_delivery_attempt":
      return "Delivery attempt was unsuccessful";

    case "returned":
      return "Shipment returned to sender";

    case "customs_cleared":
      return "Shipment has cleared customs";

    case "exception":
      return "A shipment exception has occurred";

    default:
      return "Shipment status updated";
  }
}

/* =========================================================
   INTERNATIONAL CARGO DESCRIPTION
========================================================= */

function getInternationalTimelineDescription(
  status: InternationalStatus,
  description?: string,
  order?: Pick<
    PublicTrackingResult,
    "pickup" | "dropoff"
  >
): string {
  if (description) {
    return description;
  }

  switch (status) {
    case "shipment_picked_up":
      return order
        ? `International cargo picked up from ${order.pickup.city}`
        : "International cargo picked up";

    case "in_transit":
      return order
        ? `International cargo is in transit to ${order.dropoff.city}`
        : "International cargo is in transit";

    case "cleared_customs":
      return order
        ? `International cargo has cleared customs in ${order.dropoff.city}`
        : "International cargo has cleared customs";

    case "out_for_delivery":
      return order
        ? `International cargo is out for delivery in ${order.dropoff.city}`
        : "International cargo is out for delivery";

    case "delivered":
      return order
        ? `International cargo delivered to ${order.dropoff.city}`
        : "International cargo delivered";

    case "delayed":
      return "International cargo has been delayed";

    case "exception":
      return "An international cargo exception has occurred";

    default:
      return "International cargo status updated";
  }
}

/* =========================================================
   EVENT LABEL
========================================================= */

function getTrackingEventLabel(
  event: TrackingEvent
): string {
  if (event.source === "dhl") {
    return (
      DHL_STATUS_LABELS[
        event.status as DHLStatus
      ] || event.status
    );
  }

  if (event.source === "international") {
    return (
      INTERNATIONAL_STATUS_LABELS[
        event.status as InternationalStatus
      ] || event.status
    );
  }

  const labels: Partial<Record<OrderStatus, string>> = {
    pending: "Pending",
    shipment_created: "Shipment Created",
    awaiting_batching: "Awaiting Batching",
    added_to_batch: "Added to Batch",
    ready_for_shipping: "Ready for Shipping",
    left_origin: "Left Origin",
    in_transit: "In Transit",
    landed: "Arrived at Destination",
    customs_processing: "Customs Processing",
    confirmed: "Confirmed",
    assigned: "Driver Assigned",
    assigned_courier: "Courier Assigned",
    picked_up: "Package Picked Up",
    awaiting_dispatch: "Awaiting Dispatch",
    dispatched: "Dispatched",
    destination_hub: "Destination Hub",
    out_for_delivery: "Out for Delivery",
    delivered_by_courier: "Delivered by Courier",
    delivery_confirmed: "Delivery Confirmed",
    delivered: "Delivered",
    cancelled: "Cancelled",
  };

  return (
    labels[event.status as OrderStatus] ||
    event.status
  );
}

/* =========================================================
   EVENT DESCRIPTION
========================================================= */

function getTrackingEventDescription(
  event: TrackingEvent,
  order: PublicTrackingResult
): string {
  if (event.description) {
    return event.description;
  }

  if (event.source === "dhl") {
    return getDHLTimelineDescription(
      event.status as DHLStatus,
      undefined,
      order
    );
  }

  if (event.source === "international") {
    return getInternationalTimelineDescription(
      event.status as InternationalStatus,
      undefined,
      order
    );
  }

  return getOrderTimelineDescription(
    event.status as OrderStatus,
    order
  );
}

/* =========================================================
   EVENT STYLE
========================================================= */

function getTrackingEventStyle(
  event: TrackingEvent,
  isLatest: boolean
) {
  if (event.source === "dhl") {
    if (event.status === "exception") {
      return {
        dot: "bg-red-500",
        badge: "bg-red-100 text-red-700",
        text: "text-red-900",
        line: "border-red-200",
        card: "border-red-200 bg-red-50",
      };
    }

    return {
      dot: isLatest
        ? "bg-blue-600"
        : "bg-blue-300",
      badge: isLatest
        ? "bg-blue-600 text-white"
        : "bg-blue-100 text-blue-800",
      text: "text-blue-950",
      line: "border-blue-300",
      card: isLatest
        ? "border-blue-300 bg-blue-100/80 shadow-sm"
        : "border-blue-200 bg-blue-50/70",
    };
  }

  if (event.source === "international") {
    if (event.status === "exception") {
      return {
        dot: "bg-red-500",
        badge: "bg-red-100 text-red-700",
        text: "text-red-900",
        line: "border-red-200",
        card: "border-red-200 bg-red-50",
      };
    }

    if (event.status === "delayed") {
      return {
        dot: "bg-amber-500",
        badge: "bg-amber-100 text-amber-800",
        text: "text-amber-900",
        line: "border-amber-200",
        card: "border-amber-200 bg-amber-50",
      };
    }

    return {
      dot: isLatest
        ? "bg-orange-600"
        : "bg-orange-300",
      badge: isLatest
        ? "bg-orange-600 text-white"
        : "bg-orange-100 text-orange-800",
      text: "text-orange-950",
      line: "border-orange-300",
      card: isLatest
        ? "border-orange-300 bg-orange-100/80 shadow-sm"
        : "border-orange-200 bg-orange-50/70",
    };
  }

  if (
    event.status === "exception"
  ) {
    return {
      dot: "bg-red-500",
      badge: "bg-red-100 text-red-700",
      text: "text-red-900",
      line: "border-red-200",
      card: "border-red-200 bg-red-50",
    };
  }

  if (
    event.status === "delayed"
  ) {
    return {
      dot: "bg-amber-500",
      badge: "bg-amber-100 text-amber-700",
      text: "text-amber-900",
      line: "border-amber-200",
      card: "border-amber-200 bg-amber-50",
    };
  }

  return {
    dot: isLatest
      ? "bg-orange-600"
      : "bg-orange-300",
    badge: isLatest
      ? "bg-orange-600 text-white"
      : "bg-orange-100 text-orange-800",
    text: "text-orange-950",
    line: "border-orange-300",
    card: isLatest
      ? "border-orange-300 bg-orange-100/80 shadow-sm"
      : "border-orange-200 bg-orange-50/70",
  };
}

/* =========================================================
   EVENT ICON
========================================================= */

function getTrackingEventIcon(
  event: TrackingEvent
) {
  if (
    event.status === "delivered" ||
    event.status === "delivered_by_courier" ||
    event.status === "delivery_confirmed"
  ) {
    return (
      <CheckCircle2 className="h-4 w-4" />
    );
  }

  if (
    event.status === "exception" ||
    event.status === "delayed"
  ) {
    return (
      <AlertCircle className="h-4 w-4" />
    );
  }

  if (
    event.status === "in_transit" ||
    event.status === "left_origin" ||
    event.status === "dispatched"
  ) {
    return (
      <Plane className="h-4 w-4" />
    );
  }

  if (
    event.status === "customs_processing" ||
    event.status === "cleared_customs" ||
    event.status === "customs_cleared"
  ) {
    return (
      <ShieldCheck className="h-4 w-4" />
    );
  }

  if (
    event.status === "out_for_delivery"
  ) {
    return (
      <Truck className="h-4 w-4" />
    );
  }

  return (
    <Circle className="h-4 w-4" />
  );
}

/* =========================================================
   PAGE
========================================================= */

export default function PublicTrackPage() {
  return (
    <Suspense fallback={null}>
      <PublicTrackPageInner />
    </Suspense>
  );
}

/* =========================================================
   PAGE INNER
========================================================= */

function PublicTrackPageInner() {
  const searchParams = useSearchParams();

  const prefill =
    searchParams?.get("number") || "";

  const [input, setInput] =
    useState(prefill);

  const [result, setResult] =
    useState<PublicTrackingResult | null>(
      null
    );

  const [error, setError] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [searched, setSearched] =
    useState(false);

  const [refreshing, setRefreshing] =
    useState(false);

  /* =======================================================
     PREFILL
  ======================================================= */

  useEffect(() => {
    if (prefill) {
      setInput(prefill);
    }
  }, [prefill]);

  /* =======================================================
     FETCH TRACKING
  ======================================================= */

  async function fetchTracking(
    trackingNumber: string,
    silent = false
  ): Promise<void> {
    try {
      if (!silent) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      const res = await fetch(
        `/api/public-track/${encodeURIComponent(
          trackingNumber
        )}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      let data: unknown = null;

      try {
        data = await res.json();
      } catch {
        if (!silent) {
          setError(
            "Something went wrong while looking up this tracking number."
          );
        }

        return;
      }

      if (
        !data ||
        typeof data !== "object"
      ) {
        if (!silent) {
          setError("Package not found");
        }

        return;
      }

      if (
        "error" in data &&
        typeof data.error === "string"
      ) {
        if (!silent) {
          setError(data.error);
        }

        return;
      }

      if (!res.ok) {
        if (!silent) {
          setError("Package not found");
        }

        return;
      }

      setResult(
        data as PublicTrackingResult
      );
    } catch (err) {
      console.error(
        "Customer tracking refresh error:",
        err
      );

      if (!silent) {
        setError(
          "Could not reach the tracking service. Please check your connection and try again."
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  /* =======================================================
     SEARCH
  ======================================================= */

  async function handleSearch(
    e: FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    const cleaned = input
      .trim()
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase();

    if (!cleaned) {
      setError(
        "Please enter a tracking number."
      );
      return;
    }

    setInput(cleaned);
    setError("");
    setResult(null);
    setSearched(true);

    await fetchTracking(cleaned);
  }

  /* =======================================================
     REALTIME UPDATES
  ======================================================= */

  useEffect(() => {
    if (!result?.id) {
      return;
    }

    const trackingNumber =
      result.trackingNumber;

    const channel = supabase.channel(
      orderStatusChannel(result.id)
    );

    channel
      .on(
        "broadcast",
        {
          event: "status-update",
        },
        () => {
          void fetchTracking(
            trackingNumber,
            true
          );
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [
    result?.id,
    result?.trackingNumber,
  ]);

  /* =======================================================
     POLLING FALLBACK
  ======================================================= */

  useEffect(() => {
    if (!result?.trackingNumber) {
      return;
    }

    const trackingNumber =
      result.trackingNumber;

    const interval = window.setInterval(
      () => {
        void fetchTracking(
          trackingNumber,
          true
        );
      },
      5000
    );

    return () => {
      window.clearInterval(interval);
    };
  }, [result?.trackingNumber]);

  /* =======================================================
     SERVICE TYPE
  ======================================================= */

  const dhlExpress =
    result
      ? isDhlExpress(result)
      : false;

  const internationalCargo =
    result
      ? isInternationalCargo(result)
      : false;

  /* =======================================================
     BUILD UNIFIED EVENTS
  ======================================================= */

  const trackingEvents: TrackingEvent[] =
    (() => {
      if (!result) {
        return [];
      }

      let events: TrackingEvent[] = [];

      if (
        result.trackingEvents &&
        result.trackingEvents.length > 0
      ) {
        events = [
          ...result.trackingEvents,
        ];
      } else {
        const internalEvents =
          (
            result.statusHistory || []
          ).map((h) => ({
            status: h.status,
            at: h.at,
            source: "internal" as const,
            description:
              getOrderTimelineDescription(
                h.status,
                result
              ),
          }));

        const dhlEvents =
          (
            result.dhlStatusHistory || []
          ).map((h) => ({
            status: h.status,
            at: h.at,
            source: "dhl" as const,
            description:
              getDHLTimelineDescription(
                h.status,
                h.description,
                result
              ),
          }));

        const internationalEvents =
          (
            result.internationalStatusHistory ||
            []
          ).map((h) => ({
            status: h.status,
            at: h.at,
            source:
              "international" as const,
            description:
              getInternationalTimelineDescription(
                h.status,
                h.description,
                result
              ),
          }));

        events = [
          ...internalEvents,
          ...dhlEvents,
          ...internationalEvents,
        ];
      }

      if (dhlExpress) {
        events = events.filter(
          (event) =>
            event.source === "dhl" ||
            event.source === "internal"
        );
      }

      if (internationalCargo) {
        events = events.filter(
          (event) =>
            event.source ===
              "international" ||
            event.source === "internal"
        );
      }

      if (
        !dhlExpress &&
        !internationalCargo
      ) {
        events = events.filter(
          (event) =>
            event.source === "internal"
        );
      }

      return events.sort(
        (a, b) =>
          new Date(b.at).getTime() -
          new Date(a.at).getTime()
      );
    })();

  /* =======================================================
     SERVICE COLORS
  ======================================================= */

  const serviceBorderClass =
    dhlExpress
      ? "border-blue-300"
      : internationalCargo
        ? "border-orange-300"
        : "border-neutral-200";

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">

      {/* HEADER */}

      <div className="text-center">
        <div
          className={`mx-auto mb-3 inline-flex rounded-full p-3 ${
            dhlExpress
              ? "bg-blue-100 text-blue-600"
              : "bg-orange-100 text-orange-600"
          }`}
        >
          <PackageSearch className="h-6 w-6" />
        </div>

        <h1 className="text-2xl font-bold text-neutral-900 sm:text-3xl">
          Track Your Package
        </h1>

        <p className="mt-1 text-sm text-neutral-600">
          Enter your CityBike Logistics
          tracking number below — works for
          local, interstate, and international
          shipments.
        </p>
      </div>

      {/* SEARCH */}

      <form
        onSubmit={handleSearch}
        className="mx-auto mt-6 flex max-w-md gap-2"
      >
        <input
          value={input}
          onChange={(e) =>
            setInput(e.target.value)
          }
          placeholder="e.g. IBD26K3F9X2"
          className={`w-full rounded-md border border-neutral-300 px-4 py-2.5 text-sm uppercase tracking-wide outline-none ${
            dhlExpress
              ? "focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              : "focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
          }`}
        />

        <button
          type="submit"
          disabled={loading}
          className={`flex items-center gap-1.5 rounded-md px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60 ${
            dhlExpress
              ? "bg-blue-600 hover:bg-blue-700"
              : "bg-orange-600 hover:bg-orange-700"
          }`}
        >
          <Search className="h-4 w-4" />
          {loading
            ? "Searching..."
            : "Track"}
        </button>
      </form>

      {/* ERROR */}

      {searched &&
        !loading &&
        error && (
          <p className="mt-6 text-center text-sm text-red-600">
            {error}
          </p>
        )}

      {/* RESULT */}

      {result && (
        <div className="mt-8 space-y-6">

          {/* SHIPMENT SUMMARY */}

          <div
            className={`rounded-lg border bg-white p-5 ${serviceBorderClass}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">

              <div>
                <p className="font-mono text-lg font-bold tracking-wide text-neutral-900">
                  #{result.trackingNumber}
                </p>

                <p className="mt-1 text-sm text-neutral-600">
                  {result.packageDescription}
                </p>
              </div>

              <div className="flex flex-col items-end gap-1.5">
                <StatusBadge
                  status={result.status}
                />

                {internationalCargo && (
                  <span className="flex items-center gap-1 rounded-full bg-orange-600 px-2.5 py-0.5 text-xs font-medium text-white">
                    <Globe2 className="h-3 w-3" />
                    International Cargo
                  </span>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-4 text-sm text-neutral-600">

              <span
                className={`rounded-md px-2 py-1 text-xs font-medium ${
                  dhlExpress
                    ? "bg-blue-100 text-blue-800"
                    : internationalCargo
                      ? "bg-orange-100 text-orange-800"
                      : "bg-neutral-100 text-neutral-700"
                }`}
              >
                {
                  SERVICE_TYPE_LABELS[
                    result.serviceType
                  ]
                }
              </span>

              <span>
                From:{" "}
                {result.pickup.city},{" "}
                {result.pickup.country}
              </span>

              <span>
                To:{" "}
                {result.dropoff.city},{" "}
                {result.dropoff.country}
              </span>

              <span>
                Pickup:{" "}
                {new Date(
                  result.pickupTime
                ).toLocaleString()}
              </span>

              {result.eta && (
                <span>
                  ETA:{" "}
                  {new Date(
                    result.eta
                  ).toLocaleString()}
                </span>
              )}
            </div>

            {/* INTERNATIONAL ROUTE */}

            {internationalCargo && (
              <div className="mt-5 rounded-xl border border-orange-200 bg-gradient-to-br from-orange-50 via-white to-orange-50 p-4">

                <div className="flex items-center justify-between gap-3">

                  <div className="flex items-center gap-2">

                    <div className="rounded-full bg-orange-100 p-2">
                      <Globe2 className="h-5 w-5 text-orange-600" />
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-orange-900">
                        International Cargo
                      </p>

                      <p className="text-xs text-orange-700">
                        International cargo shipment tracking
                      </p>
                    </div>
                  </div>

                  {refreshing && (
                    <RefreshCw className="h-4 w-4 animate-spin text-orange-500" />
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">

                  <span className="font-medium text-orange-900">
                    {result.pickup.city},{" "}
                    {result.pickup.country}
                  </span>

                  <span className="text-orange-400">
                    →
                  </span>

                  <span className="font-medium text-orange-900">
                    {result.dropoff.city},{" "}
                    {result.dropoff.country}
                  </span>

                </div>
              </div>
            )}
          </div>

          {/* MAP */}

          <LiveMap
            pickup={{
              ...result.pickup,
              address: result.pickup.city,
            }}
            dropoff={{
              ...result.dropoff,
              address: result.dropoff.city,
            }}
            driverPosition={
              result.lastLocation
            }
            locationHistory={
              result.locationHistory
            }
            isInternational={isInternationalShipment(
              result
            )}
          />

          {/* TRACKING TIMELINE */}

          <div
            className={`overflow-hidden rounded-2xl border shadow-lg ${
              dhlExpress
                ? "border-blue-300"
                : internationalCargo
                  ? "border-orange-300"
                  : "border-orange-200"
            }`}
          >

            {/* HEADER */}

            <div
              className={
                dhlExpress
                  ? "bg-gradient-to-r from-blue-800 via-blue-600 to-blue-800 p-5 text-white"
                  : "bg-gradient-to-r from-orange-700 via-orange-600 to-orange-700 p-5 text-white"
              }
            >
              <div className="flex items-center justify-between gap-3">

                <div className="flex items-center gap-2">

                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
                    {internationalCargo ? (
                      <Globe2 className="h-5 w-5" />
                    ) : (
                      <PackageSearch className="h-5 w-5" />
                    )}
                  </div>

                  <div>
                    <h2 className="text-sm font-bold">
                      Tracking Timeline
                    </h2>

                    <p
                      className={`mt-0.5 text-xs ${
                        dhlExpress
                          ? "text-blue-100"
                          : "text-orange-100"
                      }`}
                    >
                      Complete shipment history
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">

                  {refreshing && (
                    <RefreshCw className="h-4 w-4 animate-spin text-white" />
                  )}

                  <span className="rounded-full border border-white/20 bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                    Live Tracking
                  </span>
                </div>
              </div>
            </div>

            {/* CONTENT */}

            <div
              className={
                dhlExpress
                  ? "bg-gradient-to-b from-blue-50 via-blue-100/60 to-blue-50 p-5"
                  : "bg-gradient-to-b from-orange-50 via-orange-100/60 to-orange-50 p-5"
              }
            >

              {/* JOURNEY SUMMARY */}

              <div
                className={`mb-5 rounded-xl border bg-white/70 p-4 shadow-sm backdrop-blur-sm ${
                  dhlExpress
                    ? "border-blue-200"
                    : "border-orange-200"
                }`}
              >
                <div className="flex items-center gap-3">

                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full text-white shadow-md ${
                      dhlExpress
                        ? "bg-blue-600"
                        : "bg-orange-600"
                    }`}
                  >
                    <RefreshCw className="h-5 w-5" />
                  </div>

                  <div>
                    <p
                      className={`text-sm font-bold ${
                        dhlExpress
                          ? "text-blue-950"
                          : "text-orange-950"
                      }`}
                    >
                      Shipment Journey
                    </p>

                    <p
                      className={`mt-0.5 text-xs ${
                        dhlExpress
                          ? "text-blue-700"
                          : "text-orange-700"
                      }`}
                    >
                      Follow every update from pickup to delivery.
                    </p>
                  </div>

                </div>
              </div>

              {/* EVENTS */}

              {trackingEvents.length === 0 ? (
                <div
                  className={`rounded-xl border bg-white/70 p-6 text-center text-sm shadow-sm ${
                    dhlExpress
                      ? "border-blue-200 text-blue-700"
                      : "border-orange-200 text-orange-700"
                  }`}
                >
                  No tracking events are
                  available yet.
                </div>
              ) : (
                <ol
                  className={`relative ml-2 space-y-7 border-l-2 pl-7 ${
                    dhlExpress
                      ? "border-blue-300"
                      : "border-orange-300"
                  }`}
                >
                  {trackingEvents.map(
                    (event, index) => {
                      const isLatest =
                        index === 0;

                      const style =
                        getTrackingEventStyle(
                          event,
                          isLatest
                        );

                      return (
                        <li
                          key={`${event.source}-${event.status}-${event.at}-${index}`}
                          className="relative"
                        >
                          <span
                            className={`absolute -left-[39px] top-0 flex h-8 w-8 items-center justify-center rounded-full border-4 text-white shadow-md ${
                              dhlExpress
                                ? "border-blue-50"
                                : "border-orange-50"
                            } ${style.dot} ${
                              isLatest
                                ? dhlExpress
                                  ? "ring-4 ring-blue-200"
                                  : "ring-4 ring-orange-200"
                                : ""
                            }`}
                          >
                            {isLatest ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : (
                              <span className="h-2 w-2 rounded-full bg-white" />
                            )}
                          </span>

                          <div
                            className={`rounded-xl border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${style.card}`}
                          >
                            <div className="flex flex-wrap items-center gap-2">

                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm ${style.badge}`}
                              >
                                {getTrackingEventIcon(
                                  event
                                )}

                                {getTrackingEventLabel(
                                  event
                                )}
                              </span>

                              {isLatest && (
                                <span
                                  className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm ${
                                    dhlExpress
                                      ? "bg-blue-700"
                                      : "bg-orange-700"
                                  }`}
                                >
                                  Current
                                </span>
                              )}
                            </div>

                            <p
                              className={`mt-3 text-sm font-semibold ${style.text}`}
                            >
                              {getTrackingEventDescription(
                                event,
                                result
                              )}
                            </p>

                            <p
                              className={`mt-1.5 text-xs ${
                                dhlExpress
                                  ? "text-blue-600/70"
                                  : "text-orange-600/70"
                              }`}
                            >
                              {new Date(
                                event.at
                              ).toLocaleString()}
                            </p>
                          </div>
                        </li>
                      );
                    }
                  )}
                </ol>
              )}

              {/* AUTO UPDATE */}

              <div
                className={`mt-6 flex items-center justify-center gap-2 rounded-xl border bg-white/70 px-4 py-3 text-xs font-semibold shadow-sm ${
                  dhlExpress
                    ? "border-blue-200 text-blue-700"
                    : "border-orange-200 text-orange-700"
                }`}
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${
                    refreshing
                      ? "animate-spin"
                      : ""
                  }`}
                />

                Tracking updates automatically
              </div>
            </div>
          </div>

          {/* INTERNATIONAL EXPLANATION */}

          {internationalCargo && (
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">

              <div className="flex items-start gap-3">

                <Globe2 className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" />

                <div>
                  <p className="text-sm font-semibold text-orange-900">
                    International Cargo
                  </p>

                  <p className="mt-1 text-xs leading-5 text-orange-700">
                    This shipment is being tracked as
                    International Cargo. Its timeline
                    covers cargo receipt, export
                    processing, international transit,
                    destination processing, and final
                    delivery.
                  </p>
                </div>

              </div>
            </div>
          )}

          {/* CONTACT */}

          <p className="text-center text-xs text-neutral-400">

            Need help with this shipment?
            Contact us at{" "}

            <a
              href="mailto:Citybikelogistics1@gmail.com"
              className={`font-medium underline underline-offset-2 ${
                dhlExpress
                  ? "text-blue-600 decoration-blue-300 hover:text-blue-700"
                  : "text-orange-600 decoration-orange-300 hover:text-orange-700"
              }`}
            >
              Citybikelogistics1@gmail.com
            </a>

            {" "}or call +234 915 266 1473.

          </p>

        </div>
      )}

    </div>
  );
}