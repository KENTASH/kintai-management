"use client"

import { DashboardContent } from "@/components/dashboard/dashboard-content"
import { useAuth } from "@/providers/AuthProvider"

export default function DashboardPage() {
  const { session } = useAuth()

  if (!session) {
    return null
  }

  return <DashboardContent />
}