"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { OrderClient, OrderStatus, ServiceType, SERVICE_TYPE_LABELS, COUNTRY_OPTIONS } from "@/types";
import StatusBadge from "@/components/ui/statusbadge";
import { supabase, ADMIN_NOTIFICATIONS_CHANNEL } from "@/libs/supabaseClient";
import { geocodeAddress } from "@/libs/geocode";
import { Bell, MapPin, Globe2, MessageCircle, Plus } from "lucide-react";

interface Driver {
  _id: string;
  name: string;
  phone: string;
  vehicleType?: string;
  isAvailable?: boolean;
}

const NEXT_STATUS: Partial<Record<OrderStatus, { next: OrderStatus; label: string }>> = {
  assigned: { next: "picked_up", label: "Mark Picked Up" },
  picked_up: { next: "in_transit", label: "Mark In Transit" },
  in_transit: { next: "delivered", label: "Mark Delivered" },
};

function toWhatsAppDigits(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, "");
  if (digits.startsWith("234")) return digits;
  if (digits.startsWith("0")) return `234${digits.slice(1)}`;
  return `234${digits}`;
}

function trackingUrlFor(trackingNumber: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/track?number=${encodeURIComponent(trackingNumber)}`;
}

function recipientWhatsAppLink(order: OrderClient): string {
  const message = `Hi ${order.recipientName}, a package is on its way to you via CityBike Logistics (from ${order.pickup.city} to ${order.dropoff.city}). Tracking number: #${order.trackingNumber}. Track it here: ${trackingUrlFor(order.trackingNumber)}`;
  const to = toWhatsAppDigits(order.recipientPhone);
  return `https://wa.me/${to}?text=${encodeURIComponent(message)}`;
}

function senderWhatsAppLink(order: OrderClient): string {
  const senderName = order.senderName || order.customer?.name || "there";
  const message = `Hi ${senderName}, your CityBike Logistics order has been created. Tracking number: #${order.trackingNumber}. Track it here: ${trackingUrlFor(order.trackingNumber)}`;
  const phone = order.senderPhone || order.customer?.phone || "";
  const to = toWhatsAppDigits(phone);
  return `https://wa.me/${to}?text=${encodeURIComponent(message)}`;
}

