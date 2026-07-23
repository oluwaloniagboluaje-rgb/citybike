"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { OrderClient, OrderStatus, SERVICE_TYPE_LABELS } from "@/types";
import StatusBadge from "@/components/ui/statusbadge";
import LiveMap from "@/components/map/livemapClient";
import ChatBox from "@/components/chat/chatBox";
import { supabase, orderLocationChannel } from "@/libs/supabaseClient";
import { ArrowLeft, Package, User as UserIcon, Truck, Globe2, Copy } from "lucide-react";

// Builds a human-readable, location-aware description for each status
// history entry, e.g. "Picked up from Ibadan" or "In transit to Lagos".
function getTimelineDescription(
  status: OrderStatus,
  order: Pick<OrderClient, "pickup" | "dropoff">
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
    case "in_transit":
      return `In transit to ${order.dropoff.city}`;
    case "delivered":
      return `Delivered to ${order.dropoff.city}`;
    case "cancelled":
      return "Order cancelled";
    default:
      return "Status updated";
  }
}

export default function OrderDetailPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const orderId = params.orderId as string;

  const [order, setOrder] = useState<OrderClient | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [driverPosition, setDriverPosition] = useState<{ lat: number; lng: number } | null>(
    null
  );

  const fetchOrder = useCallback(async () => {
    const res = await fetch(`/api/orders/${orderId}`);
    if (res.ok) {
      const data = await res.json();
      setOrder(data.order);
      if (data.order.lastLocation) {
        setDriverPosition({
          lat: data.order.lastLocation.lat,
          lng: data.order.lastLocation.lng,
        });
      }
    } else {
      const data = await res.json();
      setError(data.error || "Could not load order");
    }
  }, [orderId]);

  async function cancelOrder() {
    if (!order) return;
    const confirmCancel = window.confirm(
      "Are you sure you want to cancel this order? This action cannot be undone."
    );
    if (!confirmCancel) return;

    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });

    if (res.ok) {
      await fetchOrder();
      setError("");
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Could not cancel order");
    }
  }

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
      return;
    }
    if (user) {
      fetchOrder();
    }
  }, [user, loading, router, fetchOrder]);

  // Subscribe to live driver location broadcast
  useEffect(() => {
    if (!orderId) return;
    const channel = supabase.channel(orderLocationChannel(orderId));
    channel
      .on("broadcast", { event: "location" }, (payload) => {
        setDriverPosition(payload.payload as { lat: number; lng: number });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  // Poll for order status changes every 10s as a fallback to realtime
  useEffect(() => {
    const interval = setInterval(fetchOrder, 10000);
    return () => clearInterval(interval);
  }, [fetchOrder]);

  function copyTrackingNumber() {
    if (!order) return;
    navigator.clipboard.writeText(order.trackingNumber).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (loading || !user) return null;

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-neutral-600">{error}</p>
        <Link href="/" className="mt-4 inline-block text-orange-600 underline">
          Go home
        </Link>
      </div>
    );
  }

  if (!order) {
    return <div className="mx-auto max-w-4xl px-4 py-8 text-neutral-500">Loading order...</div>;
  }

  const dashboardHref =
    user.role === "admin"
      ? "/dashboard/admin"
      : user.role === "driver"
        ? "/dashboard/driver"
        : "/dashboard/customer";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link
        href={dashboardHref}
        className="mb-4 inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to dashboard
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-neutral-900">
            <Package className="h-6 w-6 text-orange-600" />
            {order.packageDescription}
          </h1>
          <button
            onClick={copyTrackingNumber}
            title="Copy tracking number"
            className="mt-1 flex items-center gap-1.5 text-sm font-mono font-semibold tracking-wide text-neutral-700 hover:text-orange-600"
          >
            #{order.trackingNumber}
            <Copy className="h-3.5 w-3.5" />
            {copied && <span className="text-xs font-sans text-green-600">Copied!</span>}
          </button>
          <p className="mt-1 text-sm text-neutral-500">
            {order.pickup.address}, {order.pickup.city} → {order.dropoff.address}, {order.dropoff.city}
            {order.isInternational ? `, ${order.dropoff.country}` : ""}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <StatusBadge status={order.status} />
          {order.isInternational && (
            <span className="flex items-center gap-1 rounded-full bg-black px-2.5 py-0.5 text-xs font-medium text-white">
              <Globe2 className="h-3 w-3" />
              International
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-sm text-neutral-600">
        <span className="rounded-md bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-700">
          {SERVICE_TYPE_LABELS[order.serviceType]}
        </span>
        <span className="flex items-center gap-1.5">
          <UserIcon className="h-4 w-4" />
          Sender:{" "}
          {order.customer
            ? order.customer.name
            : order.senderName
            ? `${order.senderName}${order.isAdminCreated ? " (walk-in)" : ""}`
            : "Unknown"}
        </span>
        {order.driver && (
          <span className="flex items-center gap-1.5">
            <Truck className="h-4 w-4" />
            Driver: {order.driver.name} ({order.driver.phone})
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-sm text-neutral-600">
        <span>
          Pickup time: {new Date(order.pickupTime).toLocaleString()}
        </span>
        {order.eta && (
          <span>
            Estimated arrival: {new Date(order.eta).toLocaleString()}
          </span>
        )}
      </div>

      {order.status !== "delivered" && order.status !== "cancelled" && (
        <div className="mt-4">
          <button
            onClick={cancelOrder}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Cancel Order
          </button>
          {error && (
            <p className="mt-2 text-sm text-red-600">{error}</p>
          )}
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <LiveMap
          pickup={order.pickup}
          dropoff={order.dropoff}
          driverPosition={driverPosition}
          locationHistory={order.locationHistory}
          isInternational={order.isInternational}
        />
        <ChatBox orderId={order._id} />
      </div>

      <div className="mt-6 rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="mb-4 text-sm font-semibold text-neutral-700">
          Tracking Timeline
        </h2>
        <ol className="relative space-y-6 border-l-2 border-neutral-200 pl-5">
          {order.statusHistory.map((h, i) => {
            const isLast = i === order.statusHistory.length - 1;
            return (
              <li key={i} className="relative">
                <span
                  className={`absolute -left-[27px] top-0.5 h-3 w-3 rounded-full border-2 border-white ${
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
                  {getTimelineDescription(h.status, order)}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}