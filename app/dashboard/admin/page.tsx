"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import {
  OrderClient,
  OrderStatus,
  ServiceType,
  SERVICE_TYPE_LABELS,
  STATUS_LABELS,
  COUNTRY_OPTIONS,
  DHLStatus,
  DHL_STATUS_LABELS,
} from "@/types";
import StatusBadge from "@/components/ui/statusbadge";
import {
  supabase,
  ADMIN_NOTIFICATIONS_CHANNEL,
} from "@/libs/supabaseClient";
import { geocodeAddress } from "@/libs/geocode";
import { uploadPackagePhoto } from "@/libs/uploadPackagePhoto";
import {
  groupByDate,
  filterOrdersByDate,
  DateFilterValue,
} from "@/libs/dateGroups";
import OrderDateFilter from "@/components/orders/OrderDateFilter";
import StatusModal, {
  StatusModalState,
  CLOSED_MODAL,
} from "@/components/ui/StatusModal";
import {
  Bell,
  MapPin,
  Globe2,
  MessageCircle,
  Plus,
  Camera,
  Check,
} from "lucide-react";

interface Driver {
  _id: string;
  name: string;
  phone: string;
  vehicleType?: string;
  isAvailable?: boolean;
}

const NEXT_STATUS: Partial<
  Record<OrderStatus, { next: OrderStatus; label: string }>
> = {
  assigned: { next: "picked_up", label: "Mark Picked Up" },
  picked_up: { next: "in_transit", label: "Start Delivery" },
  in_transit: { next: "delivered", label: "Mark Delivered" },
};

const INTERSTATE_NEXT_STATUS: Partial<
  Record<OrderStatus, { next: OrderStatus; label: string }>
> = {
  confirmed: { next: "picked_up", label: "Mark Picked Up" },
  picked_up: {
    next: "awaiting_dispatch",
    label: "Mark Awaiting Dispatch",
  },
  awaiting_dispatch: {
    next: "dispatched",
    label: "Mark Dispatched",
  },
  dispatched: {
    next: "in_transit",
    label: "Mark In Transit",
  },
  in_transit: {
    next: "destination_hub",
    label: "Mark Destination Hub",
  },
  destination_hub: {
    next: "out_for_delivery",
    label: "Mark Out for Delivery",
  },
  out_for_delivery: {
    next: "delivered",
    label: "Mark Delivered",
  },
};

const STATUS_OPTIONS_BY_SERVICE: Record<ServiceType, OrderStatus[]> = {
  local: [
    "pending",
    "confirmed",
    "assigned",
    "picked_up",
    "in_transit",
    "delivered",
    "cancelled",
  ],
  interstate: [
    "confirmed",
    "picked_up",
    "awaiting_dispatch",
    "dispatched",
    "in_transit",
    "destination_hub",
    "out_for_delivery",
    "delivered",
    "cancelled",
  ],
  international: [
    "shipment_created",
    "awaiting_batching",
    "added_to_batch",
    "ready_for_shipping",
    "left_origin",
    "in_transit",
    "landed",
    "customs_processing",
    "confirmed",
    "assigned",
    "assigned_courier",
    "picked_up",
    "delivered_by_courier",
    "delivery_confirmed",
    "delivered",
    "cancelled",
  ],
  dhl_express: [
    "shipment_created",
    "awaiting_batching",
    "added_to_batch",
    "ready_for_shipping",
    "left_origin",
    "in_transit",
    "landed",
    "customs_processing",
    "confirmed",
    "assigned",
    "assigned_courier",
    "picked_up",
    "delivered_by_courier",
    "delivery_confirmed",
    "delivered",
    "cancelled",
  ],
  ecommerce: [
    "pending",
    "confirmed",
    "assigned",
    "picked_up",
    "in_transit",
    "delivered",
    "cancelled",
  ],
  errand: [
    "pending",
    "confirmed",
    "assigned",
    "picked_up",
    "delivered",
    "cancelled",
  ],
  corporate: [
    "pending",
    "confirmed",
    "assigned",
    "picked_up",
    "in_transit",
    "delivered",
    "cancelled",
  ],
};

function getStatusOptionsForOrder(order: OrderClient): OrderStatus[] {
  return (
    STATUS_OPTIONS_BY_SERVICE[order.serviceType] ??
    STATUS_OPTIONS_BY_SERVICE.local
  );
}

/*
 * Added only for dashboard categorisation.
 *
 * local / ecommerce / errand / corporate
 *      -> Local Deliveries
 *
 * interstate
 *      -> Interstate Deliveries
 *
 * international / dhl_express
 *      -> International Cargo
 */
function getOrderCategory(
  serviceType: ServiceType
): "local" | "interstate" | "international" {
  if (serviceType === "interstate") {
    return "interstate";
  }

  if (
    serviceType === "international" ||
    serviceType === "dhl_express"
  ) {
    return "international";
  }

  return "local";
}

function toWhatsAppDigits(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, "");

  if (digits.startsWith("234")) return digits;

  if (digits.startsWith("0")) {
    return `234${digits.slice(1)}`;
  }

  return `234${digits}`;
}

