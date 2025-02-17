"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!session) {
      console.log("🚨 未認証のためリダイレクト");
      router.replace("/auth/login");
    }
  }, [loading, session, router]);

  // MainLayoutとDashboardContentを削除し、childrenのみを返す
  return <>{children}</>;
}
