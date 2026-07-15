"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { OrderClient, ServiceType, SERVICE_TYPE_LABELS, COUNTRY_OPTIONS } from "@/types";
import StatusBadge from "@/components/ui/statusbadge";
import { Plus, MapPin, Globe2 } from "lucide-react";
import { uploadPaymentProof } from "@/libs/uploadPaymentProof";
import { geocodeAddress } from "@/libs/geocode";

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
                {o.eta && (
                  <p className="mt-1 text-sm text-neutral-500">
                    ETA: {new Date(o.eta).toLocaleString()}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <StatusBadge status={o.status} />
                {o.price != null && (
                  <span className="text-xs font-medium text-neutral-500">
                    ₦{o.price.toLocaleString()}
                  </span>
                )}
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

interface CreatedOrder {
  _id: string;
  trackingNumber: string;
  paymentMethod: "bank_transfer" | "paystack";
  paymentStatus: "pending" | "paid" | "failed";
  price?: number;
}

function NewOrderForm({ onCreated }: { onCreated: () => void }) {
  const [pickupAddress, setPickupAddress] = useState("");
  const [pickupCity, setPickupCity] = useState("");
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [dropoffCity, setDropoffCity] = useState("");
  const [dropoffCountry, setDropoffCountry] = useState("Nigeria");
  const [serviceType, setServiceType] = useState<ServiceType>("local");
  const [packageDescription, setPackageDescription] = useState("");
  const [packageSize, setPackageSize] = useState<"small" | "medium" | "large">(
    "small"
  );
  const [weightKg, setWeightKg] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"bank_transfer" | "paystack">(
    "bank_transfer"
  );
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<CreatedOrder | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);

  const isInternational = dropoffCountry.trim().toLowerCase() !== "nigeria";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      let pickupLoc, dropoffLoc;
      try {
        pickupLoc = await geocodeAddress(pickupAddress, pickupCity, "Nigeria");
      } catch {
        setError("Could not locate the pickup address. Please check it and try again.");
        return;
      }
      try {
        dropoffLoc = await geocodeAddress(dropoffAddress, dropoffCity, dropoffCountry);
      } catch {
        setError("Could not locate the drop-off address. Please check it and try again.");
        return;
      }

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup: {
            address: pickupAddress,
            city: pickupCity,
            country: "Nigeria",
            lat: pickupLoc.lat,
            lng: pickupLoc.lng,
          },
          dropoff: {
            address: dropoffAddress,
            city: dropoffCity,
            country: dropoffCountry,
            lat: dropoffLoc.lat,
            lng: dropoffLoc.lng,
          },
          serviceType,
          packageDescription,
          packageSize,
          weightKg: isInternational && weightKg ? parseFloat(weightKg) : undefined,
          recipientName,
          recipientPhone,
          paymentMethod,
        }),
      });

      let data: { error?: string; order?: CreatedOrder } = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }

      if (!res.ok || !data.order) {
        setError(data.error || "Could not create order");
        return;
      }
      setCreatedOrder(data.order);
      if (paymentMethod !== "bank_transfer") {
        setTimeout(onCreated, 1500);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleProofUpload(file: File) {
    if (!createdOrder) return;
    setUploading(true);
    try {
      const url = await uploadPaymentProof(createdOrder._id, file);
      const res = await fetch(`/api/orders/${createdOrder._id}/payment-proof`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proofUrl: url }),
      });
      if (res.ok) {
        setUploadDone(true);
        setTimeout(onCreated, 1500);
      } else {
        setError("Could not save proof of payment, please try again.");
      }
    } catch {
      setError("Upload failed, please try again.");
    } finally {
      setUploading(false);
    }
  }

  if (createdOrder) {
    return (
      <div className="mt-4 space-y-4 rounded-lg border border-green-200 bg-green-50 p-5 text-center">
        <p className="text-sm text-green-700">Order created! Your tracking number is</p>
        <p className="mt-1 font-mono text-xl font-bold tracking-wide text-green-800">
          #{createdOrder.trackingNumber}
        </p>
        {createdOrder.price != null && (
          <p className="mt-1 text-sm text-neutral-700">
            Estimated cost:{" "}
            <span className="font-semibold">₦{createdOrder.price.toLocaleString()}</span>
          </p>
        )}

        {createdOrder.paymentMethod === "bank_transfer" && !uploadDone && (
          <div className="mt-4 rounded-lg border border-orange-200 bg-orange-50 p-4 text-left">
            <h3 className="text-sm font-semibold text-orange-800">
              💳 Payment Details – CityBike Logistics
            </h3>
            <p className="mt-1 text-sm text-orange-700">
              Kindly make payment to:
            </p>
            <div className="mt-2 text-sm text-neutral-700">
              <p><strong>Bank:</strong> Moniepoint MFB</p>
              <p><strong>Account Name:</strong> CityBike Logistics Global Service Ltd</p>
              <p><strong>Account Number:</strong> 5256910759</p>
            </div>
            <p className="mt-2 text-xs text-orange-700">
              ✅ Please send payment confirmation after transfer to{" "}
              <a
                href="mailto:Citybikelogistics1@gmail.com"
                className="underline"
              >
                Citybikelogistics1@gmail.com
              </a>
              . Thank you!
            </p>

            <input
              type="file"
              accept="image/*,.pdf"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleProofUpload(file);
              }}
              className="mt-3 block text-sm"
            />
            {uploading && (
              <p className="mt-2 text-xs text-neutral-500">Uploading...</p>
            )}
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          </div>
        )}

        {uploadDone && (
          <p className="mt-2 text-sm text-green-700">
            Proof uploaded! We&apos;ll confirm your payment shortly.
          </p>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 space-y-4 rounded-lg border border-neutral-200 bg-white p-5"
    >
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

        {isInternational && (
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">
              Package weight (kg)
            </label>
            <input
              required
              type="number"
              step="any"
              min="0.1"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
            />
          </div>
        )}

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

      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700">
          Payment Method
        </label>
        <select
          value={paymentMethod}
          onChange={(e) =>
            setPaymentMethod(e.target.value as "bank_transfer" | "paystack")
          }
          className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
        >
          <option value="bank_transfer">Bank Transfer</option>
          <option value="paystack" disabled>
            Card Payment (Paystack) — coming soon
          </option>
        </select>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-60"
      >
        {submitting ? "Locating addresses & submitting..." : "Submit Order"}
      </button>
    </form>
  );
}