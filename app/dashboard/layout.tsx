"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";
import { MainLayout } from "@/components/layout/main-layout";
import { supabase } from "@/lib/supabaseClient";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      if (loading) return; // 読み込み中は何もしない
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession) {
        router.replace("/auth/login"); // 未認証ならログインページへ
      }
    };
    checkAuth();
  }, [loading, router]);

  return <MainLayout>{children}</MainLayout>; // Loading... を表示せず即コンテンツを表示
}
