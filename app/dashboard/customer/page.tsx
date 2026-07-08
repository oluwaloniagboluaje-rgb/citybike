"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { OrderClient, ServiceType, SERVICE_TYPE_LABELS, COUNTRY_OPTIONS } from "@/types";
import StatusBadge from "@/components/ui/statusbadge";
import { Plus, MapPin, Globe2 } from "lucide-react";

export default function CustomerDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<OrderClient[]>([]);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!loading && (!user || user.role !== "customer")) {
      router.push("/login");
    }
  }, [user, loading, router]);

  const fetchOrders = useCallback(async () => {
    const res = await fetch("/api/orders");
    if (res.ok) {
      const data = await res.json();
      setOrders(data.orders);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (user) fetchOrders();
  }, [user, fetchOrders]);

  if (loading || !user) return null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-900">My Orders</h1>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="flex items-center gap-1.5 rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
        >
          <Plus className="h-4 w-4" />
          New Order
        </button>
      </div>

      {showForm && (
        <NewOrderForm
          onCreated={() => {
            setShowForm(false);
            fetchOrders();
          }}
        />
      )}

      <div className="mt-6 space-y-3">
        {orders.length === 0 && (
          <p className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
            No orders yet. Create your first delivery request.
          </p>
        )}
        {orders.map((o) => (
          <Link
            key={o._id}
            href={`/orders/${o._id}`}
            className="block rounded-lg border border-neutral-200 bg-white p-4 hover:border-orange-300"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-xs font-semibold tracking-wide text-neutral-500">
                  #{o.trackingNumber}
                </p>
                <p className="mt-0.5 font-medium text-neutral-900">
                  {o.packageDescription}
                </p>
                <p className="mt-1 flex items-center gap-1 text-sm text-neutral-500">
                  <MapPin className="h-3.5 w-3.5" />
                  {o.pickup.city} → {o.dropoff.city}
                  {o.isInternational ? `, ${o.dropoff.country}` : ""}
                </p>
                {o.driver && (
                  <p className="mt-1 text-sm text-neutral-500">
                    Driver: {o.driver.name}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <StatusBadge status={o.status} />
                {o.isInternational && (
                  <span className="flex items-center gap-1 rounded-full bg-black px-2 py-0.5 text-[11px] font-medium text-white">
                    <Globe2 className="h-3 w-3" />
                    Intl
                  </span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function NewOrderForm({ onCreated }: { onCreated: () => void }) {
  const [pickupAddress, setPickupAddress] = useState("");
  const [pickupCity, setPickupCity] = useState("");
  const [pickupLat, setPickupLat] = useState("");
  const [pickupLng, setPickupLng] = useState("");
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [dropoffCity, setDropoffCity] = useState("");
  const [dropoffCountry, setDropoffCountry] = useState("Nigeria");
  const [dropoffLat, setDropoffLat] = useState("");
  const [dropoffLng, setDropoffLng] = useState("");
  const [serviceType, setServiceType] = useState<ServiceType>("local");
  const [packageDescription, setPackageDescription] = useState("");
  const [packageSize, setPackageSize] = useState<"small" | "medium" | "large">(
    "small"
  );
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [createdTrackingNumber, setCreatedTrackingNumber] = useState("");

  const isInternational = dropoffCountry.trim().toLowerCase() !== "nigeria";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup: {
            address: pickupAddress,
            city: pickupCity,
            country: "Nigeria",
            lat: parseFloat(pickupLat),
            lng: parseFloat(pickupLng),
          },
          dropoff: {
            address: dropoffAddress,
            city: dropoffCity,
            country: dropoffCountry,
            lat: parseFloat(dropoffLat),
            lng: parseFloat(dropoffLng),
          },
          serviceType,
          packageDescription,
          packageSize,
          recipientName,
          recipientPhone,
        }),
      });

      let data: { error?: string; order?: { trackingNumber?: string } } = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }

      if (!res.ok) {
        setError(data.error || "Could not create order");
        return;
      }
      setCreatedTrackingNumber(data.order.trackingNumber);
      setTimeout(onCreated, 1500);
    } finally {
      setSubmitting(false);
    }
  }

  if (createdTrackingNumber) {
    return (
      <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-5 text-center">
        <p className="text-sm text-green-700">Order created! Your tracking number is</p>
        <p className="mt-1 font-mono text-xl font-bold tracking-wide text-green-800">
          #{createdTrackingNumber}
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 space-y-4 rounded-lg border border-neutral-200 bg-white p-5"
    >
      <p className="text-xs text-neutral-500">
        Tip: use{" "}
        <a
          href="https://www.latlong.net/"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          latlong.net
        </a>{" "}
        to look up coordinates for an address.
      </p>

      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700">
          Service type
        </label>
        <select
          value={serviceType}
          onChange={(e) => setServiceType(e.target.value as ServiceType)}
          className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
        >
          {Object.entries(SERVICE_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <fieldset className="space-y-2 rounded-md border border-neutral-200 p-3">
          <legend className="px-1 text-xs font-semibold text-neutral-500">
            PICKUP (Nigeria)
          </legend>
          <input
            required
            placeholder="Street address"
            value={pickupAddress}
            onChange={(e) => setPickupAddress(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
          />
          <input
            required
            placeholder="City (e.g. Ibadan)"
            value={pickupCity}
            onChange={(e) => setPickupCity(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
          />
          <div className="flex gap-2">
            <input
              required
              type="number"
              step="any"
              placeholder="Latitude"
              value={pickupLat}
              onChange={(e) => setPickupLat(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
            />
            <input
              required
              type="number"
              step="any"
              placeholder="Longitude"
              value={pickupLng}
              onChange={(e) => setPickupLng(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
            />
          </div>
        </fieldset>

        <fieldset className="space-y-2 rounded-md border border-neutral-200 p-3">
          <legend className="px-1 text-xs font-semibold text-neutral-500">
            DROP-OFF {isInternational && "(International)"}
          </legend>
          <input
            required
            placeholder="Street address"
            value={dropoffAddress}
            onChange={(e) => setDropoffAddress(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
          />
          <input
            required
            placeholder="City"
            value={dropoffCity}
            onChange={(e) => setDropoffCity(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
          />
          <select
            value={dropoffCountry}
            onChange={(e) => setDropoffCountry(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
          >
            {COUNTRY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <input
              required
              type="number"
              step="any"
              placeholder="Latitude"
              value={dropoffLat}
              onChange={(e) => setDropoffLat(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
            />
            <input
              required
              type="number"
              step="any"
              placeholder="Longitude"
              value={dropoffLng}
              onChange={(e) => setDropoffLng(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
            />
          </div>
        </fieldset>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">
            Package description
          </label>
          <input
            required
            value={packageDescription}
            onChange={(e) => setPackageDescription(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">
            Package size
          </label>
          <select
            value={packageSize}
            onChange={(e) =>
              setPackageSize(e.target.value as "small" | "medium" | "large")
            }
            className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
          >
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">
            Recipient name
          </label>
          <input
            required
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">
            Recipient phone
          </label>
          <input
            required
            value={recipientPhone}
            onChange={(e) => setRecipientPhone(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-60"
      >
        {submitting ? "Submitting..." : "Submit Order"}
      </button>
    </form>
  );
}