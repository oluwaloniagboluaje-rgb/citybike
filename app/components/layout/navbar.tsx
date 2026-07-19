"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { LogOut, PackageSearch, Menu, X } from "lucide-react";

export default function Navbar() {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const dashboardHref = user
    ? user.role === "admin"
      ? "/dashboard/admin"
      : user.role === "driver"
      ? "/dashboard/driver"
      : "/dashboard/customer"
    : "/login";

  function confirmLogout() {
    setShowLogoutModal(false);
    setMobileMenuOpen(false);
    logout();
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
              <span className="hidden text-sm text-neutral-400 sm:inline">
                {user.name} · {user.role}
              </span>
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
          className="inline-flex items-center justify-center rounded-md p-2 text-neutral-200 md:hidden"
          onClick={() => setMobileMenuOpen((open) => !open)}
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="border-t border-neutral-800 bg-black px-4 py-4 md:hidden">
          <div className="flex flex-col gap-3">
            <Link
              href="/track"
              className="flex items-center gap-1.5 text-sm font-medium text-neutral-300 hover:text-white"
              onClick={() => setMobileMenuOpen(false)}
            >
              <PackageSearch className="h-4 w-4" />
              Track Package
            </Link>

            {user ? (
              <>
                <Link
                  href={dashboardHref}
                  className="text-sm font-medium text-neutral-300 hover:text-white"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Dashboard
                </Link>
                <span className="text-sm text-neutral-400">
                  {user.name} · {user.role}
                </span>
                <button
                  onClick={() => setShowLogoutModal(true)}
                  className="flex items-center gap-1 rounded-md border border-neutral-700 px-3 py-1.5 text-left text-sm font-medium text-neutral-200 hover:bg-neutral-800"
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
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="rounded-md bg-orange-600 px-3 py-1.5 text-center text-sm font-medium text-white hover:bg-orange-500"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      )}

      {showLogoutModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={() => setShowLogoutModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-lg bg-white p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold text-neutral-900">
              Log out?
            </h2>
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