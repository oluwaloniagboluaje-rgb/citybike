"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import {
  OrderClient,
  OrderStatus,
  SERVICE_TYPE_LABELS,
} from "@/types";
import StatusBadge from "@/components/ui/statusbadge";
import LiveMap from "@/components/map/livemapClient";
import ChatBox from "@/components/chat/chatBox";
import {
  supabase,
  orderLocationChannel,
} from "@/libs/supabaseClient";
import {
  ArrowLeft,
  Package,
  User as UserIcon,
  Truck,
  Globe2,
  Copy,
  Plane,
  Ship,
  FileCheck,
  Warehouse,
  MapPin,
  CircleCheck,
} from "lucide-react";

/**
 * ---------------------------------------------------------
 * SERVICE TYPE HELPERS
 * ---------------------------------------------------------
 */

function isInternationalCargo(order: OrderClient) {
  return order.serviceType === "international";
}

function isDhlExpress(order: OrderClient) {
  return order.serviceType === "dhl_express";
}

function isInternationalService(order: OrderClient) {
  return (
    order.serviceType === "international" ||
    order.serviceType === "dhl_express" ||
    order.isInternational
  );
}

/**
 * ---------------------------------------------------------
 * TIMELINE DESCRIPTIONS
 * ---------------------------------------------------------
 *
 * IMPORTANT:
 *
 * International Cargo and DHL Express use the same underlying
 * OrderStatus values, but they DO NOT use the same customer-facing
 * tracking language.
 *
 * International Cargo:
 *   Cargo received
 *   Documentation / customs
 *   Export processing
 *   International transit
 *   Import customs
 *   Destination delivery
 *
 * DHL Express:
 *   Shipment picked up
 *   Origin facility
 *   Departed facility
 *   DHL transit
 *   Destination facility
 *   Customs clearance
 *   Out for delivery
 *
 * Domestic:
 *   Existing normal delivery terminology.
 */