function trackingUrlFor(trackingNumber: string): string {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";

  return `${origin}/track?number=${encodeURIComponent(trackingNumber)}`;
}

function statusMessageFor(order: OrderClient): string {
  switch (order.status) {
    case "pending":
      return "Your order has been received and is awaiting confirmation.";

    case "confirmed":
      return "Your order has been confirmed.";

    case "assigned":
      return "A driver has been assigned and will pick up the package shortly.";

    case "picked_up":
      return `Your package has been picked up from ${order.pickup.city}.`;

    case "awaiting_dispatch":
      return "Your package is awaiting dispatch and is being prepared for the next handoff.";

    case "dispatched":
      return "Your package has been dispatched and is moving toward its destination.";

    case "destination_hub":
      return `Your package has reached the destination hub for ${order.dropoff.city}.`;

    case "out_for_delivery":
      return `Your package is out for delivery in ${order.dropoff.city}.`;

    case "in_transit":
      return `Your package is in transit to ${order.dropoff.city}.`;

    case "delivered":
      return `Your package has been delivered to ${order.dropoff.city}.`;

    case "cancelled":
      return "Your order has been cancelled.";

    default:
      return "Your order status has been updated.";
  }
}

function recipientWhatsAppLink(order: OrderClient): string {
  const message = `Hi ${order.recipientName}, this is CityBike Logistics with an update on your delivery. ${statusMessageFor(
    order
  )} Tracking number: #${order.trackingNumber}. Track it here: ${trackingUrlFor(
    order.trackingNumber
  )}`;

  const to = toWhatsAppDigits(order.recipientPhone);

  return `https://wa.me/${to}?text=${encodeURIComponent(message)}`;
}

function senderWhatsAppLink(order: OrderClient): string {
  const senderName =
    order.senderName || order.customer?.name || "there";

  const message = `Hi ${senderName}, this is CityBike Logistics with an update on your order. ${statusMessageFor(
    order
  )} Tracking number: #${order.trackingNumber}. Track it here: ${trackingUrlFor(
    order.trackingNumber
  )}`;

  const phone =
    order.senderPhone || order.customer?.phone || "";

  const to = toWhatsAppDigits(phone);

  return `https://wa.me/${to}?text=${encodeURIComponent(message)}`;
}

