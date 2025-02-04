"use client"

import { Building2 } from "lucide-react"
import { useI18n } from "@/lib/i18n/context"

export function MainNav() {
  const { t } = useI18n()

  return (
    <div className="flex items-center space-x-2">
      <Building2 className="h-6 w-6" />
      <span className="font-bold text-xl">{t("app-title")}</span>
    </div>
  )
}