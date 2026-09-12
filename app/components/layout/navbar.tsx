"use client";

import { ChangeEvent, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import ShipmentQuoteForm from "@/components/quote/ShipmentQuoteForm";
import {
  CreditCard,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  PackageSearch,
  Settings,
  ShieldAlert,
  ShoppingBag,
  Trash2,
  UserCircle2,
  X,
} from "lucide-react";

type OffcanvasView = "menu" | "faqs" | "quote" | "profile" | "settings";

export default function Navbar() {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [offcanvasView, setOffcanvasView] = useState<OffcanvasView>("menu");
  const [profileImage, setProfileImage] = useState<string>("");

  const dashboardHref = user
    ? user.role === "admin"
      ? "/dashboard/admin"
      : user.role === "driver"
      ? "/dashboard/driver"
      : "/dashboard/customer"
    : "/login";

  const navItems = [
    { label: "Home", href: "/", icon: Home },
    { label: "Track Package", href: "/track", icon: PackageSearch },
    { label: "Dashboard", href: dashboardHref, icon: LayoutDashboard },
    { label: "Orders", href: dashboardHref, icon: ShoppingBag },
    { label: "Profile", href: "#", icon: UserCircle2, view: "profile" },
    { label: "Settings", href: "#", icon: Settings, view: "settings" },
  ];

  const paymentDetails = [
    { label: "Account name", value: "Citybike logistics & Global Services" },
    { label: "Bank", value: "First Bank" },
    { label: "Account number", value: "2049217155" },
    { label: "Account type", value: "Business Current" },
  ];

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const savedProfileImage = window.localStorage.getItem("citybike-profile-image");
      if (savedProfileImage) {
        setProfileImage(savedProfileImage);
      }
    } catch {
      // Ignore localStorage access failures.
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      if (profileImage) {
        window.localStorage.setItem("citybike-profile-image", profileImage);
      } else {
        window.localStorage.removeItem("citybike-profile-image");
      }
    } catch {
      // Ignore localStorage write failures.
    }
  }, [profileImage]);

  const profileInitials = user
    ? user.name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || "")
        .join("") || "C"
    : "G";

  function handleProfileImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setProfileImage(result);
    };

    reader.readAsDataURL(file);
  }

  const faqItems = [
    {
      question: "What services do you offer?",
      answer:
        "We offer local and interstate delivery within Nigeria, international cargo shipping, UK–Nigeria shipping, and worldwide express delivery.",
    },
    {
      question: "What countries do you ship to?",
      answer:
        "We ship to the UK, USA, Canada, UAE (Dubai), China, European countries, and many other destinations worldwide.",
    },
    {
      question: "Do you ship for businesses or only individuals?",
      answer:
        "We ship for both individuals and businesses. Whether you’re sending a personal parcel, customer orders, or regular business shipments, we have delivery options to suit your needs.",
    },
    {
      question: "Is there a minimum weight for shipping?",
      answer:
        "It depends on the service. Our Nigeria-to-UK Easy Plan has no minimum weight, while some other international cargo services have minimum weight requirements.",
    },
    {
      question: "How long does shipping take?",
      answer:
        "Nigeria to UK takes 7–10 working days from dispatch. Other international destinations take 10–15 working days from dispatch, while Express Shipping takes 3–5 working days.",
    },
    {
      question: "How can I track my package?",
      answer:
        "Once your shipment is processed, you’ll receive a Tracking ID which you can use on our website to follow your package.",
    },
    {
      question: "What items can I ship?",
      answer:
        "We accept clothing, food items, personal effects, phones, laptops, and many other items. Some items may be restricted, so please confirm with us before shipping.",
    },
  ];

  function confirmLogout() {
    setShowLogoutModal(false);
    setMobileMenuOpen(false);
    setOffcanvasView("menu");
    logout();
  }

  function closeMenu() {
    setMobileMenuOpen(false);
    setOffcanvasView("menu");
  }

  return (
    <nav className="border-b border-neutral-200 bg-black">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-bold text-white">
          <Image
            src="/citybike-logo.jpeg"
            alt="CityBike Logistics"
            width={36}
            height={36}
            className="h-16 w-auto"
            priority
          />
          <span>
            CityBike <span className="text-orange-500">Logistics</span>
          </span>
        </Link>

        <div className="hidden items-center gap-4 md:flex">
          <Link
            href="/track"
            className="flex items-center gap-1.5 text-sm font-medium text-neutral-300 hover:text-white"
          >
            <PackageSearch className="h-4 w-4" />
            Track Package
          </Link>

          {user ? (
            <>
              <Link
                href={dashboardHref}
                className="text-sm font-medium text-neutral-300 hover:text-white"
              >
                Dashboard
              </Link>
              <div className="hidden items-center gap-3 sm:flex">
                <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-neutral-700 bg-neutral-800">
                  {profileImage ? (
                    <img
                      src={profileImage}
                      alt={user.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-xs font-semibold text-neutral-200">{profileInitials}</span>
                  )}
                </div>
                <span className="text-sm text-neutral-400">
                  {user.name} · {user.role}
                </span>
              </div>
              <button
                onClick={() => setShowLogoutModal(true)}
                className="flex items-center gap-1 rounded-md border border-neutral-700 px-3 py-1.5 text-sm font-medium text-neutral-200 hover:bg-neutral-800"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm font-medium text-neutral-300 hover:text-white"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="rounded-md bg-orange-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-500"
              >
                Sign up
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          className="inline-flex items-center justify-center rounded-md p-2 text-neutral-200"
          onClick={() => {
            setMobileMenuOpen((open) => {
              const next = !open;
              if (!next) {
                setOffcanvasView("menu");
              }
              return next;
            });
          }}
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/30"
            onClick={closeMenu}
          />

          <aside className="absolute right-0 top-0 h-full w-full max-w-md bg-neutral-100 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3">
              <button
                type="button"
                aria-label="Close menu"
                onClick={closeMenu}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-200 text-neutral-700 transition hover:bg-neutral-300"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-2">
                <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-600">
                  {user ? user.role : "Guest"}
                </span>
              </div>
            </div>

            <div className="h-[calc(100%-120px)] overflow-y-auto px-4 pb-6 pt-4">
              {offcanvasView === "menu" ? (
                <>
                  <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
                      Welcome back
                    </p>

                    {user ? (
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-neutral-200 bg-neutral-100">
                            {profileImage ? (
                              <img
                                src={profileImage}
                                alt={user.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span className="text-sm font-semibold text-neutral-700">
                                {profileInitials}
                              </span>
                            )}
                          </div>

                          <div>
                            <p className="text-base font-semibold text-neutral-900">
                              {user.name}
                            </p>
                            <p className="text-sm text-neutral-500 capitalize">
                              {user.role}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowLogoutModal(true)}
                          className="flex items-center gap-2 rounded-full border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
                        >
                          <LogOut className="h-4 w-4" />
                          Logout
                        </button>
                      </div>
                    ) : (
                      <div className="mt-3 flex gap-2">
                        <Link
                          href="/login"
                          onClick={closeMenu}
                          className="flex-1 rounded-full bg-neutral-900 px-4 py-2 text-center text-sm font-semibold text-white transition hover:bg-neutral-700"
                        >
                          Login
                        </Link>
                        <Link
                          href="/register"
                          onClick={closeMenu}
                          className="flex-1 rounded-full border border-neutral-300 px-4 py-2 text-center text-sm font-semibold text-neutral-800 transition hover:bg-neutral-100"
                        >
                          Sign up
                        </Link>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 space-y-2">
                    {navItems.map((item) => {
                      const Icon = item.icon;

                      if (item.view) {
                        return (
                          <button
                            key={item.label}
                            type="button"
                            onClick={() => {
                              if (user) {
                                setOffcanvasView(item.view as OffcanvasView);
                              }
                            }}
                            className="flex w-full items-center justify-between rounded-2xl border border-neutral-200 bg-white px-3 py-3 text-left text-neutral-800 shadow-sm transition hover:border-neutral-300 hover:bg-neutral-50"
                          >
                            <span className="flex items-center gap-3 text-base font-medium">
                              <Icon className="h-5 w-5 text-neutral-600" />
                              {item.label}
                            </span>
                            <span className="text-lg text-neutral-400">›</span>
                          </button>
                        );
                      }

                      return (
                        <Link
                          key={item.label}
                          href={item.href}
                          onClick={closeMenu}
                          className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-white px-3 py-3 text-neutral-800 shadow-sm transition hover:border-neutral-300 hover:bg-neutral-50"
                        >
                          <span className="flex items-center gap-3 text-base font-medium">
                            <Icon className="h-5 w-5 text-neutral-600" />
                            {item.label}
                          </span>
                          <span className="text-lg text-neutral-400">›</span>
                        </Link>
                      );
                    })}
                  </div>

                  <div className="mt-6 space-y-2">
                    <button
                      type="button"
                      onClick={() => setOffcanvasView("profile")}
                      className="flex w-full items-center justify-between rounded-2xl border border-neutral-200 bg-white px-3 py-3 text-left text-neutral-800 shadow-sm transition hover:border-neutral-300 hover:bg-neutral-50"
                    >
                      <span className="flex items-center gap-3 text-base font-medium">
                        <UserCircle2 className="h-5 w-5 text-neutral-600" />
                        Profile
                      </span>
                      <span className="text-lg text-neutral-400">›</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setOffcanvasView("settings")}
                      className="flex w-full items-center justify-between rounded-2xl border border-neutral-200 bg-white px-3 py-3 text-left text-neutral-800 shadow-sm transition hover:border-neutral-300 hover:bg-neutral-50"
                    >
                      <span className="flex items-center gap-3 text-base font-medium">
                        <Settings className="h-5 w-5 text-neutral-600" />
                        Settings
                      </span>
                      <span className="text-lg text-neutral-400">›</span>
                    </button>
                  </div>

                  <div className="mt-6 space-y-2">
                    <button
                      type="button"
                      onClick={() => setOffcanvasView("faqs")}
                      className="flex w-full items-center justify-between rounded-2xl border border-neutral-200 bg-white px-3 py-3 text-left text-neutral-800 shadow-sm transition hover:border-neutral-300 hover:bg-neutral-50"
                    >
                      <span className="flex items-center gap-3 text-base font-medium">
                        <PackageSearch className="h-5 w-5 text-neutral-600" />
                        FAQs
                      </span>
                      <span className="text-lg text-neutral-400">›</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setOffcanvasView("quote")}
                      className="flex w-full items-center justify-between rounded-2xl border border-neutral-200 bg-white px-3 py-3 text-left text-neutral-800 shadow-sm transition hover:border-neutral-300 hover:bg-neutral-50"
                    >
                      <span className="flex items-center gap-3 text-base font-medium">
                        <PackageSearch className="h-5 w-5 text-neutral-600" />
                        Get a Quote
                      </span>
                      <span className="text-lg text-neutral-400">›</span>
                    </button>
                  </div>
                </>
              ) : offcanvasView === "profile" ? (
                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={() => setOffcanvasView("menu")}
                    className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
                  >
                    ← Back to menu
                  </button>

                  <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
                      Profile
                    </p>
                    <h2 className="mt-2 text-2xl font-bold text-neutral-900">
                      {user ? user.name : "Guest profile"}
                    </h2>

                    <div className="mt-4 flex items-center gap-4">
                      <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-neutral-200 bg-neutral-100">
                        {profileImage ? (
                          <img
                            src={profileImage}
                            alt={user?.name || "Profile picture"}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-lg font-semibold text-neutral-700">
                            {profileInitials}
                          </span>
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="text-sm font-medium text-neutral-700">
                          {user ? user.role : "Guest user"}
                        </p>
                        <p className="mt-1 text-sm text-neutral-500">
                          {user ? user.email : "Login to save a profile picture"}
                        </p>
                      </div>
                    </div>

                    <label className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-3 py-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100">
                      <UserCircle2 className="h-4 w-4" />
                      {profileImage ? "Change profile picture" : "Add profile picture"}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleProfileImageUpload}
                      />
                    </label>
                  </div>
                </div>
              ) : offcanvasView === "settings" ? (
                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={() => setOffcanvasView("menu")}
                    className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
                  >
                    ← Back to menu
                  </button>

                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
                      Settings
                    </p>
                    <h2 className="mt-2 text-2xl font-bold text-neutral-900">
                      Account settings
                    </h2>
                  </div>

                  <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
                        Account & security
                      </p>
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
                        Secure
                      </span>
                    </div>

                    <div className="mt-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-neutral-800">
                        <CreditCard className="h-4 w-4 text-neutral-600" />
                        Payment method
                      </div>

                      <div className="mt-2 rounded-xl bg-white p-3 shadow-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                            Transfer
                          </span>
                          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-700">
                            Preferred
                          </span>
                        </div>

                        <div className="mt-3 space-y-2 text-sm text-neutral-700">
                          {paymentDetails.map((detail) => (
                            <div key={detail.label} className="flex items-center justify-between gap-3">
                              <span className="text-neutral-500">{detail.label}</span>
                              <span className="text-right font-medium text-neutral-800">{detail.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 space-y-2">
                      <button
                        type="button"
                        className="flex w-full items-center justify-between rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-left text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
                      >
                        <span className="flex items-center gap-2">
                          <ShieldAlert className="h-4 w-4 text-amber-600" />
                          Deactivate account
                        </span>
                        <span className="text-lg text-neutral-400">›</span>
                      </button>

                      <button
                        type="button"
                        className="flex w-full items-center justify-between rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-left text-sm font-medium text-red-700 transition hover:bg-red-100"
                      >
                        <span className="flex items-center gap-2">
                          <Trash2 className="h-4 w-4" />
                          Delete account
                        </span>
                        <span className="text-lg text-red-500">›</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : offcanvasView === "faqs" ? (
                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={() => setOffcanvasView("menu")}
                    className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
                  >
                    ← Back to menu
                  </button>

                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
                      Help center
                    </p>
                    <h2 className="mt-2 text-2xl font-bold text-neutral-900">FAQs</h2>
                  </div>

                  <div className="space-y-3">
                    {faqItems.map((item) => (
                      <details
                        key={item.question}
                        className="group rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"
                      >
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-left font-semibold text-neutral-900">
                          <span>{item.question}</span>
                          <span className="text-xl text-neutral-500 transition group-open:rotate-45">
                            +
                          </span>
                        </summary>
                        <p className="mt-3 text-sm leading-6 text-neutral-600">
                          {item.answer}
                        </p>
                      </details>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={() => setOffcanvasView("menu")}
                    className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
                  >
                    ← Back to menu
                  </button>

                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
                      Request a quote
                    </p>
                    <h2 className="mt-2 text-2xl font-bold text-neutral-900">
                      Get a Quote
                    </h2>
                  </div>

                  <div className="pb-2">
                    <ShipmentQuoteForm compact />
                  </div>
                </div>
              )}
            </div>

            <div className="absolute inset-x-0 bottom-0 border-t border-neutral-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-900 text-white shadow-sm transition hover:bg-neutral-700"
                >
                  <Menu className="h-5 w-5" />
                </button>

                <Link
                  href="/track"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-full bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-400"
                >
                  <PackageSearch className="h-4 w-4" />
                  Ship Now
                </Link>
              </div>
            </div>
          </aside>
        </div>
      )}

      {showLogoutModal && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 px-4"
          onClick={() => setShowLogoutModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-lg bg-white p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold text-neutral-900">Log out?</h2>
            <p className="mt-1 text-sm text-neutral-600">
              Are you sure you want to log out of your account?
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmLogout}
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}