export default function AdminDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [orders, setOrders] = useState<OrderClient[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);

  const [selectedDriver, setSelectedDriver] = useState<
    Record<string, string>
  >({});

  const [selectedStatus, setSelectedStatus] = useState<
    Record<string, string>
  >({});

  const [newOrderPing, setNewOrderPing] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(
    null
  );

  const [showCreateForm, setShowCreateForm] = useState(false);

  const [dateFilter, setDateFilter] =
    useState<DateFilterValue>("today");

  /*
   * NEW:
   * Controls which type of order is shown in the dashboard.
   */
  const [orderCategory, setOrderCategory] = useState<
    "all" | "local" | "interstate" | "international"
  >("all");

  const [uploadingPhotoFor, setUploadingPhotoFor] = useState<
    string | null
  >(null);

  const [modal, setModal] =
    useState<StatusModalState>(CLOSED_MODAL);

  const [carrierTrackingInputs, setCarrierTrackingInputs] =
    useState<Record<string, string>>({});

  const [savingCarrierTrackingFor, setSavingCarrierTrackingFor] =
    useState<string | null>(null);

  const [dhlStatusInputs, setDhlStatusInputs] = useState<
    Record<string, string>
  >({});

  const [dhlDescriptionInputs, setDhlDescriptionInputs] = useState<
    Record<string, string>
  >({});

  const [savingDhlStatusFor, setSavingDhlStatusFor] = useState<
    string | null
  >(null);

  const pickupFileInputRef = useRef<HTMLInputElement | null>(null);
  const deliveryFileInputRef = useRef<HTMLInputElement | null>(null);

  const activeOrderIdRef = useRef<string | null>(null);

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
      fetchOrders();
      fetchDrivers();
    }
  }, [user, fetchOrders, fetchDrivers]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel(
      ADMIN_NOTIFICATIONS_CHANNEL
    );

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
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: "confirmed",
      }),
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
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: "cancelled",
      }),
    });

    fetchOrders();
  }

  async function advanceStatus(
    orderId: string,
    nextStatus: OrderStatus
  ) {
    setUpdatingStatus(orderId);

    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: nextStatus,
        }),
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
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        driverId,
      }),
    });

    if (res.ok) fetchOrders();
  }

  async function setCustomStatus(orderId: string) {
    const status = selectedStatus[orderId];

    if (!status) return;

    setUpdatingStatus(orderId);

    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status,
        }),
      });

      if (res.ok) {
        fetchOrders();
      } else {
        const data = await res.json().catch(() => ({}));

        setModal({
          open: true,
          variant: "error",
          title: "Could not update status",
          message:
            data.error || "Failed to update status.",
        });
      }
    } finally {
      setUpdatingStatus(null);
    }
  }

  async function markAsPaid(orderId: string) {
    const res = await fetch(
      `/api/orders/${orderId}/payment-status`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          paymentStatus: "paid",
        }),
      }
    );

    if (res.ok) fetchOrders();
  }

  function triggerPickupPhoto(orderId: string) {
    activeOrderIdRef.current = orderId;
    pickupFileInputRef.current?.click();
  }

  function triggerDeliveryPhoto(orderId: string) {
    activeOrderIdRef.current = orderId;
    deliveryFileInputRef.current?.click();
  }

  async function handlePhotoSelected(
    e: React.ChangeEvent<HTMLInputElement>,
    stage: "pickup" | "delivery"
  ) {
    const file = e.target.files?.[0];
    const orderId = activeOrderIdRef.current;

    e.target.value = "";

    if (!file || !orderId) return;

    setUploadingPhotoFor(orderId);

    try {
      const photoUrl = await uploadPackagePhoto(
        orderId,
        stage,
        file
      );

      const res = await fetch(
        `/api/orders/${orderId}/photos`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            stage,
            photoUrl,
          }),
        }
      );

      if (res.ok) {
        fetchOrders();

        setModal({
          open: true,
          variant: "success",
          title: "Photo saved",
          message: `The ${stage} photo was uploaded successfully.`,
        });
      } else {
        const data = await res.json().catch(() => ({}));

        setModal({
          open: true,
          variant: "error",
          title: "Could not save photo",
          message:
            data.error ||
            "The photo uploaded but could not be saved to the order. Please try again.",
        });
      }
    } catch (err) {
      setModal({
        open: true,
        variant: "error",
        title: "Upload failed",
        message:
          err instanceof Error
            ? err.message
            : "The photo could not be uploaded. Please check your connection and try again.",
      });
    } finally {
      setUploadingPhotoFor(null);
    }
  }

  async function saveCarrierTracking(orderId: string) {
    const value = carrierTrackingInputs[orderId]?.trim();

    if (!value) return;

    setSavingCarrierTrackingFor(orderId);

    try {
      const res = await fetch(
        `/api/orders/${orderId}/carrier-tracking`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            externalTrackingNumber: value,
            carrierName: "DHL",
          }),
        }
      );

      if (res.ok) {
        fetchOrders();

        setModal({
          open: true,
          variant: "success",
          title: "DHL tracking number saved",
          message:
            "This is stored for internal reference only and is never shown to the customer.",
        });
      } else {
        const data = await res.json().catch(() => ({}));

        setModal({
          open: true,
          variant: "error",
          title: "Could not save",
          message: data.error || "Please try again.",
        });
      }
    } finally {
      setSavingCarrierTrackingFor(null);
    }
  }

  async function saveDhlStatus(orderId: string) {
    const status = dhlStatusInputs[orderId]?.trim();

    if (!status) return;

    setSavingDhlStatusFor(orderId);

    try {
      const res = await fetch(
        `/api/orders/${orderId}/dhl-status`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status,
            description:
              dhlDescriptionInputs[orderId]?.trim() ||
              undefined,
          }),
        }
      );

      if (res.ok) {
        fetchOrders();

        setDhlStatusInputs((prev) => ({
          ...prev,
          [orderId]: "",
        }));

        setDhlDescriptionInputs((prev) => ({
          ...prev,
          [orderId]: "",
        }));

        setModal({
          open: true,
          variant: "success",
          title: "DHL status updated",
          message:
            "The customer will see this update on their tracking page.",
        });
      } else {
        const data = await res.json().catch(() => ({}));

        setModal({
          open: true,
          variant: "error",
          title: "Could not update DHL status",
          message: data.error || "Please try again.",
        });
      }
    } finally {
      setSavingDhlStatusFor(null);
    }
  }

  if (loading || !user) return null;

  /*
   * Filter the orders BEFORE grouping them by date.
   *
   * This is what prevents Local, Interstate and International
   * orders from being mixed together when a category is selected.
   */
  const filteredOrders = filterOrdersByDate(
    orders,
    dateFilter
  ).filter((order) => {
    if (orderCategory === "all") return true;

    return (
      getOrderCategory(order.serviceType) === orderCategory
    );
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <input
        ref={pickupFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) =>
          handlePhotoSelected(e, "pickup")
        }
      />

      <input
        ref={deliveryFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) =>
          handlePhotoSelected(e, "delivery")
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-neutral-900">
            Admin Dashboard
          </h1>

          {newOrderPing && (
            <span className="flex animate-pulse items-center gap-1 rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-700">
              <Bell className="h-3 w-3" />
              New order received
            </span>
          )}
        </div>

        <button
          onClick={() =>
            setShowCreateForm((s) => !s)
          }
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

      <OrderDateFilter
        value={dateFilter}
        onChange={setDateFilter}
      />

      {/* =====================================================
          ORDER CATEGORY FILTER
          ===================================================== */}
      <div className="mt-4 flex flex-wrap gap-2">
        {[
          {
            value: "all",
            label: "All Orders",
          },
          {
            value: "local",
            label: "Local Deliveries",
          },
          {
            value: "interstate",
            label: "Interstate Deliveries",
          },
          {
            value: "international",
            label: "International Cargo",
          },
        ].map((tab) => {
          const active =
            orderCategory === tab.value;

          return (
            <button
              key={tab.value}
              type="button"
              onClick={() =>
                setOrderCategory(
                  tab.value as
                    | "all"
                    | "local"
                    | "interstate"
                    | "international"
                )
              }
              className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                active
                  ? "bg-orange-600 text-white"
                  : "border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* =====================================================
          ORDER LIST
          ===================================================== */}
      <div className="mt-4 space-y-6">
        {orders.length === 0 && (
          <p className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
            No orders yet.
          </p>
        )}

        {orders.length > 0 &&
          filteredOrders.length === 0 && (
            <p className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
              No orders in this category for this day.
            </p>
          )}

        {groupByDate(filteredOrders).map((group) => (
          <div key={group.label}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
              {group.label}
            </h2>

            <div className="space-y-3">
              {group.items.map((o) => {
                const nextAction =
                  o.serviceType === "interstate"
                    ? INTERSTATE_NEXT_STATUS[o.status]
                    : NEXT_STATUS[o.status];

                const isUploadingThis =
                  uploadingPhotoFor === o._id;

                return (
                  <div
                    key={o._id}
                    className="rounded-lg border border-neutral-200 bg-white p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-xs font-semibold tracking-wide text-neutral-500">
                          #{o.trackingNumber}
                        </p>

                        <Link
                          href={`/orders/${o._id}`}
                          className="mt-0.5 block font-medium text-neutral-900 hover:underline"
                        >
                          {o.packageDescription}
                        </Link>

                        <div className="mt-1.5 space-y-1 text-sm text-neutral-500">
                          <p className="flex items-start gap-1.5">
                            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />

                            <span>
                              <span className="font-medium text-neutral-600">
                                Pickup:
                              </span>{" "}
                              {o.pickup.address},{" "}
                              {o.pickup.city}
                              {o.pickup.country !==
                                "Nigeria"
                                ? `, ${o.pickup.country}`
                                : ""}
                            </span>
                          </p>

                          <p className="flex items-start gap-1.5">
                            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />

                            <span>
                              <span className="font-medium text-neutral-600">
                                Drop-off:
                              </span>{" "}
                              {o.dropoff.address},{" "}
                              {o.dropoff.city}
                              {o.isInternational
                                ? `, ${o.dropoff.country}`
                                : ""}
                            </span>
                          </p>
                        </div>

                        {o.eta && (
                          <p className="mt-1 text-sm text-neutral-500">
                            ETA:{" "}
                            {new Date(
                              o.eta
                            ).toLocaleString()}
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
                          Recipient: {o.recipientName} (
                          {o.recipientPhone})
                        </p>

                        {o.driver && (
                          <p className="mt-1 text-sm text-neutral-500">
                            Driver: {o.driver.name}
                          </p>
                        )}

                        {(o.serviceType ===
                          "dhl_express" ||
                          o.serviceType ===
                            "international") && (
                          <div className="mt-2 rounded-md bg-neutral-50 p-2">
                            <p className="text-xs font-medium text-neutral-500">
                              Carrier tracking (internal only —
                              not shown to customer)
                            </p>

                            {o.externalTrackingNumber ? (
                              <p className="mt-1 flex items-center gap-2 text-sm text-neutral-700">
                                <span className="font-mono">
                                  {o.carrierName ||
                                    "DHL"}
                                  :{" "}
                                  {
                                    o.externalTrackingNumber
                                  }
                                </span>

                                <button
                                  onClick={() =>
                                    setCarrierTrackingInputs(
                                      (prev) => ({
                                        ...prev,
                                        [o._id]:
                                          o.externalTrackingNumber ||
                                          "",
                                      })
                                    )
                                  }
                                  className="text-xs font-medium text-orange-600 underline"
                                >
                                  Edit
                                </button>
                              </p>
                            ) : null}

                            {(carrierTrackingInputs[
                              o._id
                            ] !== undefined ||
                              !o.externalTrackingNumber) && (
                              <div className="mt-1 flex items-center gap-2">
                                <input
                                  value={
                                    carrierTrackingInputs[
                                      o._id
                                    ] ?? ""
                                  }
                                  onChange={(e) =>
                                    setCarrierTrackingInputs(
                                      (prev) => ({
                                        ...prev,
                                        [o._id]:
                                          e.target.value,
                                      })
                                    )
                                  }
                                  placeholder="Enter DHL tracking number"
                                  className="w-full rounded-md border border-neutral-300 px-2 py-1 text-xs"
                                />

                                <button
                                  onClick={() =>
                                    saveCarrierTracking(
                                      o._id
                                    )
                                  }
                                  disabled={
                                    savingCarrierTrackingFor ===
                                      o._id ||
                                    !carrierTrackingInputs[
                                      o._id
                                    ]?.trim()
                                  }
                                  className="shrink-0 rounded-md bg-neutral-800 px-2 py-1 text-xs font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
                                >
                                  {savingCarrierTrackingFor ===
                                  o._id
                                    ? "Saving..."
                                    : "Save"}
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {o.externalTrackingNumber &&
                          o.carrierName === "DHL" && (
                            <div className="mt-2 rounded-md bg-blue-50 p-2">
                              <p className="text-xs font-medium text-blue-700">
                                DHL Tracking Updates (shown
                                to customer)
                              </p>

                              {o.dhlStatusHistory &&
                                o.dhlStatusHistory.length >
                                  0 && (
                                  <div className="mt-2 space-y-2 border-t border-blue-100 pt-2">
                                    {o.dhlStatusHistory.map(
                                      (
                                        h: any,
                                        idx: number
                                      ) => (
                                        <div
                                          key={idx}
                                          className="flex items-start gap-2 text-xs text-blue-700"
                                        >
                                          <span className="mt-1 inline-block h-2 w-2 rounded-full bg-blue-600" />

                                          <div>
                                            <span className="font-medium">
                                              {h.status}
                                            </span>{" "}
                                            -{" "}
                                            {new Date(
                                              h.at
                                            ).toLocaleString()}

                                            {h.description && (
                                              <p className="text-[11px] text-blue-600">
                                                {
                                                  h.description
                                                }
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      )
                                    )}
                                  </div>
                                )}

                              <div className="mt-2 space-y-2">
                                <select
                                  value={
                                    dhlStatusInputs[
                                      o._id
                                    ] ?? ""
                                  }
                                  onChange={(e) =>
                                    setDhlStatusInputs(
                                      (prev) => ({
                                        ...prev,
                                        [o._id]:
                                          e.target.value,
                                      })
                                    )
                                  }
                                  className="w-full rounded-md border border-blue-300 px-2 py-1 text-xs"
                                >
                                  <option value="">
                                    Select DHL status...
                                  </option>
                                  <option value="shipment_picked_up">
                                    Shipment Picked Up
                                  </option>
                                  <option value="in_transit">
                                    In Transit
                                  </option>
                                  <option value="out_for_delivery">
                                    Out for Delivery
                                  </option>
                                  <option value="delivered">
                                    Delivered
                                  </option>
                                  <option value="failed_delivery_attempt">
                                    Failed Delivery Attempt
                                  </option>
                                  <option value="returned">
                                    Returned to Shipper
                                  </option>
                                  <option value="customs_cleared">
                                    Customs Cleared
                                  </option>
                                  <option value="exception">
                                    Exception
                                  </option>
                                </select>

                                <input
                                  value={
                                    dhlDescriptionInputs[
                                      o._id
                                    ] ?? ""
                                  }
                                  onChange={(e) =>
                                    setDhlDescriptionInputs(
                                      (prev) => ({
                                        ...prev,
                                        [o._id]:
                                          e.target.value,
                                      })
                                    )
                                  }
                                  placeholder="Optional: Add description (shown to customer)"
                                  className="w-full rounded-md border border-blue-300 px-2 py-1 text-xs"
                                />

                                <button
                                  onClick={() =>
                                    saveDhlStatus(o._id)
                                  }
                                  disabled={
                                    savingDhlStatusFor ===
                                      o._id ||
                                    !dhlStatusInputs[
                                      o._id
                                    ]?.trim()
                                  }
                                  className="w-full rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                                >
                                  {savingDhlStatusFor ===
                                  o._id
                                    ? "Updating..."
                                    : "Add DHL Status Update"}
                                </button>
                              </div>
                            </div>
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

                    {(o.paymentMethod ===
                      "bank_transfer" ||
                      o.paymentMethod === "cash") && (
                      <div className="mt-3 flex items-center gap-2 border-t border-neutral-100 pt-3 text-sm">
                        <span className="text-neutral-500">
                          Payment:
                        </span>

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

                        {o.proofOfPaymentUrl &&
                          o.paymentStatus === "pending" && (
                            <div className="flex items-center gap-2">
                              <a
                                href={
                                  o.proofOfPaymentUrl
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 underline"
                              >
                                View Proof
                              </a>

                              <button
                                onClick={() =>
                                  markAsPaid(o._id)
                                }
                                className="rounded-md bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700"
                              >
                                Mark as Paid
                              </button>
                            </div>
                          )}

                        {!o.proofOfPaymentUrl &&
                          o.paymentStatus ===
                            "pending" &&
                          o.paymentMethod ===
                            "bank_transfer" && (
                            <button
                              onClick={() =>
                                markAsPaid(o._id)
                              }
                              className="rounded-md bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700"
                            >
                              Mark as Paid
                            </button>
                          )}
                      </div>
                    )}

                    {o.customer?.email && (
                      <div className="mt-3 border-t border-neutral-100 pt-3 text-xs text-neutral-500">
                        Customer is notified by email at
                        every status update below.
                      </div>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-3">
                      {o.status === "pending" && (
                        <button
                          onClick={() =>
                            confirmOrder(o._id)
                          }
                          className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                        >
                          Confirm Order
                        </button>
                      )}

                      {(o.status === "confirmed" ||
                        o.status === "pending") && (
                        <>
                          <select
                            value={
                              selectedDriver[o._id] ||
                              ""
                            }
                            onChange={(e) =>
                              setSelectedDriver(
                                (prev) => ({
                                  ...prev,
                                  [o._id]:
                                    e.target.value,
                                })
                              )
                            }
                            className="rounded-md border border-neutral-300 px-2 py-1.5 text-xs"
                          >
                            <option value="">
                              Select driver...
                            </option>

                            {drivers.map((d) => (
                              <option
                                key={d._id}
                                value={d._id}
                              >
                                {d.name}{" "}
                                {d.vehicleType
                                  ? `(${d.vehicleType})`
                                  : ""}
                              </option>
                            ))}
                          </select>

                          <button
                            onClick={() =>
                              assignDriver(o._id)
                            }
                            disabled={
                              !selectedDriver[o._id]
                            }
                            className="rounded-md bg-orange-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-700 disabled:opacity-50"
                          >
                            Assign Driver
                          </button>
                        </>
                      )}

                      {nextAction && (
                        <button
                          onClick={() =>
                            advanceStatus(
                              o._id,
                              nextAction.next
                            )
                          }
                          disabled={
                            updatingStatus === o._id
                          }
                          className="rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50"
                        >
                          {updatingStatus === o._id
                            ? "Updating..."
                            : nextAction.label}
                        </button>
                      )}

                      <div className="flex items-center gap-2">
                        <select
                          value={
                            selectedStatus[o._id] ?? ""
                          }
                          onChange={(e) =>
                            setSelectedStatus(
                              (prev) => ({
                                ...prev,
                                [o._id]:
                                  e.target.value,
                              })
                            )
                          }
                          className="rounded-md border border-neutral-300 px-2 py-1.5 text-xs"
                        >
                          <option value="">
                            Set status...
                          </option>

                          {getStatusOptionsForOrder(
                            o
                          ).map((status) => (
                            <option
                              key={status}
                              value={status}
                            >
                              {STATUS_LABELS[status]}
                            </option>
                          ))}
                        </select>

                        <button
                          onClick={() =>
                            setCustomStatus(o._id)
                          }
                          disabled={
                            !selectedStatus[o._id] ||
                            updatingStatus === o._id
                          }
                          className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700 disabled:opacity-50"
                        >
                          Update
                        </button>
                      </div>

                      <a
                        href={recipientWhatsAppLink(o)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        Notify Recipient (
                        {STATUS_LABELS[o.status]})
                      </a>

                      {(o.senderPhone ||
                        o.customer?.phone) && (
                        <a
                          href={senderWhatsAppLink(o)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 rounded-md border border-green-600 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          Notify Sender (
                          {STATUS_LABELS[o.status]})
                        </a>
                      )}

                      <button
                        onClick={() =>
                          triggerPickupPhoto(o._id)
                        }
                        disabled={isUploadingThis}
                        className="flex items-center gap-1 rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                      >
                        {o.pickupPhotoUrl ? (
                          <Check className="h-3.5 w-3.5 text-green-600" />
                        ) : (
                          <Camera className="h-3.5 w-3.5" />
                        )}

                        {isUploadingThis
                          ? "Uploading..."
                          : o.pickupPhotoUrl
                          ? "Replace Pickup Photo"
                          : "Upload Pickup Photo"}
                      </button>

                      <button
                        onClick={() =>
                          triggerDeliveryPhoto(o._id)
                        }
                        disabled={isUploadingThis}
                        className="flex items-center gap-1 rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                      >
                        {o.deliveryPhotoUrl ? (
                          <Check className="h-3.5 w-3.5 text-green-600" />
                        ) : (
                          <Camera className="h-3.5 w-3.5" />
                        )}

                        {isUploadingThis
                          ? "Uploading..."
                          : o.deliveryPhotoUrl
                          ? "Replace Delivery Photo"
                          : "Upload Delivery Photo"}
                      </button>

                      {o.status !== "delivered" &&
                        o.status !== "cancelled" && (
                          <button
                            onClick={() =>
                              cancelOrder(o._id)
                            }
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
        ))}
      </div>

      <StatusModal
        state={modal}
        onClose={() => setModal(CLOSED_MODAL)}
      />
    </div>
  );
}

interface CreatedOrder {
  _id: string;
  trackingNumber: string;
}

function AdminCreateOrderForm({
  onCreated,
}: {
  onCreated: () => void;
}) {
  const [senderName, setSenderName] = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(
    null
  );
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<
    Array<{
      _id: string;
      name: string;
      email: string;
      phone?: string;
    }>
  >([]);
  const [customerSearching, setCustomerSearching] =
    useState(false);

  const [pickupAddress, setPickupAddress] = useState("");
  const [pickupCity, setPickupCity] = useState("");
  const [pickupState, setPickupState] = useState("");
  const [pickupPostalCode, setPickupPostalCode] =
    useState("");

  const [dropoffAddress, setDropoffAddress] = useState("");
  const [dropoffCity, setDropoffCity] = useState("");
  const [dropoffState, setDropoffState] = useState("");
  const [dropoffPostalCode, setDropoffPostalCode] =
    useState("");

  const [dropoffCountry, setDropoffCountry] =
    useState("Nigeria");

  const [serviceType, setServiceType] =
    useState<ServiceType>("local");

  const [packageDescription, setPackageDescription] =
    useState("");

  const [packageSize, setPackageSize] = useState<
    "small" | "medium" | "large"
  >("small");

  const [weightKg, setWeightKg] = useState("");

  const [recipientName, setRecipientName] =
    useState("");

  const [recipientPhoneCode, setRecipientPhoneCode] =
    useState("+234");

  const [recipientPhone, setRecipientPhone] =
    useState("");

  const [paymentMethod, setPaymentMethod] = useState<
    "bank_transfer" | "cash"
  >("cash");

  const [notifyByEmail, setNotifyByEmail] =
    useState(true);

  const [notifyBySms, setNotifyBySms] =
    useState(false);

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [createdOrder, setCreatedOrder] =
    useState<CreatedOrder | null>(null);

  const isInternational =
    dropoffCountry.trim().toLowerCase() !== "nigeria";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setError("");
    setSubmitting(true);

    try {
      let pickupLoc;
      let dropoffLoc;

      try {
        pickupLoc = await geocodeAddress(
          pickupAddress,
          pickupCity,
          "Nigeria"
        );
      } catch {
        setError(
          "Could not locate the pickup address. Please check it and try again."
        );
        return;
      }

      try {
        dropoffLoc = await geocodeAddress(
          dropoffAddress,
          dropoffCity,
          dropoffCountry
        );
      } catch {
        setError(
          "Could not locate the drop-off address. Please check it and try again."
        );
        return;
      }

      const payload: any = {
        customerEmail,
        senderName,
        senderPhone,

        pickup: {
          address: pickupAddress,
          city: pickupCity,
          country: "Nigeria",
          state: pickupState || undefined,
          postalCode:
            pickupPostalCode || undefined,
          lat: pickupLoc.lat,
          lng: pickupLoc.lng,
        },

        dropoff: {
          address: dropoffAddress,
          city: dropoffCity,
          country: dropoffCountry,
          state: dropoffState || undefined,
          postalCode:
            dropoffPostalCode || undefined,
          lat: dropoffLoc.lat,
          lng: dropoffLoc.lng,
        },

        serviceType,
        packageDescription,
        packageSize,

        weightKg:
          isInternational && weightKg
            ? parseFloat(weightKg)
            : undefined,

        recipientName,
        recipientPhone,
        paymentMethod,
      };

      if (customerId) {
        payload.customerId = customerId;
      }

      payload.notifyByEmail = notifyByEmail;
      payload.notifyBySms = notifyBySms;

      const res = await fetch("/api/orders/admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      let data: {
        error?: string;
        order?: CreatedOrder;
      } = {};

      try {
        data = await res.json();
      } catch {
        data = {};
      }

      if (!res.ok || !data.order) {
        setError(
          data.error || "Could not create order"
        );
        return;
      }

      setCreatedOrder(data.order);
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => {
      if (
        !customerQuery ||
        customerQuery.trim().length < 2
      ) {
        setCustomerResults([]);
        return;
      }

      setCustomerSearching(true);

      fetch(
        `/api/users/search?q=${encodeURIComponent(
          customerQuery
        )}`
      )
        .then((r) => r.json())
        .then((data) => {
          setCustomerResults(data.users || []);
        })
        .catch(() => setCustomerResults([]))
        .finally(() =>
          setCustomerSearching(false)
        );
    }, 300);

    return () => clearTimeout(t);
  }, [customerQuery]);

  if (createdOrder) {
    const trackingUrl = trackingUrlFor(
      createdOrder.trackingNumber
    );

    const message = `Hi ${senderName}, your CityBike Logistics order has been created. Tracking number: #${createdOrder.trackingNumber}. Track it here: ${trackingUrl}`;

    const whatsappHref = `https://wa.me/${toWhatsAppDigits(
      senderPhone
    )}?text=${encodeURIComponent(message)}`;

    return (
      <div className="mt-4 space-y-4 rounded-lg border border-green-200 bg-green-50 p-5 text-center">
        <p className="text-sm text-green-700">
          Order created! Tracking number:
        </p>

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
          onChange={(e) =>
            setServiceType(
              e.target.value as ServiceType
            )
          }
          className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
        >
          {Object.entries(
            SERVICE_TYPE_LABELS
          ).map(([value, label]) => (
            <option
              key={value}
              value={value}
            >
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
            onChange={(e) =>
              setSenderName(e.target.value)
            }
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
            onChange={(e) =>
              setSenderPhone(e.target.value)
            }
            className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-neutral-700">
            Search existing customer (name or email)
          </label>

          <input
            value={customerQuery}
            onChange={(e) => {
              setCustomerQuery(e.target.value);
              setCustomerId(null);
              setCustomerEmail(e.target.value);
            }}
            placeholder="Type to search — or type an email to create a new customer"
            className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
          />

          {customerSearching && (
            <p className="text-xs text-neutral-500">
              Searching...
            </p>
          )}

          {customerResults.length > 0 && (
            <div className="mt-1 max-h-48 w-full overflow-auto rounded-md border border-neutral-200 bg-white">
              {customerResults.map((u) => (
                <button
                  key={u._id}
                  type="button"
                  onClick={() => {
                    setCustomerId(u._id);
                    setCustomerEmail(u.email);
                    setCustomerQuery(
                      `${u.name} <${u.email}>`
                    );
                    setCustomerResults([]);
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-neutral-50"
                >
                  <div className="font-medium">
                    {u.name}
                  </div>

                  <div className="text-xs text-neutral-500">
                    {u.email}{" "}
                    {u.phone
                      ? `· ${u.phone}`
                      : ""}
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="mt-2">
            <label className="mb-1 block text-sm font-medium text-neutral-700">
              Customer email (recipient)
            </label>

            <input
              value={customerEmail}
              onChange={(e) =>
                setCustomerEmail(e.target.value)
              }
              placeholder="customer@example.com"
              className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
            />
          </div>
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
            onChange={(e) =>
              setPickupAddress(e.target.value)
            }
            className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
          />

          <input
            required
            placeholder="City (e.g. Ibadan)"
            value={pickupCity}
            onChange={(e) =>
              setPickupCity(e.target.value)
            }
            className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
          />

          <input
            placeholder="State / region (e.g. Oyo)"
            value={pickupState}
            onChange={(e) =>
              setPickupState(e.target.value)
            }
            className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
          />

          <input
            placeholder="Postcode / ZIP"
            value={pickupPostalCode}
            onChange={(e) =>
              setPickupPostalCode(e.target.value)
            }
            className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
          />
        </fieldset>

        <fieldset className="space-y-2 rounded-md border border-neutral-200 p-3">
          <legend className="px-1 text-xs font-semibold text-neutral-500">
            DROP-OFF{" "}
            {isInternational &&
              "(International)"}
          </legend>

          <input
            required
            placeholder="Street address"
            value={dropoffAddress}
            onChange={(e) =>
              setDropoffAddress(e.target.value)
            }
            className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
          />

          <input
            required
            placeholder="City"
            value={dropoffCity}
            onChange={(e) =>
              setDropoffCity(e.target.value)
            }
            className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
          />

          <input
            placeholder="State / region"
            value={dropoffState}
            onChange={(e) =>
              setDropoffState(e.target.value)
            }
            className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
          />

          <input
            placeholder="Postcode / ZIP"
            value={dropoffPostalCode}
            onChange={(e) =>
              setDropoffPostalCode(e.target.value)
            }
            className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
          />

          <select
            value={dropoffCountry}
            onChange={(e) =>
              setDropoffCountry(e.target.value)
            }
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
            onChange={(e) =>
              setPackageDescription(e.target.value)
            }
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
              setPackageSize(
                e.target.value as
                  | "small"
                  | "medium"
                  | "large"
              )
            }
            className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
          >
            <option value="small">
              Small
            </option>
            <option value="medium">
              Medium
            </option>
            <option value="large">
              Large
            </option>
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
              onChange={(e) =>
                setWeightKg(e.target.value)
              }
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
            onChange={(e) =>
              setRecipientName(e.target.value)
            }
            className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">
            Recipient phone
          </label>

          <div className="flex gap-2">
            <input
              value={recipientPhoneCode}
              onChange={(e) =>
                setRecipientPhoneCode(
                  e.target.value
                )
              }
              placeholder="+234"
              className="w-24 rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
            />

            <input
              required
              value={recipientPhone}
              onChange={(e) =>
                setRecipientPhone(e.target.value)
              }
              className="flex-1 rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
            />
          </div>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700">
          Payment
        </label>

        <select
          value={paymentMethod}
          onChange={(e) =>
            setPaymentMethod(
              e.target.value as
                | "bank_transfer"
                | "cash"
            )
          }
          className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
        >
          <option value="cash">
            Cash (received in person)
          </option>
          <option value="bank_transfer">
            Bank Transfer
          </option>
        </select>
      </div>

      <div className="flex items-center gap-2">
        <input
          id="notifyEmail"
          type="checkbox"
          checked={notifyByEmail}
          onChange={(e) =>
            setNotifyByEmail(e.target.checked)
          }
        />

        <label
          htmlFor="notifyEmail"
          className="text-sm text-neutral-700"
        >
          Notify customer by email
        </label>

        <input
          id="notifySms"
          type="checkbox"
          checked={notifyBySms}
          onChange={(e) =>
            setNotifyBySms(e.target.checked)
          }
        />

        <label
          htmlFor="notifySms"
          className="text-sm text-neutral-700"
        >
          Notify customer by SMS/WhatsApp
        </label>
      </div>

      {error && (
        <p className="text-sm text-red-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-60"
      >
        {submitting
          ? "Locating addresses & submitting..."
          : "Create Order"}
      </button>
    </form>
  );
}