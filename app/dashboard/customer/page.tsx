"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import {
  OrderClient,
  ServiceType,
  SERVICE_TYPE_LABELS,
  COUNTRY_OPTIONS,
} from "@/types";
import StatusBadge from "@/components/ui/statusbadge";
import {
  Plus,
  MapPin,
  Globe2,
  MessageCircle,
  PackageCheck,
  Truck,
} from "lucide-react";
import { uploadPaymentProof } from "@/libs/uploadPaymentProof";
import { geocodeAddress } from "@/libs/geocode";
import {
  groupByDate,
  filterOrdersByDate,
  DateFilterValue,
} from "@/libs/dateGroups";
import OrderDateFilter from "@/components/orders/OrderDateFilter";

// Company WhatsApp line.
const WHATSAPP_NUMBER = "2349152661473";

const WHATSAPP_PRICED_TYPES = new Set<ServiceType>([
  "local",
  "interstate",
]);

/**
 * These statuses mean the shipment is completed.
 * Completed shipments are removed from the active queue
 * and shown separately under "Completed Deliveries".
 */
const COMPLETED_STATUSES = new Set([
  "delivered",
  "delivery_confirmed",
  "delivered_by_courier",
]);

function whatsappLink(trackingNumber?: string) {
  const trackingUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/track${
          trackingNumber
            ? `?number=${encodeURIComponent(trackingNumber)}`
            : ""
        }`
      : "";

  const message = trackingNumber
    ? `Hi CityBike Logistics, I just placed an order. Tracking number: #${trackingNumber}. Track it here: ${trackingUrl}. Please let me know how much to pay for this delivery.`
    : `Hi CityBike Logistics, I would like to make an enquiry about your delivery services.`;

  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    message
  )}`;
}

/**
 * Human-friendly service label.
 *
 * International Cargo and DHL Express are deliberately
 * kept as separate service types.
 */
function getServiceLabel(serviceType: ServiceType) {
  switch (serviceType) {
    case "local":
      return "Local Delivery";

    case "interstate":
      return "Interstate Delivery";

    case "international":
      return "International Cargo";

    case "dhl_express":
      return "DHL Express";

    case "ecommerce":
      return "E-commerce Fulfillment";

    case "errand":
      return "Personal / Business Errand";

    case "corporate":
      return "Corporate Logistics";

    default:
      return SERVICE_TYPE_LABELS[serviceType];
  }
}

/**
 * Different visual treatment for each delivery type.
 *
 * International Cargo = orange
 * DHL Express = red
 */
function getServiceBadge(serviceType: ServiceType) {
  switch (serviceType) {
    case "local":
      return "bg-blue-50 text-blue-700 border-blue-200";

    case "interstate":
      return "bg-purple-50 text-purple-700 border-purple-200";

    case "international":
      return "bg-orange-50 text-orange-700 border-orange-200";

    case "dhl_express":
      return "bg-red-50 text-red-700 border-red-200";

    case "ecommerce":
      return "bg-cyan-50 text-cyan-700 border-cyan-200";

    case "errand":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";

    case "corporate":
      return "bg-indigo-50 text-indigo-700 border-indigo-200";

    default:
      return "bg-neutral-50 text-neutral-700 border-neutral-200";
  }
}

function isCompletedOrder(order: OrderClient) {
  return COMPLETED_STATUSES.has(order.status);
}

export default function CustomerDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [orders, setOrders] = useState<OrderClient[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [dateFilter, setDateFilter] =
    useState<DateFilterValue>("today");

  useEffect(() => {
    if (!loading && (!user || user.role !== "customer")) {
      router.push("/login");
    }
  }, [user, loading, router]);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/orders");

      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders);
      }
    } catch (error) {
      console.error("Failed to fetch orders:", error);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (user) fetchOrders();
  }, [user, fetchOrders]);

  /**
   * Active orders.
   *
   * Delivered orders are deliberately excluded from this list.
   * This keeps the customer dashboard queue clean.
   */
  const activeOrders = useMemo(
    () => orders.filter((order) => !isCompletedOrder(order)),
    [orders]
  );

  /**
   * Completed orders.
   *
   * These remain available under order history,
   * but they no longer clutter the active delivery queue.
   */
  const completedOrders = useMemo(
    () => orders.filter((order) => isCompletedOrder(order)),
    [orders]
  );

  if (loading || !user) return null;

  const filteredActiveOrders = filterOrdersByDate(
    activeOrders,
    dateFilter
  );

  const filteredCompletedOrders = filterOrdersByDate(
    completedOrders,
    dateFilter
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-neutral-500">
            Welcome back
          </p>

          <h1 className="text-2xl font-bold text-neutral-900">
            {user.name}
          </h1>

          <p className="mt-1 text-sm text-neutral-500">
            Manage and track your deliveries
          </p>
        </div>

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

      <OrderDateFilter
        value={dateFilter}
        onChange={setDateFilter}
      />

      {/* ACTIVE DELIVERIES */}
      <section className="mt-6">
        <div className="mb-3 flex items-center gap-2">
          <Truck className="h-5 w-5 text-orange-600" />

          <div>
            <h2 className="font-semibold text-neutral-900">
              Active Deliveries
            </h2>

            <p className="text-xs text-neutral-500">
              Shipments currently being processed or delivered
            </p>
          </div>
        </div>

        {orders.length === 0 && (
          <p className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
            No orders yet. Create your first delivery request.
          </p>
        )}

        {orders.length > 0 &&
          filteredActiveOrders.length === 0 && (
            <p className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
              No active deliveries for this day.
            </p>
          )}

        <div className="space-y-6">
          {groupByDate(filteredActiveOrders).map((group) => (
            <div key={group.label}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                {group.label}
              </h3>

              <div className="space-y-3">
                {group.items.map((o) => (
                  <OrderCard
                    key={o._id}
                    order={o}
                    customerName={user.name}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* COMPLETED DELIVERIES */}
      {completedOrders.length > 0 && (
        <section className="mt-10">
          <div className="mb-3 flex items-center gap-2">
            <PackageCheck className="h-5 w-5 text-green-600" />

            <div>
              <h2 className="font-semibold text-neutral-900">
                Completed Deliveries
              </h2>

              <p className="text-xs text-neutral-500">
                Delivered shipments and order history
              </p>
            </div>
          </div>

          {filteredCompletedOrders.length === 0 ? (
            <p className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
              No completed deliveries for this day.
            </p>
          ) : (
            <div className="space-y-6">
              {groupByDate(filteredCompletedOrders).map(
                (group) => (
                  <div key={group.label}>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                      {group.label}
                    </h3>

                    <div className="space-y-3">
                      {group.items.map((o) => (
                        <OrderCard
                          key={o._id}
                          order={o}
                          customerName={user.name}
                          completed
                        />
                      ))}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </section>
      )}

      {/*
        The general floating WhatsApp button has intentionally
        been removed from the customer dashboard.

        WhatsApp is still available inside the order flow when
        a WhatsApp-priced delivery requires it.
      */}
    </div>
  );
}

function OrderCard({
  order: o,
  customerName,
  completed = false,
}: {
  order: OrderClient;
  customerName: string;
  completed?: boolean;
}) {
  return (
    <Link
      href={`/orders/${o._id}`}
      className={`block rounded-lg border bg-white p-4 transition ${
        completed
          ? "border-green-100 hover:border-green-300"
          : "border-neutral-200 hover:border-orange-300"
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          {/* CUSTOMER NAME IS THE MAIN HEADING */}
          <p className="font-semibold text-neutral-900">
            {customerName}
          </p>

          {/* PACKAGE DESCRIPTION FOLLOWS CUSTOMER NAME */}
          <p className="mt-0.5 truncate text-sm text-neutral-500">
            {o.packageDescription}
          </p>

          <p className="mt-1 font-mono text-xs font-semibold tracking-wide text-neutral-400">
            #{o.trackingNumber}
          </p>

          <p className="mt-2 flex items-center gap-1 text-sm text-neutral-500">
            <MapPin className="h-3.5 w-3.5" />

            {o.pickup.city} → {o.dropoff.city}

            {o.isInternational
              ? `, ${o.dropoff.country}`
              : ""}
          </p>

          {o.driver && (
            <p className="mt-1 text-sm text-neutral-500">
              Driver: {o.driver.name}
            </p>
          )}

          {o.eta && !completed && (
            <p className="mt-1 text-sm text-neutral-500">
              ETA: {new Date(o.eta).toLocaleString()}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <StatusBadge status={o.status} />

          {/* SERVICE TYPE */}
          <span
            className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getServiceBadge(
              o.serviceType
            )}`}
          >
            {getServiceLabel(o.serviceType)}
          </span>

          {/* PRICE */}
          {o.price != null &&
            !WHATSAPP_PRICED_TYPES.has(o.serviceType) && (
              <span className="text-xs font-medium text-neutral-500">
                ₦{o.price.toLocaleString()}
              </span>
            )}

          {/* INTERNATIONAL INDICATOR */}
          {o.isInternational && (
            <span
              className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                o.serviceType === "dhl_express"
                  ? "bg-red-100 text-red-700"
                  : "bg-orange-100 text-orange-700"
              }`}
            >
              <Globe2 className="h-3 w-3" />

              {o.serviceType === "dhl_express"
                ? "DHL"
                : "Cargo"}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

interface CreatedOrder {
  _id: string;
  trackingNumber: string;
  paymentMethod: "bank_transfer" | "paystack";
  paymentStatus: "pending" | "paid" | "failed";
  price?: number;
}

function NewOrderForm({
  onCreated,
}: {
  onCreated: () => void;
}) {
  const [pickupAddress, setPickupAddress] = useState("");
  const [pickupCity, setPickupCity] = useState("");
  const [pickupState, setPickupState] = useState("");
  const [pickupPostalCode, setPickupPostalCode] = useState("");

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

  const [recipientName, setRecipientName] = useState("");

  const [recipientPhoneCode, setRecipientPhoneCode] =
    useState("+234");

  const [recipientPhone, setRecipientPhone] = useState("");

  const [paymentMethod, setPaymentMethod] = useState<
    "bank_transfer" | "paystack"
  >("bank_transfer");

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [createdOrder, setCreatedOrder] =
    useState<CreatedOrder | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);

  const isInternational =
    dropoffCountry.trim().toLowerCase() !== "nigeria";

  const isWhatsAppFlow =
    WHATSAPP_PRICED_TYPES.has(serviceType);

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

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pickup: {
            address: pickupAddress,
            city: pickupCity,
            country: "Nigeria",
            state: pickupState || undefined,
            postalCode: pickupPostalCode || undefined,
            lat: pickupLoc.lat,
            lng: pickupLoc.lng,
          },

          dropoff: {
            address: dropoffAddress,
            city: dropoffCity,
            country: dropoffCountry,
            state: dropoffState || undefined,
            postalCode: dropoffPostalCode || undefined,
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

          recipientPhone: `${
            recipientPhoneCode || "+234"
          }${recipientPhone}`,

          recipientPhoneCode:
            recipientPhoneCode || "+234",

          paymentMethod: isWhatsAppFlow
            ? "bank_transfer"
            : paymentMethod,
        }),
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
        setError(data.error || "Could not create order");
        return;
      }

      setCreatedOrder(data.order);

      if (
        !isWhatsAppFlow &&
        paymentMethod !== "bank_transfer"
      ) {
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
      const url = await uploadPaymentProof(
        createdOrder._id,
        file
      );

      const res = await fetch(
        `/api/orders/${createdOrder._id}/payment-proof`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            proofUrl: url,
          }),
        }
      );

      if (res.ok) {
        setUploadDone(true);
        setTimeout(onCreated, 1500);
      } else {
        setError(
          "Could not save proof of payment, please try again."
        );
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
        <p className="text-sm text-green-700">
          Order created! Your tracking number is
        </p>

        <p className="mt-1 font-mono text-xl font-bold tracking-wide text-green-800">
          #{createdOrder.trackingNumber}
        </p>

        {!isWhatsAppFlow &&
          createdOrder.price != null && (
            <p className="mt-1 text-sm text-neutral-700">
              Estimated cost:{" "}
              <span className="font-semibold">
                ₦{createdOrder.price.toLocaleString()}
              </span>
            </p>
          )}

        {isWhatsAppFlow ? (
          <div className="mt-4 rounded-lg border border-green-300 bg-white p-4 text-left">
            <h3 className="text-sm font-semibold text-green-800">
              Complete your order on WhatsApp
            </h3>

            <p className="mt-1 text-sm text-neutral-600">
              Chat with us directly — we&apos;ll let you know
              the delivery fee and confirm payment for your
              order there.
            </p>

            <a
              href={whatsappLink(
                createdOrder.trackingNumber
              )}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setTimeout(onCreated, 500)}
              className="mt-3 inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              <MessageCircle className="h-4 w-4" />
              Continue on WhatsApp
            </a>
          </div>
        ) : (
          createdOrder.paymentMethod ===
            "bank_transfer" &&
          !uploadDone && (
            <div className="mt-4 rounded-lg border border-orange-200 bg-orange-50 p-4 text-left">
              <h3 className="text-sm font-semibold text-orange-800">
                💳 Payment Details – CityBike Logistics
              </h3>

              <p className="mt-1 text-sm text-orange-700">
                Kindly make payment to:
              </p>

              <div className="mt-2 text-sm text-neutral-700">
                <p>
                  <strong>Bank:</strong> Moniepoint MFB
                </p>

                <p>
                  <strong>Account Name:</strong> CityBike
                  Logistics Global Service Ltd
                </p>

                <p>
                  <strong>Account Number:</strong>{" "}
                  5256910759
                </p>
              </div>

              <p className="mt-2 text-xs text-orange-700">
                ✅ Please send payment confirmation after
                transfer to{" "}
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

                  if (file) {
                    handleProofUpload(file);
                  }
                }}
                className="mt-3 block text-sm"
              />

              {uploading && (
                <p className="mt-2 text-xs text-neutral-500">
                  Uploading...
                </p>
              )}

              {error && (
                <p className="mt-2 text-sm text-red-600">
                  {error}
                </p>
              )}
            </div>
          )
        )}

        {uploadDone && (
          <p className="mt-2 text-sm text-green-700">
            Proof uploaded! We&apos;ll confirm your payment
            shortly.
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
          onChange={(e) =>
            setServiceType(e.target.value as ServiceType)
          }
          className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
        >
          {Object.entries(SERVICE_TYPE_LABELS).map(
            ([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            )
          )}
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
            DROP-OFF {isInternational && "(International)"}
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
                setRecipientPhoneCode(e.target.value)
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

      {isWhatsAppFlow ? (
        <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          No price shown here — you&apos;ll be told the
          delivery fee and can arrange payment directly on
          WhatsApp after you submit.
        </div>
      ) : (
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">
            Payment Method
          </label>

          <select
            value={paymentMethod}
            onChange={(e) =>
              setPaymentMethod(
                e.target.value as
                  | "bank_transfer"
                  | "paystack"
              )
            }
            className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
          >
            <option value="bank_transfer">
              Bank Transfer
            </option>

            <option value="paystack" disabled>
              Card Payment (Paystack) — coming soon
            </option>
          </select>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-60"
      >
        {submitting
          ? "Locating addresses & submitting..."
          : "Submit Order"}
      </button>
    </form>
  );
}