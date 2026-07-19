"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { OrderClient, OrderStatus } from "@/types";
import StatusBadge from "@/components/ui/statusbadge";
import { supabase, ADMIN_NOTIFICATIONS_CHANNEL } from "@/libs/supabaseClient";
import { Bell, MapPin, Globe2, MessageCircle } from "lucide-react";

interface Driver {
  _id: string;
  name: string;
  phone: string;
  vehicleType?: string;
  isAvailable?: boolean;
}

// Ordered progression of manual status updates admins walk interstate
// orders through after a driver has been assigned.
const INTERSTATE_NEXT_STATUS: Partial<Record<OrderStatus, { next: OrderStatus; label: string }>> = {
  assigned: { next: "picked_up", label: "Mark Picked Up" },
  picked_up: { next: "in_transit", label: "Mark In Transit" },
  in_transit: { next: "delivered", label: "Mark Delivered" },
};

// Converts a locally-formatted Nigerian number into the digits-only,
// country-code-prefixed format wa.me links require (no +, no spaces).
function toWhatsAppDigits(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, "");
  if (digits.startsWith("234")) return digits;
  if (digits.startsWith("0")) return `234${digits.slice(1)}`;
  return `234${digits}`;
}

function recipientWhatsAppLink(order: OrderClient): string {
  const message = `Hi ${order.recipientName}, a package is on its way to you via CityBike Logistics (from ${order.pickup.city} to ${order.dropoff.city}). Tracking number: #${order.trackingNumber}. You can track it anytime on our website.`;
  const to = toWhatsAppDigits(order.recipientPhone);
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
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold text-neutral-900">Admin Dashboard</h1>
        {newOrderPing && (
          <span className="flex animate-pulse items-center gap-1 rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-700">
            <Bell className="h-3 w-3" />
            New order received
          </span>
        )}
      </div>

      <div className="mt-6 space-y-3">
        {orders.length === 0 && (
          <p className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
            No orders yet.
          </p>
        )}
        {orders.map((o) => {
          const interstateNext =
            o.serviceType === "interstate" ? INTERSTATE_NEXT_STATUS[o.status] : undefined;

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
                    Customer:{" "}
                    {o.customer
                      ? `${o.customer.name} (${o.customer.phone})`
                      : "Unknown customer"}
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
                  {o.isInternational && (
                    <span className="flex items-center gap-1 rounded-full bg-black px-2 py-0.5 text-[11px] font-medium text-white">
                      <Globe2 className="h-3 w-3" />
                      Intl
                    </span>
                  )}
                </div>
              </div>

              {o.paymentMethod === "bank_transfer" && (
                <div className="mt-3 flex items-center gap-2 border-t border-neutral-100 pt-3 text-sm">
                  <span className="text-neutral-500">Payment:</span>
                  <span
                    className={
                      o.paymentStatus === "paid"
                        ? "font-medium text-green-700"
                        : "font-medium text-yellow-700"
                    }
                  >
                    {o.paymentStatus === "paid" ? "Paid" : "Pending"}
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

                  {!o.proofOfPaymentUrl && o.paymentStatus === "pending" && (
                    <span className="text-xs text-neutral-400">
                      Awaiting proof of payment upload
                    </span>
                  )}
                </div>
              )}

              {o.serviceType === "interstate" && (
                <div className="mt-3 border-t border-neutral-100 pt-3 text-xs text-neutral-500">
                  Interstate order — customer is notified by email at every
                  status update below.
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

                {o.status === "confirmed" && (
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

                {interstateNext && (
                  <button
                    onClick={() => advanceStatus(o._id, interstateNext.next)}
                    disabled={updatingStatus === o._id}
                    className="rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50"
                  >
                    {updatingStatus === o._id ? "Updating..." : interstateNext.label}
                  </button>
                )}

                <a
                  href={recipientWhatsAppLink(o)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  Notify Recipient on WhatsApp
                </a>

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