function getTimelineDescription(
  status: OrderStatus,
  order: OrderClient
): string {
  /**
   * -------------------------------------------------------
   * INTERNATIONAL CARGO
   * -------------------------------------------------------
   */
  if (isInternationalCargo(order)) {
    switch (status) {
      case "pending":
        return "Cargo shipment created";

      case "confirmed":
        return "International cargo shipment confirmed by CityBike Logistics";

      case "assigned":
        return "Cargo handling team assigned to this shipment";

      case "picked_up":
        return `Cargo received from ${order.pickup.city}`;

      case "awaiting_dispatch":
        return "Awaiting export documentation and shipment processing";

      case "dispatched":
        return "Cargo dispatched for international export processing";

      case "in_transit":
        return `Cargo in international transit to ${order.dropoff.city}, ${order.dropoff.country}`;

      case "destination_hub":
        return `Cargo arrived at the destination hub in ${order.dropoff.city}`;

      case "out_for_delivery":
        return `Cargo cleared for final delivery in ${order.dropoff.city}`;

      case "delivered":
        return `Cargo delivered to ${order.dropoff.city}, ${order.dropoff.country}`;

      case "cancelled":
        return "International cargo shipment cancelled";

      default:
        return "International cargo status updated";
    }
  }

  /**
   * -------------------------------------------------------
   * DHL EXPRESS
   * -------------------------------------------------------
   */
  if (isDhlExpress(order)) {
    switch (status) {
      case "pending":
        return "DHL Express shipment created";

      case "confirmed":
        return "DHL Express shipment confirmed";

      case "assigned":
        return "Shipment assigned for pickup";

      case "picked_up":
        return `Shipment picked up from ${order.pickup.city}`;

      case "awaiting_dispatch":
        return "Shipment processed at the origin facility";

      case "dispatched":
        return "Shipment departed the origin facility";

      case "in_transit":
        return `Shipment in DHL Express transit to ${order.dropoff.city}`;

      case "destination_hub":
        return `Shipment arrived at the destination facility in ${order.dropoff.city}`;

      case "out_for_delivery":
        return `DHL Express shipment is out for delivery in ${order.dropoff.city}`;

      case "delivered":
        return `DHL Express shipment delivered to ${order.dropoff.city}`;

      case "cancelled":
        return "DHL Express shipment cancelled";

      default:
        return "DHL Express shipment status updated";
    }
  }

  /**
   * -------------------------------------------------------
   * DOMESTIC DELIVERY
   * -------------------------------------------------------
   */
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
      return "Awaiting dispatch for the next delivery stage";

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

/**
 * ---------------------------------------------------------
 * TIMELINE STAGE LABEL
 * ---------------------------------------------------------
 *
 * This gives the customer a clearer stage name above the
 * description.
 */

function getTimelineStage(
  status: OrderStatus,
  order: OrderClient
): string {
  /**
   * INTERNATIONAL CARGO
   */
  if (isInternationalCargo(order)) {
    switch (status) {
      case "pending":
        return "Shipment Created";

      case "confirmed":
        return "Cargo Confirmed";

      case "assigned":
        return "Cargo Handling Assigned";

      case "picked_up":
        return "Cargo Received";

      case "awaiting_dispatch":
        return "Documentation & Export Preparation";

      case "dispatched":
        return "Export Processing";

      case "in_transit":
        return "International Transit";

      case "destination_hub":
        return "Destination Hub / Import Processing";

      case "out_for_delivery":
        return "Final Delivery";

      case "delivered":
        return "Delivered";

      case "cancelled":
        return "Cancelled";

      default:
        return "Shipment Update";
    }
  }

  /**
   * DHL EXPRESS
   */
  if (isDhlExpress(order)) {
    switch (status) {
      case "pending":
        return "Shipment Created";

      case "confirmed":
        return "Shipment Confirmed";

      case "assigned":
        return "Pickup Assigned";

      case "picked_up":
        return "Shipment Picked Up";

      case "awaiting_dispatch":
        return "Origin Facility Processing";

      case "dispatched":
        return "Departed Facility";

      case "in_transit":
        return "DHL Express Transit";

      case "destination_hub":
        return "Destination Facility";

      case "out_for_delivery":
        return "Out for Delivery";

      case "delivered":
        return "Delivered";

      case "cancelled":
        return "Cancelled";

      default:
        return "Shipment Update";
    }
  }

  /**
   * DOMESTIC
   */
  switch (status) {
    case "pending":
      return "Order Created";

    case "confirmed":
      return "Order Confirmed";

    case "assigned":
      return "Driver Assigned";

    case "picked_up":
      return "Picked Up";

    case "awaiting_dispatch":
      return "Awaiting Dispatch";

    case "dispatched":
      return "Dispatched";

    case "in_transit":
      return "In Transit";

    case "destination_hub":
      return "Destination Hub";

    case "out_for_delivery":
      return "Out for Delivery";

    case "delivered":
      return "Delivered";

    case "cancelled":
      return "Cancelled";

    default:
      return "Status Update";
  }
}

/**
 * ---------------------------------------------------------
 * SERVICE VISUAL CONFIGURATION
 * ---------------------------------------------------------
 */

function getServicePresentation(order: OrderClient) {
  if (isInternationalCargo(order)) {
    return {
      title: "International Cargo",
      description:
        "International cargo shipment tracking",
      icon: Ship,
      badgeClass:
        "border-orange-200 bg-orange-50 text-orange-700",
      timelineClass:
        "border-orange-200",
      activeDotClass:
        "bg-orange-500",
      iconClass:
        "text-orange-600",
    };
  }

  if (isDhlExpress(order)) {
    return {
      title: "DHL Express",
      description:
        "DHL Express international shipment tracking",
      icon: Plane,
      badgeClass:
        "border-red-200 bg-red-50 text-red-700",
      timelineClass:
        "border-red-200",
      activeDotClass:
        "bg-red-500",
      iconClass:
        "text-red-600",
    };
  }

  return {
    title: SERVICE_TYPE_LABELS[order.serviceType],
    description: "Delivery tracking",
    icon: Truck,
    badgeClass:
      "border-neutral-200 bg-neutral-50 text-neutral-700",
    timelineClass:
      "border-neutral-200",
    activeDotClass:
      "bg-orange-500",
    iconClass:
      "text-orange-600",
  };
}

/**
 * ---------------------------------------------------------
 * ORDER DETAIL PAGE
 * ---------------------------------------------------------
 */

export default function OrderDetailPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();

  const orderId = params?.orderId as string;

  const [order, setOrder] =
    useState<OrderClient | null>(null);

  const [error, setError] = useState("");

  const [copied, setCopied] =
    useState(false);

  const [driverPosition, setDriverPosition] =
    useState<{
      lat: number;
      lng: number;
    } | null>(null);

  /**
   * -------------------------------------------------------
   * FETCH ORDER
   * -------------------------------------------------------
   */

  const fetchOrder = useCallback(async () => {
    if (!orderId) return;

    try {
      const res = await fetch(
        `/api/orders/${orderId}`
      );

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
        const data = await res
          .json()
          .catch(() => ({}));

        setError(
          data.error ||
            "Could not load order"
        );
      }
    } catch {
      setError(
        "Could not connect to the server."
      );
    }
  }, [orderId]);

  /**
   * -------------------------------------------------------
   * CANCEL ORDER
   * -------------------------------------------------------
   */

  async function cancelOrder() {
    if (!order) return;

    const confirmCancel =
      window.confirm(
        "Are you sure you want to cancel this order? This action cannot be undone."
      );

    if (!confirmCancel) return;

    const res = await fetch(
      `/api/orders/${orderId}/status`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          status: "cancelled",
        }),
      }
    );

    if (res.ok) {
      await fetchOrder();
      setError("");
    } else {
      const data = await res
        .json()
        .catch(() => ({}));

      setError(
        data.error ||
          "Could not cancel order"
      );
    }
  }

  /**
   * -------------------------------------------------------
   * AUTH + INITIAL LOAD
   * -------------------------------------------------------
   */

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
      return;
    }

    if (user) {
      fetchOrder();
    }
  }, [
    user,
    loading,
    router,
    fetchOrder,
  ]);

  /**
   * -------------------------------------------------------
   * LIVE DRIVER LOCATION
   * -------------------------------------------------------
   */

  useEffect(() => {
    if (!orderId) return;

    const channel =
      supabase.channel(
        orderLocationChannel(orderId)
      );

    channel
      .on(
        "broadcast",
        { event: "location" },
        (payload) => {
          setDriverPosition(
            payload.payload as {
              lat: number;
              lng: number;
            }
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  /**
   * -------------------------------------------------------
   * POLLING FALLBACK
   * -------------------------------------------------------
   */

  useEffect(() => {
    if (!orderId) return;

    const interval = setInterval(
      fetchOrder,
      10000
    );

    return () =>
      clearInterval(interval);
  }, [fetchOrder, orderId]);

  /**
   * -------------------------------------------------------
   * COPY TRACKING NUMBER
   * -------------------------------------------------------
   */

  function copyTrackingNumber() {
    if (!order) return;

    navigator.clipboard
      .writeText(order.trackingNumber)
      .then(() => {
        setCopied(true);

        setTimeout(
          () => setCopied(false),
          2000
        );
      });
  }

  /**
   * -------------------------------------------------------
   * LOADING / AUTH
   * -------------------------------------------------------
   */

  if (loading || !user) {
    return null;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-neutral-600">
          {error}
        </p>

        <Link
          href="/"
          className="mt-4 inline-block text-orange-600 underline"
        >
          Go home
        </Link>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 text-neutral-500">
        Loading order...
      </div>
    );
  }

  /**
   * -------------------------------------------------------
   * DASHBOARD LINK
   * -------------------------------------------------------
   */

  const dashboardHref =
    user.role === "admin"
      ? "/dashboard/admin"
      : user.role === "driver"
        ? "/dashboard/driver"
        : "/dashboard/customer";

  /**
   * -------------------------------------------------------
   * SERVICE PRESENTATION
   * -------------------------------------------------------
   */

  const service =
    getServicePresentation(order);

  const ServiceIcon = service.icon;

  const internationalCargo =
    isInternationalCargo(order);

  const dhlExpress =
    isDhlExpress(order);

  /**
   * -------------------------------------------------------
   * SORT HISTORY
   * -------------------------------------------------------
   *
   * Oldest → newest.
   */

  const sortedStatusHistory =
    useMemo(() => {
      return [...(order.statusHistory || [])]
        .sort(
          (a, b) =>
            new Date(a.at).getTime() -
            new Date(b.at).getTime()
        );
    }, [order.statusHistory]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* ---------------------------------------------------
          BACK TO DASHBOARD
      --------------------------------------------------- */}

      <Link
        href={dashboardHref}
        className="mb-4 inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to dashboard
      </Link>

      {/* ---------------------------------------------------
          HEADER
      --------------------------------------------------- */}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-neutral-900">
            <Package className="h-6 w-6 text-orange-600" />

            {order.packageDescription}
          </h1>

          <button
            onClick={copyTrackingNumber}
            title="Copy tracking number"
            className="mt-1 flex items-center gap-1.5 font-mono text-sm font-semibold tracking-wide text-neutral-700 hover:text-orange-600"
          >
            #{order.trackingNumber}

            <Copy className="h-3.5 w-3.5" />

            {copied && (
              <span className="font-sans text-xs text-green-600">
                Copied!
              </span>
            )}
          </button>

          <p className="mt-1 text-sm text-neutral-500">
            {order.pickup.address},{" "}
            {order.pickup.city}

            {" → "}

            {order.dropoff.address},{" "}
            {order.dropoff.city}

            {isInternationalService(
              order
            )
              ? `, ${order.dropoff.country}`
              : ""}
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <StatusBadge
            status={order.status}
          />

          {/* SERVICE TYPE BADGE */}

          <span
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${service.badgeClass}`}
          >
            <ServiceIcon className="h-3.5 w-3.5" />

            {service.title}
          </span>
        </div>
      </div>

      {/* ---------------------------------------------------
          SERVICE TRACKING INFORMATION
      --------------------------------------------------- */}

      {(internationalCargo ||
        dhlExpress) && (
        <div
          className={`mt-5 rounded-lg border p-4 ${service.badgeClass}`}
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5">
              <ServiceIcon
                className={`h-5 w-5 ${service.iconClass}`}
              />
            </div>

            <div>
              <p className="text-sm font-semibold">
                {service.title}
              </p>

              <p className="mt-0.5 text-xs opacity-80">
                {service.description}
              </p>

              {internationalCargo && (
                <p className="mt-2 text-xs leading-5">
                  Your cargo is tracked through
                  pickup, export processing,
                  international transit,
                  destination processing and
                  final delivery.
                </p>
              )}

              {dhlExpress && (
                <p className="mt-2 text-xs leading-5">
                  Your DHL Express shipment is
                  tracked through pickup,
                  facility processing, transit,
                  destination processing and
                  final delivery.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------
          ORDER INFORMATION
      --------------------------------------------------- */}

      <div className="mt-4 flex flex-wrap gap-4 text-sm text-neutral-600">
        <span
          className={`rounded-md px-2 py-1 text-xs font-medium ${service.badgeClass}`}
        >
          {SERVICE_TYPE_LABELS[
            order.serviceType
          ]}
        </span>

        <span className="flex items-center gap-1.5">
          <UserIcon className="h-4 w-4" />

          Sender:{" "}

          {order.customer
            ? order.customer.name
            : order.senderName
              ? `${order.senderName}${
                  order.isAdminCreated
                    ? " (walk-in)"
                    : ""
                }`
              : "Unknown"}
        </span>

        {order.driver && (
          <span className="flex items-center gap-1.5">
            <Truck className="h-4 w-4" />

            Driver:{" "}
            {order.driver.name} (
            {order.driver.phone})
          </span>
        )}
      </div>

      {/* ---------------------------------------------------
          DHL EXTERNAL TRACKING NUMBER
      ---------------------------------------------------
      
      This is deliberately only shown for admin.
      It is separate from CityBike's own tracking number.
      --------------------------------------------------- */}

      {user.role === "admin" &&
        dhlExpress &&
        order.externalTrackingNumber && (
          <div className="mt-3 inline-block rounded-md border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
            <span className="font-medium">
              DHL tracking number
              (internal):
            </span>{" "}

            <span className="font-mono">
              {order.externalTrackingNumber}
            </span>

            {order.carrierName && (
              <span className="ml-2">
                Carrier:{" "}
                {order.carrierName}
              </span>
            )}
          </div>
        )}

      {/* ---------------------------------------------------
          TIME INFORMATION
      --------------------------------------------------- */}

      <div className="mt-4 flex flex-wrap gap-4 text-sm text-neutral-600">
        <span>
          Pickup time:{" "}
          {new Date(
            order.pickupTime
          ).toLocaleString()}
        </span>

        {order.eta && (
          <span>
            Estimated arrival:{" "}
            {new Date(
              order.eta
            ).toLocaleString()}
          </span>
        )}
      </div>

      {/* ---------------------------------------------------
          CANCEL ORDER
      --------------------------------------------------- */}

      {order.status !== "delivered" &&
        order.status !== "cancelled" && (
          <div className="mt-4">
            <button
              onClick={cancelOrder}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Cancel Order
            </button>

            {error && (
              <p className="mt-2 text-sm text-red-600">
                {error}
              </p>
            )}
          </div>
        )}

      {/* ---------------------------------------------------
          MAP + CHAT
      --------------------------------------------------- */}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <LiveMap
          pickup={order.pickup}
          dropoff={order.dropoff}
          driverPosition={driverPosition}
          locationHistory={
            order.locationHistory
          }
          isInternational={
            order.isInternational
          }
        />

        <ChatBox
          orderId={order._id}
        />
      </div>

      {/* ---------------------------------------------------
          PACKAGE PHOTOS
      --------------------------------------------------- */}

      {(order.pickupPhotoUrl ||
        order.deliveryPhotoUrl) && (
        <div className="mt-6 rounded-lg border border-neutral-200 bg-white p-4">
          <h2 className="mb-4 text-sm font-semibold text-neutral-700">
            Package Photos
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            {order.pickupPhotoUrl && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-neutral-500">
                  At pickup
                </p>

                <a
                  href={
                    order.pickupPhotoUrl
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <img
                    src={
                      order.pickupPhotoUrl
                    }
                    alt="Package at pickup"
                    className="w-full rounded-md border border-neutral-200 object-cover"
                  />
                </a>
              </div>
            )}

            {order.deliveryPhotoUrl && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-neutral-500">
                  At delivery
                </p>

                <a
                  href={
                    order.deliveryPhotoUrl
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <img
                    src={
                      order.deliveryPhotoUrl
                    }
                    alt="Package at delivery"
                    className="w-full rounded-md border border-neutral-200 object-cover"
                  />
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------
          TRACKING TIMELINE
      --------------------------------------------------- */}

      <div
        className={`mt-6 rounded-lg border bg-white p-4 ${
          internationalCargo
            ? "border-orange-200"
            : dhlExpress
              ? "border-red-200"
              : "border-neutral-200"
        }`}
      >
        {/* TIMELINE HEADER */}

        <div className="mb-5 flex items-start gap-3">
          <div
            className={`rounded-lg p-2 ${
              internationalCargo
                ? "bg-orange-50"
                : dhlExpress
                  ? "bg-red-50"
                  : "bg-neutral-100"
            }`}
          >
            {internationalCargo ? (
              <Ship className="h-5 w-5 text-orange-600" />
            ) : dhlExpress ? (
              <Plane className="h-5 w-5 text-red-600" />
            ) : (
              <Truck className="h-5 w-5 text-orange-600" />
            )}
          </div>

          <div>
            <h2 className="text-sm font-semibold text-neutral-800">
              Tracking Timeline
            </h2>

            <p className="mt-0.5 text-xs text-neutral-500">
              {internationalCargo
                ? "International Cargo shipment progress"
                : dhlExpress
                  ? "DHL Express shipment progress"
                  : "Delivery progress"}
            </p>
          </div>
        </div>

        {sortedStatusHistory.length ===
        0 ? (
          <div className="rounded-md border border-dashed border-neutral-200 p-6 text-center text-sm text-neutral-500">
            No tracking updates yet.
          </div>
        ) : (
          <ol
            className={`relative space-y-7 border-l-2 pl-6 ${
              internationalCargo
                ? "border-orange-100"
                : dhlExpress
                  ? "border-red-100"
                  : "border-neutral-200"
            }`}
          >
            {sortedStatusHistory.map(
              (h, i) => {
                const isLast =
                  i ===
                  sortedStatusHistory.length -
                    1;

                const stage =
                  getTimelineStage(
                    h.status,
                    order
                  );

                const description =
                  getTimelineDescription(
                    h.status,
                    order
                  );

                return (
                  <li
                    key={`${h.status}-${h.at}-${i}`}
                    className="relative"
                  >
                    {/* TIMELINE DOT */}

                    <span
                      className={`absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white ${
                        isLast
                          ? service.activeDotClass
                          : "bg-neutral-300"
                      }`}
                    >
                      {isLast && (
                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                      )}
                    </span>

                    {/* DATE */}

                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-sm font-semibold ${
                          isLast
                            ? internationalCargo
                              ? "text-orange-700"
                              : dhlExpress
                                ? "text-red-700"
                                : "text-neutral-800"
                            : "text-neutral-700"
                        }`}
                      >
                        {stage}
                      </span>

                      <span className="text-xs text-neutral-400">
                        {new Date(
                          h.at
                        ).toLocaleString()}
                      </span>
                    </div>

                    {/* STATUS BADGE */}

                    <div className="mt-1.5">
                      <StatusBadge
                        status={h.status}
                      />
                    </div>

                    {/* DESCRIPTION */}

                    <p className="mt-2 text-sm leading-5 text-neutral-600">
                      {description}
                    </p>

                    {/* EXTRA INTERNATIONAL INFORMATION */}

                    {isLast &&
                      internationalCargo && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700">
                            <Globe2 className="h-3 w-3" />
                            International Cargo
                          </span>

                          <span className="inline-flex items-center gap-1 rounded-full bg-neutral-50 px-2.5 py-1 text-xs font-medium text-neutral-600">
                            <Ship className="h-3 w-3" />
                            Cargo Shipment
                          </span>
                        </div>
                      )}

                    {/* EXTRA DHL INFORMATION */}

                    {isLast &&
                      dhlExpress && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
                            <Globe2 className="h-3 w-3" />
                            International
                          </span>

                          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
                            <Plane className="h-3 w-3" />
                            DHL Express
                          </span>
                        </div>
                      )}
                  </li>
                );
              }
            )}
          </ol>
        )}

        {/* -------------------------------------------------
            SERVICE-SPECIFIC TRACKING LEGEND
        ------------------------------------------------- */}

        {internationalCargo && (
          <div className="mt-6 rounded-md border border-orange-100 bg-orange-50/50 p-3">
            <div className="flex items-start gap-2">
              <FileCheck className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" />

              <div>
                <p className="text-xs font-semibold text-orange-800">
                  International Cargo
                </p>

                <p className="mt-1 text-xs leading-5 text-orange-700">
                  Cargo tracking includes
                  shipment receipt, export
                  documentation, international
                  transit, destination processing
                  and final delivery.
                </p>
              </div>
            </div>
          </div>
        )}

        {dhlExpress && (
          <div className="mt-6 rounded-md border border-red-100 bg-red-50/50 p-3">
            <div className="flex items-start gap-2">
              <Plane className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />

              <div>
                <p className="text-xs font-semibold text-red-800">
                  DHL Express
                </p>

                <p className="mt-1 text-xs leading-5 text-red-700">
                  DHL Express tracking includes
                  pickup, origin facility
                  processing, transit, destination
                  facility processing and final
                  delivery.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}