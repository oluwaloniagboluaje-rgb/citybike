"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { OrderClient, OrderStatus } from "@/types";
import StatusBadge from "@/components/ui/statusbadge";
import { supabase, driverNotificationChannel, orderLocationChannel } from "@/libs/supabaseClient";
import { Bell, MapPin, Navigation, Globe2 } from "lucide-react";

const NEXT_STATUS: Partial<Record<OrderStatus, { next: OrderStatus; label: string }>> = {
  assigned: { next: "picked_up", label: "Mark Picked Up" },
  picked_up: { next: "in_transit", label: "Start Delivery" },
  in_transit: { next: "delivered", label: "Mark Delivered" },
};

export default function DriverDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<OrderClient[]>([]);
  const [newAssignmentPing, setNewAssignmentPing] = useState(false);
  const [sharingLocationFor, setSharingLocationFor] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!loading && (!user || user.role !== "driver")) {
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

  // Live-notify driver of new assignments
  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel(driverNotificationChannel(user.userId));
    channel
      .on("broadcast", { event: "new-assignment" }, () => {
        setNewAssignmentPing(true);
        fetchOrders();
        setTimeout(() => setNewAssignmentPing(false), 4000);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchOrders]);

  async function updateStatus(orderId: string, status: OrderStatus) {
    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      fetchOrders();
      if (status === "delivered") stopSharingLocation();
    }
  }

  function startSharingLocation(orderId: string) {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported in this browser.");
      return;
    }
    setSharingLocationFor(orderId);
    const channel = supabase.channel(orderLocationChannel(orderId));
    channel.subscribe();

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        channel.send({ type: "broadcast", event: "location", payload: coords });
        fetch(`/api/orders/${orderId}/location`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(coords),
        }).catch(() => {});
      },
      (err) => console.error("Geolocation error", err),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
    watchIdRef.current = id;
  }

  function stopSharingLocation() {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setSharingLocationFor(null);
  }

  if (loading || !user) return null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold text-neutral-900">My Deliveries</h1>
        {newAssignmentPing && (
          <span className="flex animate-pulse items-center gap-1 rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-700">
            <Bell className="h-3 w-3" />
            New delivery assigned
          </span>
        )}
      </div>

      <div className="mt-6 space-y-3">
        {orders.length === 0 && (
          <p className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
            No deliveries assigned to you yet.
          </p>
        )}
        {orders.map((o) => {
          const nextAction = NEXT_STATUS[o.status];
          const isSharing = sharingLocationFor === o._id;
          const canShareLocation = ["assigned", "picked_up", "in_transit"].includes(o.status);

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
                  <p className="mt-1 flex items-center gap-1 text-sm text-neutral-500">
                    <MapPin className="h-3.5 w-3.5" />
                    {o.pickup.city} → {o.dropoff.city}
                    {o.isInternational ? `, ${o.dropoff.country}` : ""}
                  </p>
                  <p className="mt-1 text-sm text-neutral-500">
                    Recipient: {o.recipientName} ({o.recipientPhone})
                  </p>
                  {o.eta && (
                    <p className="mt-1 text-sm text-neutral-500">
                      ETA: {new Date(o.eta).toLocaleString()}
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

              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-3">
                {nextAction && (
                  <button
                    onClick={() => updateStatus(o._id, nextAction.next)}
                    className="rounded-md bg-orange-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-700"
                  >
                    {nextAction.label}
                  </button>
                )}

                {canShareLocation && (
                  <button
                    onClick={() =>
                      isSharing ? stopSharingLocation() : startSharingLocation(o._id)
                    }
                    className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium ${
                      isSharing
                        ? "bg-green-100 text-green-700"
                        : "border border-neutral-300 text-neutral-700 hover:bg-neutral-50"
                    }`}
                  >
                    <Navigation className="h-3.5 w-3.5" />
                    {isSharing ? "Sharing Location..." : "Share Live Location"}
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