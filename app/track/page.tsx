"use client";

import { useState, FormEvent } from "react";
import { PublicTrackingResult, SERVICE_TYPE_LABELS } from "@/types";
import StatusBadge from "@/components/ui/statusbadge";
import LiveMap from "@/components/map/livemapClient";
import { Search, Globe2, PackageSearch } from "lucide-react";

export default function PublicTrackPage() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<PublicTrackingResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

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
            <h2 className="mb-3 text-sm font-semibold text-neutral-700">
              Shipment Progress
            </h2>
            <ol className="space-y-2">
              {result.statusHistory.map((h, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-neutral-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                  <StatusBadge status={h.status} />
                  <span className="text-neutral-400">
                    {new Date(h.at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ol>
          </div>

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