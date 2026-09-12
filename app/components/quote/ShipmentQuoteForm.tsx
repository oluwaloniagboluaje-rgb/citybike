"use client";

import { FormEvent, useMemo, useState } from "react";
import { Mail, PackageSearch, Send } from "lucide-react";

type RouteKey =
  | "uk_to_nigeria"
  | "nigeria_to_uk"
  | "nigeria_to_europe"
  | "nigeria_to_usa"
  | "nigeria_to_canada"
  | "nigeria_to_china"
  | "nigeria_to_dubai";

const ROUTE_OPTIONS: Array<{
  id: RouteKey;
  label: string;
  badge: string;
}> = [
  { id: "uk_to_nigeria", label: "UK → Nigeria", badge: "Air cargo" },
  { id: "nigeria_to_uk", label: "Nigeria → UK", badge: "Express" },
  { id: "nigeria_to_europe", label: "Nigeria → Europe", badge: "Cargo" },
  { id: "nigeria_to_usa", label: "Nigeria → USA", badge: "Cargo" },
  { id: "nigeria_to_canada", label: "Nigeria → Canada", badge: "Cargo" },
  { id: "nigeria_to_china", label: "Nigeria → China", badge: "Cargo" },
  { id: "nigeria_to_dubai", label: "Nigeria → Dubai", badge: "Pickup" },
];

const CARGO_OPTIONS = ["Air cargo", "Sea cargo"];
const SHIPPING_SPEEDS = ["Standard", "Express"];

const ROUTE_DETAIL: Record<
  RouteKey,
  {
    summary: string;
    note: string;
  }
> = {
  uk_to_nigeria: {
    summary: "Air cargo fares from £6.80/kg, plus a £10 handling fee.",
    note: "Phones are £25 each, laptops are £40 each, and sea cargo pricing varies by package type.",
  },
  nigeria_to_uk: {
    summary:
      "Express shipping starts at ₦89,000 for 0.5–2kg and increases with weight; above 10kg, rates are ₦33,000/kg.",
    note:
      "Sample pricing includes 2.5kg at ₦127,000, 3kg at ₦146,000, 4kg at ₦160,000, 5kg at ₦175,000, and 10kg at ₦291,000.",
  },
  nigeria_to_europe: {
    summary: "Cargo shipping starts at ₦16,500/kg with a minimum of 15kg.",
    note:
      "Available across Belgium, Poland, Luxembourg, Slovakia, Netherlands, Slovenia, Austria, Hungary, Germany, Italy, France, Portugal, Denmark, Spain, Czech Republic, Sweden, Ireland, Estonia, Finland, Lithuania, Croatia, and Latvia.",
  },
  nigeria_to_usa: {
    summary: "₦18,500 per kg, with a 15kg minimum and doorstep delivery included.",
    note: "Typical lead time is 10–15 working days from dispatch.",
  },
  nigeria_to_canada: {
    summary: "₦16,500 per kg, with a 15kg minimum and doorstep delivery included.",
    note: "Typical lead time is 10–15 working days from dispatch.",
  },
  nigeria_to_china: {
    summary: "₦29,500 per kg, with a 20kg minimum.",
    note: "Protein and general goods are accepted.",
  },
  nigeria_to_dubai: {
    summary: "₦14,500 per kg for pick-up service only.",
    note: "Doorstep delivery is not included on this route.",
  },
};

