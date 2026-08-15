
"use client";

import { Suspense, useEffect, useState, FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { OrderStatus, PublicTrackingResult, SERVICE_TYPE_LABELS, DHLStatus, DHL_STATUS_LABELS } from "@/types";
import { supabase, orderStatusChannel } from "@/libs/supabaseClient";
import StatusBadge from "@/components/ui/statusbadge";
import LiveMap from "@/components/map/livemapClient";
import { Search, Globe2, PackageSearch, Truck } from "lucide-react";

function getTimelineDescription(
  status: OrderStatus,
  order: Pick<PublicTrackingResult, "pickup" | "dropoff">
): string {
  switch (status) {
    case "pending":
      return "Order placed";
    case "confirmed":
      return "Order confirmed by CityBike Logistics";
    case "assigned":
      return "Driver assigned to this delivery";
    case "picked_up":
      return `Picked up from ${order.pickup.city}`;
    case "awaiting_dispatch":
      return "Awaiting dispatch for the next shipment stage";
    case "dispatched":
      return "Package dispatched";
    case "in_transit":
      return `In transit to ${order.dropoff.city}`;
    case "destination_hub":
      return `Arrived at destination hub in ${order.dropoff.city}`;
    case "out_for_delivery":
      return `Out for delivery in ${order.dropoff.city}`;
    case "delivered":
      return `Delivered to ${order.dropoff.city}`;
    case "cancelled":
      return "Order cancelled";
    default:
      return "Status updated";
  }
}

function getDHLTimelineDescription(
  status: DHLStatus,
  description?: string,
  order?: Pick<PublicTrackingResult, "pickup" | "dropoff">
): string {
  if (description) return description;

  switch (status) {
    case "shipment_picked_up":
      return order ? `Picked up from ${order.pickup.city}` : "Shipment picked up";
    case "in_transit":
      return order ? `In transit to ${order.dropoff.city}` : "In transit";
    case "out_for_delivery":
      return order ? `Out for delivery in ${order.dropoff.city}` : "Out for delivery";
    case "delivered":
      return order ? `Delivered to ${order.dropoff.city}` : "Delivered";
    case "failed_delivery_attempt":
      return "Failed delivery attempt";
    case "returned":
      return "Returned to shipper";
    case "customs_cleared":
      return "Cleared customs";
    case "exception":
      return "Exception on shipment";
    default:
      return "Status updated";
  }
}

export default function PublicTrackPage() {
  return (
    <Suspense fallback={null}>
      <PublicTrackPageInner />
    </Suspense>
  );
}

function PublicTrackPageInner() {
  const searchParams = useSearchParams();
  const prefill = searchParams?.get("number") || "";

  const [input, setInput] = useState(prefill);
  const [result, setResult] = useState<PublicTrackingResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // If someone arrives via a link with ?number=..., pre-fill the box so
  // all they have to do is click "Track" — no results shown until then.
  useEffect(() => {
    if (prefill) {
      setInput(prefill);
    }
  }, [prefill]);

  // Subscribe to realtime status updates when viewing a specific order
  useEffect(() => {
    if (!result?.id) return;
    const channel = supabase.channel(orderStatusChannel(result.id));
    channel.on("broadcast", { event: "status-update" }, (payload) => {
      try {
        // payload contains the populated order object; update the UI
        setResult((prev) => ({ ...(prev || {}), ...(payload as Partial<PublicTrackingResult>) } as PublicTrackingResult));
      } catch (err) {
        // ignore
      }
    }).subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [result?.id]);

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    const cleaned = input.trim().replace(/[^a-zA-Z0-9]/g, "");
    if (!cleaned) return;
    setLoading(true);
    setError("");
    setResult(null);
    setSearched(true);
    try {
      const res = await fetch(`/api/public-track/${encodeURIComponent(cleaned)}`);

      let data: (PublicTrackingResult & { error?: undefined }) | { error: string } | null = null;
      try {
        data = await res.json();
      } catch {
        setError("Something went wrong while looking up this tracking number. Please try again.");
        return;
      }

      if (!res.ok || !data || "error" in data) {
        setError((data && "error" in data && data.error) || "Package not found");
        return;
      }
      setResult(data);
    } catch {
      setError("Could not reach the tracking service. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="text-center">
        <div className="mx-auto mb-3 inline-flex rounded-full bg-orange-100 p-3 text-orange-600">
          <PackageSearch className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold text-neutral-900 sm:text-3xl">
          Track Your Package
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          Enter your CityBike Logistics tracking number below — works for
          local, interstate, and international shipments.
        </p>
      </div>

      <form onSubmit={handleSearch} className="mx-auto mt-6 flex max-w-md gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. IBD26K3F9X2"
          className="w-full rounded-md border border-neutral-300 px-4 py-2.5 text-sm uppercase tracking-wide outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-1.5 rounded-md bg-orange-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-60"
        >
          <Search className="h-4 w-4" />
          {loading ? "Searching..." : "Track"}
        </button>
      </form>

      {searched && !loading && error && (
        <p className="mt-6 text-center text-sm text-red-600">{error}</p>
      )}

      {result && (
        <div className="mt-8 space-y-6">
          <div className="rounded-lg border border-neutral-200 bg-white p-5">
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
                <StatusBadge status={result.status} />
                {result.isInternational && (
                  <span className="flex items-center gap-1 rounded-full bg-black px-2.5 py-0.5 text-xs font-medium text-white">
                    <Globe2 className="h-3 w-3" />
                    International
                  </span>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-4 text-sm text-neutral-600">
              <span className="rounded-md bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-700">
                {SERVICE_TYPE_LABELS[result.serviceType]}
              </span>
              <span>
                From: {result.pickup.city}, {result.pickup.country}
              </span>
              <span>
                To: {result.dropoff.city}, {result.dropoff.country}
              </span>
              <span>
                Pickup: {new Date(result.pickupTime).toLocaleString()}
              </span>
              {result.eta && (
                <span>
                  ETA: {new Date(result.eta).toLocaleString()}
                </span>
              )}
            </div>
          </div>

          <LiveMap
            pickup={{ ...result.pickup, address: result.pickup.city }}
            dropoff={{ ...result.dropoff, address: result.dropoff.city }}
            driverPosition={result.lastLocation}
            locationHistory={result.locationHistory}
            isInternational={result.isInternational}
          />

          <div className="rounded-lg border border-neutral-200 bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold text-neutral-700">
              Tracking Timeline
            </h2>
            <ol className="relative space-y-6 border-l-2 border-neutral-200 pl-5">
              {result.statusHistory.map((h, i) => {
                const isLast = i === result.statusHistory.length - 1;
                return (
                  <li key={i} className="relative">
                    <span
                      className={`absolute -left-7 top-0.5 h-3 w-3 rounded-full border-2 border-white ${
                        isLast ? "bg-orange-500" : "bg-neutral-300"
                      }`}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={h.status} />
                      <span className="text-xs text-neutral-400">
                        {new Date(h.at).toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-neutral-700">
                      {getTimelineDescription(h.status, result)}
                    </p>
                  </li>
                );
              })}
            </ol>
          </div>

          {result.dhlStatusHistory && result.dhlStatusHistory.length > 0 && (
            <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-5">
              <div className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-blue-600" />
                <h2 className="text-sm font-semibold text-blue-900">
                  {result.carrierName || "DHL"} Tracking Timeline
                </h2>
              </div>
              {result.externalTrackingNumber && (
                <p className="mt-2 text-xs text-blue-700">
                  Tracking #: <span className="font-mono font-semibold">{result.externalTrackingNumber}</span>
                </p>
              )}
              <ol className="relative mt-4 space-y-6 border-l-2 border-blue-300 pl-5">
                {result.dhlStatusHistory.map((h, i) => {
                  const isLast = i === result.dhlStatusHistory!.length - 1;
                  return (
                    <li key={i} className="relative">
                      <span
                        className={`absolute -left-7 top-0.5 h-3 w-3 rounded-full border-2 border-white ${
                          isLast ? "bg-blue-600" : "bg-blue-300"
                        }`}
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-block rounded-full bg-blue-600 px-2.5 py-0.5 text-xs font-medium text-white">
                          {DHL_STATUS_LABELS[h.status as DHLStatus]}
                        </span>
                        <span className="text-xs text-blue-600">
                          {new Date(h.at).toLocaleString()}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-blue-900">
                        {getDHLTimelineDescription(h.status as DHLStatus, h.description, result)}
                      </p>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          <p className="text-center text-xs text-neutral-400">
            Need help with this shipment? Contact us at{" "}
            <a href="mailto:Citybikelogistics1@gmail.com" className="underline">
              Citybikelogistics1@gmail.com
            </a>{" "}
            or call +234 915 266 1473.
          </p>
        </div>
      )}
    </div>
  );
}

