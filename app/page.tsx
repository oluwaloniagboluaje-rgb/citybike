import Link from "next/link";
import Image from "next/image";
import {
  MapPin,
  MessageCircle,
  ShieldCheck,
  Globe2,
  PackageSearch,
  Truck,
  Building2,
  Bike,
} from "lucide-react";
import ReviewsSection from "@/components/reviews/ReviewsSection";

export default function Home() {
  return (
    <div>
      <section className="relative overflow-hidden bg-black text-white">
        <div className="absolute inset-0">
          <img
            src="https://buycars.ng/wp-content/uploads/Top-10-Logistics-Service-Companies-in-Nigeria-scaled.jpg"
            alt="Logistics service companies in Nigeria"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-black/65" />
        </div>
        <div className="relative mx-auto max-w-6xl px-4 py-20 text-center">
          <Image
            src="/citybike-logo.jpeg"
            alt="CityBike Logistics"
            width={88}
            height={88}
            className="mx-auto mb-6 rounded-2xl"
            priority
          />
          <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-1.5 text-sm text-orange-400">
            <Bike className="h-4 w-4" />
            Local · Interstate · International
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Your package.
            <br />
            <span className="text-orange-500">Our speed.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-neutral-300">
            CityBike Logistics gets your parcels, documents, and cargo moving
            — across town, across Nigeria, or across the world — tracked live
            every step of the way.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/register"
              className="rounded-md bg-orange-600 px-5 py-2.5 font-medium text-white hover:bg-orange-500"
            >
              Get Started
            </Link>
            <Link
              href="/track"
              className="flex items-center gap-1.5 rounded-md border border-neutral-700 px-5 py-2.5 font-medium text-white hover:bg-neutral-900"
            >
              <PackageSearch className="h-4 w-4" />
              Track a Package
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-8 sm:grid-cols-3">
          <Feature
            icon={<Bike className="h-6 w-6" />}
            title="Book in seconds"
            desc="Tell us your pickup, drop-off, and package details. Our team confirms and assigns a rider right away."
          />
          <Feature
            icon={<MapPin className="h-6 w-6" />}
            title="Live tracking"
            desc="Follow your rider's exact location in real time on a live map, from pickup to delivery."
          />
          <Feature
            icon={<MessageCircle className="h-6 w-6" />}
            title="Real-time chat"
            desc="Message your driver or our team directly for updates, directions, or special instructions."
          />
        </div>

        <div className="mt-16">
          <h2 className="text-center text-2xl font-bold text-neutral-900">
            Our Services
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <ServiceCard
              icon={<Bike className="h-5 w-5" />}
              title="Local Pickup & Delivery"
              desc="Fast, same-city delivery for parcels, documents, and goods."
            />
            <ServiceCard
              icon={<Truck className="h-5 w-5" />}
              title="Interstate Delivery"
              desc="Reliable parcel and cargo delivery between states."
            />
            <ServiceCard
              icon={<Globe2 className="h-5 w-5" />}
              title="International Cargo Shipping"
              desc="Shipping to the UK, USA, Canada, and beyond."
            />
            <ServiceCard
              icon={<PackageSearch className="h-5 w-5" />}
              title="DHL Express Shipping"
              desc="Trusted express shipping through our DHL partnership."
            />
            <ServiceCard
              icon={<Building2 className="h-5 w-5" />}
              title="E-commerce Fulfillment"
              desc="Order fulfillment and last-mile delivery for online sellers."
            />
            <ServiceCard
              icon={<ShieldCheck className="h-5 w-5" />}
              title="Corporate Logistics"
              desc="Errand services and delivery partnerships for businesses."
            />
          </div>
        </div>

        <ReviewsSection />

        <div className="mt-16 flex items-center justify-center gap-2 text-sm text-neutral-500">
          <ShieldCheck className="h-4 w-4" />
          Every order is confirmed by our team before a rider is assigned.
        </div>
      </div>
    </div>
  );
}

function Feature({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-6">
      <div className="mb-3 inline-flex rounded-lg bg-orange-50 p-2.5 text-orange-600">
        {icon}
      </div>
      <h3 className="font-semibold text-neutral-900">{title}</h3>
      <p className="mt-1 text-sm text-neutral-600">{desc}</p>
    </div>
  );
}

function ServiceCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex gap-3 rounded-lg border border-neutral-200 bg-white p-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-black text-orange-500">
        {icon}
      </div>
      <div>
        <h4 className="text-sm font-semibold text-neutral-900">{title}</h4>
        <p className="mt-0.5 text-xs text-neutral-500">{desc}</p>
      </div>
    </div>
  );
}