export default function AdminDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<OrderClient[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<Record<string, string>>(
    {}
  );
  const [newOrderPing, setNewOrderPing] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) {
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

  const fetchDrivers = useCallback(async () => {
    const res = await fetch("/api/drivers");
    if (res.ok) {
      const data = await res.json();
      setDrivers(data.drivers);
    }
  }, []);

  useEffect(() => {
    if (user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchOrders();
      fetchDrivers();
    }
  }, [user, fetchOrders, fetchDrivers]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel(ADMIN_NOTIFICATIONS_CHANNEL);
    channel
      .on("broadcast", { event: "new-order" }, () => {
        setNewOrderPing(true);
        fetchOrders();
        setTimeout(() => setNewOrderPing(false), 4000);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchOrders]);

  async function confirmOrder(orderId: string) {
    await fetch(`/api/orders/${orderId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "confirmed" }),
    });
    fetchOrders();
  }

  async function cancelOrder(orderId: string) {
    const confirmCancel = window.confirm(
      "Are you sure you want to cancel this order? This action cannot be undone."
    );
    if (!confirmCancel) return;

    await fetch(`/api/orders/${orderId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    fetchOrders();
  }

  async function advanceStatus(orderId: string, nextStatus: OrderStatus) {
    setUpdatingStatus(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) fetchOrders();
    } finally {
      setUpdatingStatus(null);
    }
  }

  async function assignDriver(orderId: string) {
    const driverId = selectedDriver[orderId];
    if (!driverId) return;
    const res = await fetch(`/api/orders/${orderId}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ driverId }),
    });
    if (res.ok) fetchOrders();
  }

  async function markAsPaid(orderId: string) {
    const res = await fetch(`/api/orders/${orderId}/payment-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentStatus: "paid" }),
    });
    if (res.ok) fetchOrders();
  }

  if (loading || !user) return null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-neutral-900">Admin Dashboard</h1>
          {newOrderPing && (
            <span className="flex animate-pulse items-center gap-1 rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-700">
              <Bell className="h-3 w-3" />
              New order received
            </span>
          )}
        </div>
        <button
          onClick={() => setShowCreateForm((s) => !s)}
          className="flex items-center gap-1.5 rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
        >
          <Plus className="h-4 w-4" />
          Create Order for Client
        </button>
      </div>

      {showCreateForm && (
        <AdminCreateOrderForm
          onCreated={() => {
            setShowCreateForm(false);
            fetchOrders();
          }}
        />
      )}

      <div className="mt-6 space-y-3">
        {orders.length === 0 && (
          <p className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
            No orders yet.
          </p>
        )}
        {orders.map((o) => {
          const nextAction = NEXT_STATUS[o.status];

          return (
            <div key={o._id} className="rounded-lg border border-neutral-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs font-semibold tracking-wide text-neutral-500">
                    #{o.trackingNumber}
                  </p>
                  <Link href={`/orders/${o._id}`} className="mt-0.5 block font-medium text-neutral-900 hover:underline">
                    {o.packageDescription}
                  </Link>

                  <div className="mt-1.5 space-y-1 text-sm text-neutral-500">
                    <p className="flex items-start gap-1.5">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />
                      <span>
                        <span className="font-medium text-neutral-600">Pickup:</span>{" "}
                        {o.pickup.address}, {o.pickup.city}
                        {o.pickup.country !== "Nigeria" ? `, ${o.pickup.country}` : ""}
                      </span>
                    </p>
                    <p className="flex items-start gap-1.5">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                      <span>
                        <span className="font-medium text-neutral-600">Drop-off:</span>{" "}
                        {o.dropoff.address}, {o.dropoff.city}
                        {o.isInternational ? `, ${o.dropoff.country}` : ""}
                      </span>
                    </p>
                  </div>

                  {o.eta && (
                    <p className="mt-1 text-sm text-neutral-500">
                      ETA: {new Date(o.eta).toLocaleString()}
                    </p>
                  )}
                  <p className="mt-1 text-sm text-neutral-500">
                    Sender:{" "}
                    {o.customer
                      ? `${o.customer.name} (${o.customer.phone})`
                      : o.senderName
                      ? `${o.senderName} (${o.senderPhone}) — walk-in`
                      : "Unknown"}
                  </p>
                  <p className="mt-1 text-sm text-neutral-500">
                    Recipient: {o.recipientName} ({o.recipientPhone})
                  </p>
                  {o.driver && (
                    <p className="mt-1 text-sm text-neutral-500">
                      Driver: {o.driver.name}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <StatusBadge status={o.status} />
                  {o.isAdminCreated && (
                    <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-[11px] font-medium text-white">
                      Walk-in
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

              {(o.paymentMethod === "bank_transfer" || o.paymentMethod === "cash") && (
                <div className="mt-3 flex items-center gap-2 border-t border-neutral-100 pt-3 text-sm">
                  <span className="text-neutral-500">Payment:</span>
                  <span
                    className={
                      o.paymentStatus === "paid"
                        ? "font-medium text-green-700"
                        : "font-medium text-yellow-700"
                    }
                  >
                    {o.paymentStatus === "paid"
                      ? o.paymentMethod === "cash"
                        ? "Paid (Cash)"
                        : "Paid"
                      : "Pending"}
                  </span>

                  {o.proofOfPaymentUrl && o.paymentStatus === "pending" && (
                    <div className="flex items-center gap-2">
                      <a
                        href={o.proofOfPaymentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline"
                      >
                        View Proof
                      </a>
                      <button
                        onClick={() => markAsPaid(o._id)}
                        className="rounded-md bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700"
                      >
                        Mark as Paid
                      </button>
                    </div>
                  )}

                  {!o.proofOfPaymentUrl && o.paymentStatus === "pending" && o.paymentMethod === "bank_transfer" && (
                    <button
                      onClick={() => markAsPaid(o._id)}
                      className="rounded-md bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700"
                    >
                      Mark as Paid
                    </button>
                  )}
                </div>
              )}

              {o.customer?.email && (
                <div className="mt-3 border-t border-neutral-100 pt-3 text-xs text-neutral-500">
                  Customer is notified by email at every status update below.
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-3">
                {o.status === "pending" && (
                  <button
                    onClick={() => confirmOrder(o._id)}
                    className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                  >
                    Confirm Order
                  </button>
                )}

                {(o.status === "confirmed" || o.status === "pending") && (
                  <>
                    <select
                      value={selectedDriver[o._id] || ""}
                      onChange={(e) =>
                        setSelectedDriver((prev) => ({
                          ...prev,
                          [o._id]: e.target.value,
                        }))
                      }
                      className="rounded-md border border-neutral-300 px-2 py-1.5 text-xs"
                    >
                      <option value="">Select driver...</option>
                      {drivers.map((d) => (
                        <option key={d._id} value={d._id}>
                          {d.name} {d.vehicleType ? `(${d.vehicleType})` : ""}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => assignDriver(o._id)}
                      disabled={!selectedDriver[o._id]}
                      className="rounded-md bg-orange-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-700 disabled:opacity-50"
                    >
                      Assign Driver
                    </button>
                  </>
                )}

                {nextAction && (
                  <button
                    onClick={() => advanceStatus(o._id, nextAction.next)}
                    disabled={updatingStatus === o._id}
                    className="rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50"
                  >
                    {updatingStatus === o._id ? "Updating..." : nextAction.label}
                  </button>
                )}

                <a
                  href={recipientWhatsAppLink(o)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  Notify Recipient
                </a>

                {(o.senderPhone || o.customer?.phone) && (
                  <a
                    href={senderWhatsAppLink(o)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-md border border-green-600 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    Send Tracking to Sender
                  </a>
                )}

                {o.status !== "delivered" && o.status !== "cancelled" && (
                  <button
                    onClick={() => cancelOrder(o._id)}
                    className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                  >
                    Cancel Order
                  </button>
                )}

                <Link
                  href={`/orders/${o._id}`}
                  className="ml-auto rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  View & Chat
                </Link>
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
}

interface CreatedOrder {
  _id: string;
  trackingNumber: string;
}

function AdminCreateOrderForm({ onCreated }: { onCreated: () => void }) {
  const [senderName, setSenderName] = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  const [pickupAddress, setPickupAddress] = useState("");
  const [pickupCity, setPickupCity] = useState("");
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [dropoffCity, setDropoffCity] = useState("");
  const [dropoffCountry, setDropoffCountry] = useState("Nigeria");
  const [serviceType, setServiceType] = useState<ServiceType>("local");
  const [packageDescription, setPackageDescription] = useState("");
  const [packageSize, setPackageSize] = useState<"small" | "medium" | "large">("small");
  const [weightKg, setWeightKg] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"bank_transfer" | "cash">("cash");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<CreatedOrder | null>(null);

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

      const res = await fetch("/api/orders/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderName,
          senderPhone,
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
    } finally {
      setSubmitting(false);
    }
  }

  if (createdOrder) {
    const trackingUrl = trackingUrlFor(createdOrder.trackingNumber);
    const message = `Hi ${senderName}, your CityBike Logistics order has been created. Tracking number: #${createdOrder.trackingNumber}. Track it here: ${trackingUrl}`;
    const whatsappHref = `https://wa.me/${toWhatsAppDigits(senderPhone)}?text=${encodeURIComponent(message)}`;

    return (
      <div className="mt-4 space-y-4 rounded-lg border border-green-200 bg-green-50 p-5 text-center">
        <p className="text-sm text-green-700">Order created! Tracking number:</p>
        <p className="mt-1 font-mono text-xl font-bold tracking-wide text-green-800">
          #{createdOrder.trackingNumber}
        </p>
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
        >
          <MessageCircle className="h-4 w-4" />
          Send Tracking Number to Sender on WhatsApp
        </a>
        <div>
          <button
            onClick={onCreated}
            className="mt-3 text-sm font-medium text-neutral-600 underline"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 space-y-4 rounded-lg border border-neutral-200 bg-white p-5"
    >
      <h2 className="text-sm font-semibold text-neutral-800">
        Create Order on Behalf of a Client
      </h2>

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
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">
            Sender name
          </label>
          <input
            required
            value={senderName}
            onChange={(e) => setSenderName(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">
            Sender phone
          </label>
          <input
            required
            value={senderPhone}
            onChange={(e) => setSenderPhone(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
          />
        </div>
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
            onChange={(e) => setPackageSize(e.target.value as "small" | "medium" | "large")}
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
          Payment
        </label>
        <select
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value as "bank_transfer" | "cash")}
          className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
        >
          <option value="cash">Cash (received in person)</option>
          <option value="bank_transfer">Bank Transfer</option>
        </select>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-60"
      >
        {submitting ? "Locating addresses & submitting..." : "Create Order"}
      </button>
    </form>
  );
}