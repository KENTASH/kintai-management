"use client"

import { useAuth } from "@/providers/AuthProvider"
import { DashboardContent } from "@/components/dashboard/dashboard-content"

export default function DashboardPage() {
  const { session } = useAuth()

  if (!session) {
    // return null // 未認証の場合ダッシュボードだけ空にする必要ない
  }

  // MainLayoutを削除（すでにauth-layoutで適用されているため）
  return <DashboardContent />
}