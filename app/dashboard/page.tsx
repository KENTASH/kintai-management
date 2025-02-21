"use client"

import { useEffect } from "react"
import { useAuth } from "@/providers/AuthProvider"
import { DashboardContent } from "@/components/dashboard/dashboard-content"
import { supabase } from "@/lib/supabaseClient"
import { useI18n } from "@/lib/i18n/context"

// ユーザーロールの型を定義
interface UserRole {
  user_role_id: string;
}

export default function DashboardPage() {
  const { session } = useAuth()
  const { language } = useI18n()

  useEffect(() => {
    const loadUserProfile = async () => {
      if (!session?.user?.id) return;

      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select(`
            employee_id,
            last_name,
            first_name,
            last_name_en,
            first_name_en,
            branch_name,
            branch_name_jp,
            branch_name_en,
            avatar_url
          `)
          .eq('id', session.user.id)
          .single();

        if (error) throw error;

        if (profile) {
          sessionStorage.setItem('userProfile', JSON.stringify(profile));
          console.log('✅ ユーザー情報を保存しました:', profile);
        }
      } catch (error) {
        console.error('ユーザー情報の取得に失敗:', error);
      }
    };

    loadUserProfile();
  }, [session]);

  return <DashboardContent />
}