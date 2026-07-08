"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function DashboardRedirect() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    router.push(
      user.role === "admin"
        ? "/dashboard/admin"
        : user.role === "driver"
        ? "/dashboard/driver"
        : "/dashboard/customer"
    );
  }, [user, loading, router]);

  return null;
}