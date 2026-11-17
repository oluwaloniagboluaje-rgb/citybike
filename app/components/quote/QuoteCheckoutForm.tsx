"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { EUROPEAN_COUNTRY_OPTIONS, calculatePrice, requiresCustomerServiceQuote } from "@/libs/pricing";
import { geocodeAddress } from "@/libs/geocode";
import { uploadPaymentProof } from "@/libs/uploadPaymentProof";
import { useAuth } from "@/context/AuthContext";
import type { ShippingSpeed } from "@/types";

type QuoteRoute =
  | "nigeria_to_uk"
  | "nigeria_to_ireland"
  | "nigeria_to_europe"
  | "nigeria_to_usa"
  | "nigeria_to_canada";

const QUOTE_ROUTES: QuoteRoute[] = [
  "nigeria_to_uk",
  "nigeria_to_ireland",
  "nigeria_to_europe",
  "nigeria_to_usa",
  "nigeria_to_canada",
];

const EUROPEAN_DESTINATIONS = EUROPEAN_COUNTRY_OPTIONS.filter(
  (country) => country !== "United Kingdom" && country !== "Ireland"
);

interface CreatedOrder {
  _id: string;
  trackingNumber: string;
  price?: number;
}

interface QuoteCheckoutFormProps {
  route: string;
  shippingSpeed: string;
  weightKg: string;
  destinationCountry: string;
}

