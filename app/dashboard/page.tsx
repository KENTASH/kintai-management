"use client"

import { useAuth } from "@/providers/AuthProvider"
import { MainLayout } from "@/components/layout/main-layout"
import { DashboardContent } from "@/components/dashboard/dashboard-content"

export default function DashboardPage() {
  const { session } = useAuth()

  if (!session) {
    return null
  }

  // MainLayoutをここで適用し、DashboardContentを表示
  return (
    <MainLayout>
      <DashboardContent />
    </MainLayout>
  )
}