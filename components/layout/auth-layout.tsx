"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MainLayout } from "./main-layout";
import { supabase } from "@/lib/supabaseClient";

export function AuthLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/auth/login";
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    console.log("✅ 認証チェック開始...");

    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        console.log("✅ 認証チェック結果:", session);
        setIsAuthenticated(!!session);
        if (session) {
          router.push("/dashboard");
        }
      } catch (error) {
        console.error("❌ 認証チェックエラー:", error);
        setIsAuthenticated(false);
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log("🔄 認証状態変更:", _event, session);
      setIsAuthenticated(!!session);
      if (session) {
        router.push("/dashboard");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  if (isLoginPage) {
    return <div className="min-h-screen bg-blue-50 dark:bg-blue-950">{children}</div>;
  }

  return <MainLayout>{children}</MainLayout>;
}