export default function ShipmentQuoteForm({ compact = false }: { compact?: boolean }) {
  const [route, setRoute] = useState<RouteKey>("uk_to_nigeria");
  const [cargoType, setCargoType] = useState("Air cargo");
  const [shippingSpeed, setShippingSpeed] = useState("Standard");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [approxWeight, setApproxWeight] = useState("1");
  const [phoneCount, setPhoneCount] = useState("0");
  const [laptopCount, setLaptopCount] = useState("0");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const routeSummary = useMemo(() => ROUTE_DETAIL[route], [route]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/quotes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          phone,
          route,
          cargoType,
          shippingSpeed,
          approxWeight,
          phoneCount: Number(phoneCount || 0),
          laptopCount: Number(laptopCount || 0),
          notes,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to send quote request.");
      }

      setMessage({
        type: "success",
        text: data.message || "Your quote request has been sent successfully.",
      });

      setName("");
      setEmail("");
      setPhone("");
      setApproxWeight("1");
      setPhoneCount("0");
      setLaptopCount("0");
      setNotes("");
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Something went wrong while submitting your quote request.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section
      className={`rounded-3xl border border-neutral-200 bg-[#f3f0ed] shadow-sm ${
        compact ? "mt-0 p-4 sm:p-5" : "mt-16 p-5 sm:p-8"
      }`}
    >
      <div className={`${compact ? "mb-5" : "mb-8"} text-center`}>
        <p
          className={`font-semibold uppercase tracking-[0.22em] text-orange-600 ${
            compact ? "text-xs" : "text-sm"
          }`}
        >
          Shipping Quotes
        </p>
        <h2
          className={`mt-2 font-bold text-neutral-900 ${
            compact ? "text-2xl" : "text-3xl"
          }`}
        >
          Get a Quote
        </h2>
      </div>

      <div className={`grid gap-4 ${compact ? "lg:grid-cols-1" : "lg:grid-cols-[1.2fr_0.8fr]"}`}>
        <form onSubmit={handleSubmit} className={`space-y-4 ${compact ? "space-y-4" : "space-y-6"}`}>
          <div>
            <p className="mb-3 text-2xl font-semibold text-neutral-900">Route</p>
            <div className={`grid gap-3 ${compact ? "sm:grid-cols-1" : "sm:grid-cols-2"}`}>
              {ROUTE_OPTIONS.map((option) => {
                const active = option.id === route;

                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setRoute(option.id)}
                    className={`rounded-2xl border text-left transition ${
                      compact ? "p-3" : "p-4"
                    } ${
                      active
                        ? "border-[#b0423a] bg-[#f6d6d1] text-neutral-900 shadow-sm"
                        : "border-neutral-300 bg-neutral-100 text-neutral-700 hover:border-neutral-400"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`font-semibold ${compact ? "text-base" : "text-xl"}`}>
                        {option.label}
                      </span>
                      <span
                        className={`rounded-full bg-white/70 font-medium uppercase tracking-[0.18em] text-neutral-700 ${
                          compact
                            ? "px-1.5 py-0.5 text-[8px]"
                            : "px-2 py-0.5 text-[10px]"
                        }`}
                      >
                        {option.badge}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-3 text-2xl font-semibold text-neutral-900">Cargo type</p>
            <div className={`grid gap-3 ${compact ? "sm:grid-cols-1" : "sm:grid-cols-2"}`}>
              {CARGO_OPTIONS.map((option) => {
                const active = option === cargoType;

                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setCargoType(option)}
                    className={`flex items-center justify-center rounded-2xl border font-semibold transition ${
                      compact ? "p-3 text-lg" : "p-4 text-xl"
                    } ${
                      active
                        ? "border-[#b0423a] bg-[#f6d6d1] text-neutral-900"
                        : "border-neutral-300 bg-neutral-100 text-neutral-700 hover:border-neutral-400"
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-3 text-2xl font-semibold text-neutral-900">Shipping speed</p>
            <div className={`grid gap-3 ${compact ? "sm:grid-cols-1" : "sm:grid-cols-2"}`}>
              {SHIPPING_SPEEDS.map((option) => {
                const active = option === shippingSpeed;

                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setShippingSpeed(option)}
                    className={`rounded-2xl border text-left transition ${
                      compact ? "p-3" : "p-5"
                    } ${
                      active
                        ? "border-[#b0423a] bg-[#f6d6d1] text-neutral-900"
                        : "border-neutral-300 bg-neutral-100 text-neutral-700 hover:border-neutral-400"
                    }`}
                  >
                    <div className={`font-semibold ${compact ? "text-lg" : "text-2xl"}`}>
                      {option}
                    </div>
                    <div className={`mt-1 opacity-80 ${compact ? "text-xs" : "text-sm"}`}>
                      {option === "Express"
                        ? "48–72 hours"
                        : "5–7 working days"}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-3 text-2xl font-semibold text-neutral-900">Approx. weight (kg)</p>
            <input
              type="number"
              min="0.5"
              step="0.5"
              value={approxWeight}
              onChange={(event) => setApproxWeight(event.target.value)}
              placeholder="e.g. 5"
              className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-lg text-neutral-900 outline-none transition focus:border-orange-500"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-xl font-semibold text-neutral-900">
                Phones (optional)
              </label>
              <input
                type="number"
                min="0"
                value={phoneCount}
                onChange={(event) => setPhoneCount(event.target.value)}
                className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-lg text-neutral-900 outline-none transition focus:border-orange-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-xl font-semibold text-neutral-900">
                Laptops (optional)
              </label>
              <input
                type="number"
                min="0"
                value={laptopCount}
                onChange={(event) => setLaptopCount(event.target.value)}
                className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-lg text-neutral-900 outline-none transition focus:border-orange-500"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-neutral-700">
                Full name
              </label>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none transition focus:border-orange-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-neutral-700">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none transition focus:border-orange-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-neutral-700">
              Phone number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none transition focus:border-orange-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-neutral-700">
              Additional details
            </label>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={4}
              placeholder="Tell us about the contents, pickup location, or any urgent deadlines."
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none transition focus:border-orange-500"
            />
          </div>

          {message && (
            <div
              className={`rounded-xl border px-3 py-2 text-sm ${
                message.type === "success"
                  ? "border-green-200 bg-green-50 text-green-700"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 py-3 text-base font-semibold text-white transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            {isSubmitting ? "Sending quote request..." : "Get a quote"}
          </button>
        </form>

        <aside
          className={`rounded-3xl border border-neutral-200 bg-white shadow-sm ${
            compact ? "p-4" : "p-5"
          }`}
        >
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500">
            <PackageSearch className="h-4 w-4 text-orange-600" />
            Quick estimate
          </div>

          <div className={`rounded-2xl bg-neutral-100 ${compact ? "mt-3 p-3" : "mt-4 p-4"}`}>
            <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
              Selected route
            </p>
            <h3
              className={`mt-2 font-bold text-neutral-900 ${
                compact ? "text-xl" : "text-2xl"
              }`}
            >
              {ROUTE_OPTIONS.find((option) => option.id === route)?.label}
            </h3>
          </div>

          <div className={`space-y-3 text-sm text-neutral-600 ${compact ? "mt-3" : "mt-4"}`}>
            <div
              className={`rounded-2xl border border-neutral-200 bg-orange-50 ${
                compact ? "p-3" : "p-4"
              }`}
            >
              <p className="text-xs uppercase tracking-[0.2em] text-orange-700">
                Estimate summary
              </p>
              <p
                className={`mt-2 font-semibold text-neutral-900 ${
                  compact ? "text-sm" : "text-base"
                }`}
              >
                {routeSummary.summary}
              </p>
            </div>

            <div
              className={`rounded-2xl border border-neutral-200 bg-neutral-50 ${
                compact ? "p-3" : "p-4"
              }`}
            >
              <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
                Notes
              </p>
              <p className="mt-2 leading-6">{routeSummary.note}</p>
            </div>
          </div>

          <div
            className={`rounded-2xl border border-neutral-200 bg-neutral-50 ${
              compact ? "mt-4 p-3" : "mt-6 p-4"
            }`}
          >
            <div className="flex items-center gap-2 text-neutral-900">
              <Mail className="h-4 w-4 text-orange-600" />
              <span className="font-semibold">Quote support</span>
            </div>
            <p className="mt-2 text-sm text-neutral-600">
              Once you submit this form, we’ll send the request to our team and
              reply through the email you provide.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
