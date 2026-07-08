import Image from "next/image";
import { Mail, MapPin, Phone } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-neutral-800 bg-black text-neutral-300">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-8 sm:grid-cols-3">
          <div>
            <div className="flex items-center gap-2">
              <Image
                src="/citybike-logo.jpeg"
                alt="CityBike Logistics"
                width={40}
                height={40}
                className="rounded-md"
              />
              <h3 className="text-lg font-bold text-white">
                CityBike <span className="text-orange-500">Logistics</span>
              </h3>
            </div>
            <p className="mt-2 text-sm italic text-orange-400">
              &ldquo;Your package, our speed.&rdquo;
            </p>
            <p className="mt-3 text-sm text-neutral-400">
              Fast, safe, and reliable pickup and delivery — local, interstate,
              and international.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
              Contact
            </h4>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
                Opposite Jaiz Bank, Molete, Ibadan
              </li>
              <li className="flex items-start gap-2">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
                <a
                  href="mailto:Citybikelogistics1@gmail.com"
                  className="hover:text-white"
                >
                  Citybikelogistics1@gmail.com
                </a>
              </li>
              <li className="flex items-start gap-2">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
                <div className="flex flex-col">
                  <a href="tel:+2349152661473" className="hover:text-white">
                    0915 266 1473
                  </a>
                  <a href="tel:+447552223724" className="hover:text-white">
                    +44 7552 223724
                  </a>
                  <a href="tel:+2349113985157" className="hover:text-white">
                    0911 398 5157
                  </a>
                </div>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
              Our Services
            </h4>
            <ul className="mt-3 space-y-1.5 text-sm text-neutral-400">
              <li>Local pickup & delivery</li>
              <li>Interstate parcel & cargo delivery</li>
              <li>International cargo shipping (UK, USA, Canada & more)</li>
              <li>DHL Express shipping</li>
              <li>E-commerce order fulfillment</li>
              <li>Personal & business errands</li>
              <li>Corporate logistics partnerships</li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-neutral-800 pt-6 text-center text-xs text-neutral-500">
          © {new Date().getFullYear()} CityBike Logistics. All rights reserved.
        </div>
      </div>
    </footer>
  );
}