export default function QuoteCheckoutForm({
  route: initialRoute,
  shippingSpeed: initialShippingSpeed,
  weightKg: initialWeightKg,
  destinationCountry: initialDestinationCountry,
}: QuoteCheckoutFormProps) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const route = QUOTE_ROUTES.includes(initialRoute as QuoteRoute)
    ? (initialRoute as QuoteRoute)
    : null;
  const shippingSpeed: ShippingSpeed =
    initialShippingSpeed === "express" ? "express" : "standard";
  const destinationCountry =
    route === "nigeria_to_uk"
      ? "United Kingdom"
      : route === "nigeria_to_ireland"
        ? "Ireland"
        : route === "nigeria_to_usa"
          ? "United States"
          : route === "nigeria_to_canada"
            ? "Canada"
            : EUROPEAN_DESTINATIONS.includes(
                  initialDestinationCountry as (typeof EUROPEAN_DESTINATIONS)[number]
                )
              ? initialDestinationCountry
              : "";

  const [pickupAddress, setPickupAddress] = useState("");
  const [pickupCity, setPickupCity] = useState("");
  const [pickupState, setPickupState] = useState("");
  const [pickupPostalCode, setPickupPostalCode] = useState("");
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [dropoffCity, setDropoffCity] = useState("");
  const [dropoffState, setDropoffState] = useState("");
  const [dropoffPostalCode, setDropoffPostalCode] = useState("");
  const [weight, setWeight] = useState(initialWeightKg);
  const [packageDescription, setPackageDescription] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [recipientPhoneCode, setRecipientPhoneCode] = useState("+234");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<CreatedOrder | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);

  const parsedWeight = Number(weight);
  const needsPersonalizedQuote =
    !!route &&
    !!destinationCountry &&
    Number.isFinite(parsedWeight) &&
    requiresCustomerServiceQuote({
      pickupCountry: "Nigeria",
      dropoffCountry: destinationCountry,
      shippingSpeed,
      weightKg: parsedWeight,
    });

  const price = useMemo(() => {
    if (
      !route ||
      !destinationCountry ||
      !Number.isFinite(parsedWeight) ||
      parsedWeight <= 0 ||
      needsPersonalizedQuote
    ) {
      return null;
    }

    return calculatePrice({
      distanceKm: 0,
      serviceType: "international",
      packageSize: "small",
      weightKg: parsedWeight,
      pickupCountry: "Nigeria",
      dropoffCountry: destinationCountry,
      packageDescription: packageDescription || "General goods",
      shippingSpeed,
    });
  }, [
    destinationCountry,
    needsPersonalizedQuote,
    packageDescription,
    parsedWeight,
    route,
    shippingSpeed,
  ]);

  useEffect(() => {
    if (!loading && !user) {
      const next = `${window.location.pathname}${window.location.search}`;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [loading, router, user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!route || !destinationCountry || price === null) {
      setError(
        needsPersonalizedQuote
          ? "Please contact customer service for a personalized quote."
          : "This quote is unavailable. Return to the quote calculator and try again."
      );
      return;
    }

    setSubmitting(true);
    try {
      const [pickupLocation, dropoffLocation] = await Promise.all([
        geocodeAddress(pickupAddress, pickupCity, "Nigeria"),
        geocodeAddress(dropoffAddress, dropoffCity, destinationCountry),
      ]);

      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup: {
            address: pickupAddress,
            city: pickupCity,
            country: "Nigeria",
            state: pickupState || undefined,
            postalCode: pickupPostalCode || undefined,
            ...pickupLocation,
          },
          dropoff: {
            address: dropoffAddress,
            city: dropoffCity,
            country: destinationCountry,
            state: dropoffState || undefined,
            postalCode: dropoffPostalCode || undefined,
            ...dropoffLocation,
          },
          serviceType: "international",
          shippingSpeed,
          packageDescription,
          packageSize: "small",
          weightKg: parsedWeight,
          recipientName,
          recipientPhone: `${recipientPhoneCode}${recipientPhone}`,
          recipientPhoneCode,
          paymentMethod: "bank_transfer",
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.order) {
        throw new Error(data.error || "Could not create your shipment.");
      }

      setCreatedOrder(data.order);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not create your shipment. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleProofUpload(file: File) {
    if (!createdOrder) return;
    setError("");
    setUploading(true);

    try {
      const proofUrl = await uploadPaymentProof(createdOrder._id, file);
      const response = await fetch(
        `/api/orders/${createdOrder._id}/payment-proof`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ proofUrl }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not save your payment proof.");
      }
      setUploadDone(true);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Payment proof upload failed. Please try again."
      );
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return <p className="mx-auto max-w-3xl p-8">Checking your account...</p>;
  }

  if (!user) {
    return <p className="mx-auto max-w-3xl p-8">Redirecting to sign in...</p>;
  }

  if (user.role !== "customer") {
    return (
      <div className="mx-auto max-w-3xl p-8 text-center">
        <p className="text-lg font-semibold">A customer account is required to book a shipment.</p>
        <Link href="/dashboard" className="mt-4 inline-block text-orange-700 underline">
          Return to your dashboard
        </Link>
      </div>
    );
  }

  if (!route || !destinationCountry) {
    return (
      <div className="mx-auto max-w-3xl p-8 text-center">
        <p className="text-lg font-semibold">This shipment quote is invalid or unavailable.</p>
        <Link href="/" className="mt-4 inline-block text-orange-700 underline">
          Return to the quote calculator
        </Link>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold text-neutral-900">Book your shipment</h1>
      <p className="mt-2 text-neutral-600">
        Nigeria to {destinationCountry} · {shippingSpeed} · {parsedWeight}kg
      </p>
      <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4">
        <p className="text-sm text-green-800">Estimated shipping price</p>
        <p className="mt-1 text-2xl font-bold text-neutral-900">
          {needsPersonalizedQuote
            ? "Contact customer service"
            : price === null
              ? "Enter a valid weight"
              : `₦${price.toLocaleString("en-NG")}`}
        </p>
        {route === "nigeria_to_canada" && (
          <p className="mt-2 text-sm text-green-900">
            You may be asked to pay an additional box fee.
          </p>
        )}
      </div>

      {createdOrder ? (
        <section className="mt-6 space-y-4 rounded-xl border border-neutral-200 bg-white p-5">
          <p className="font-semibold text-green-800">
            Shipment registered. Tracking number: {createdOrder.trackingNumber}
          </p>
          <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
            <h2 className="font-semibold text-orange-900">
              💳 INTERNATIONAL SHIPPING PAYMENT DETAILS
            </h2>
            <p className="mt-2 text-sm">Bank: Providus Bank</p>
            <p className="text-sm">Account Name: CITYBIKE LOG. &amp; GLOBAL SER. LTD</p>
            <p className="text-sm">Account Number: 1309629802</p>
            <p className="mt-3 text-sm text-neutral-700">
              Transfer the estimated shipping amount and upload your payment receipt below.
            </p>
          </div>
          {uploadDone ? (
            <p className="text-sm font-medium text-green-700">
              Payment proof uploaded. We&apos;ll confirm your payment shortly.
            </p>
          ) : (
            <label className="block text-sm font-medium text-neutral-700">
              Upload payment proof
              <input
                type="file"
                accept="image/*,.pdf"
                disabled={uploading}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleProofUpload(file);
                }}
                className="mt-2 block w-full text-sm"
              />
              {uploading && <span className="mt-2 block">Uploading...</span>}
            </label>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </section>
      ) : needsPersonalizedQuote ? (
        <a
          href={`https://wa.me/2349152661473?text=${encodeURIComponent(
            `Hello, I need a personalized express shipping quote for a ${parsedWeight}kg shipment from Nigeria to ${destinationCountry}.`
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex rounded-lg bg-green-600 px-5 py-3 font-semibold text-white"
        >
          Contact customer service
        </a>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-5 rounded-xl border border-neutral-200 bg-white p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <fieldset className="space-y-3 rounded-lg border border-neutral-200 p-4">
              <legend className="px-1 font-semibold">Pickup in Nigeria</legend>
              <input required value={pickupAddress} onChange={(e) => setPickupAddress(e.target.value)} placeholder="Street address" className="w-full rounded-md border p-2" />
              <input required value={pickupCity} onChange={(e) => setPickupCity(e.target.value)} placeholder="City" className="w-full rounded-md border p-2" />
              <input value={pickupState} onChange={(e) => setPickupState(e.target.value)} placeholder="State" className="w-full rounded-md border p-2" />
              <input value={pickupPostalCode} onChange={(e) => setPickupPostalCode(e.target.value)} placeholder="Postcode (optional)" className="w-full rounded-md border p-2" />
            </fieldset>
            <fieldset className="space-y-3 rounded-lg border border-neutral-200 p-4">
              <legend className="px-1 font-semibold">Delivery in {destinationCountry}</legend>
              <input required value={dropoffAddress} onChange={(e) => setDropoffAddress(e.target.value)} placeholder="Street address" className="w-full rounded-md border p-2" />
              <input required value={dropoffCity} onChange={(e) => setDropoffCity(e.target.value)} placeholder="City" className="w-full rounded-md border p-2" />
              <input value={dropoffState} onChange={(e) => setDropoffState(e.target.value)} placeholder="State / region" className="w-full rounded-md border p-2" />
              <input value={dropoffPostalCode} onChange={(e) => setDropoffPostalCode(e.target.value)} placeholder="Postcode / ZIP (optional)" className="w-full rounded-md border p-2" />
            </fieldset>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">
              Package description
              <input required value={packageDescription} onChange={(e) => setPackageDescription(e.target.value)} placeholder="What are you sending?" className="mt-1 w-full rounded-md border p-2" />
            </label>
            <label className="text-sm font-medium">
              Weight (kg)
              <input required type="number" min="0.1" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} className="mt-1 w-full rounded-md border p-2" />
            </label>
            <label className="text-sm font-medium">
              Recipient name
              <input required value={recipientName} onChange={(e) => setRecipientName(e.target.value)} className="mt-1 w-full rounded-md border p-2" />
            </label>
            <label className="text-sm font-medium">
              Recipient phone
              <span className="mt-1 flex gap-2">
                <input required value={recipientPhoneCode} onChange={(e) => setRecipientPhoneCode(e.target.value)} className="w-24 rounded-md border p-2" />
                <input required value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} className="min-w-0 flex-1 rounded-md border p-2" />
              </span>
            </label>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting || price === null}
            className="rounded-lg bg-orange-600 px-5 py-3 font-semibold text-white disabled:opacity-60"
          >
            {submitting ? "Locating addresses and registering..." : "Register shipment"}
          </button>
        </form>
      )}
    </main>
  );
}
