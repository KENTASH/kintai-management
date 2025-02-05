"use client"

import { usePathname } from "next/navigation"
import { MainLayout } from "./main-layout"

export function AuthLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLoginPage = pathname === "/"
  const isAuthenticated = document.cookie.includes('auth=true')

  if (isLoginPage && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-blue-50 dark:bg-blue-950">
        {children}
      </div>
    )
  }

  return <MainLayout>{children}</MainLayout>
} 