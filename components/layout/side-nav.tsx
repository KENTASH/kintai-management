"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  LayoutDashboard,
  BookOpen,
  Calendar,
  Clock4,
  Users,
  CalendarCheck2,
  Bell,
  Settings,
  ChevronLeft,
  Shield,
} from "lucide-react"
import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { useI18n } from "@/lib/i18n/context"

interface SidebarNavItem {
  titleKey: string
  descriptionKey: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  adminOnly?: boolean
}

const sidebarNavItems: SidebarNavItem[] = [
  {
    titleKey: "dashboard",
    descriptionKey: "dashboard-description",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    titleKey: "attendance-and-expenses",
    descriptionKey: "attendance-and-expenses-description",
    href: "/attendance",
    icon: BookOpen,
  },
  {
    titleKey: "leave",
    descriptionKey: "leave-description",
    href: "/leave",
    icon: Calendar,
  },
  {
    titleKey: "overtime",
    descriptionKey: "overtime-description",
    href: "/overtime",
    icon: Clock4,
  },
  {
    titleKey: "settings",
    descriptionKey: "settings-description",
    href: "/settings",
    icon: Settings,
  },
]

const adminNavItems: SidebarNavItem[] = [
  {
    titleKey: "approve-attendance",
    descriptionKey: "approve-attendance-description",
    href: "/approve-attendance",
    icon: BookOpen,
    adminOnly: true,
  },
  {
    titleKey: "approve-leave",
    descriptionKey: "approve-leave-description",
    href: "/approve-leave",
    icon: Calendar,
    adminOnly: true,
  },
  {
    titleKey: "approve-overtime",
    descriptionKey: "approve-overtime-description",
    href: "/approve-overtime",
    icon: Clock4,
    adminOnly: true,
  },
  {
    titleKey: "members",
    descriptionKey: "members-description",
    href: "/members",
    icon: Users,
    adminOnly: true,
  },
  {
    titleKey: "holidays",
    descriptionKey: "holidays-description",
    href: "/holidays",
    icon: CalendarCheck2,
    adminOnly: true,
  },
  {
    titleKey: "notifications-management",
    descriptionKey: "notifications-management-description",
    href: "/notifications",
    icon: Bell,
    adminOnly: true,
  },
]

interface SideNavProps {
  isOpen: boolean
  onToggle: () => void
}

export function SideNav({ isOpen, onToggle }: SideNavProps) {
  const router = useRouter()
  const pathname = usePathname()
  const isAdmin = true // TODO: Replace with actual admin check
  const { t } = useI18n()

  const handleNavigation = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault()
    router.push(href)
  }

  return (
    <nav 
      className={cn(
        "h-[calc(100vh-6rem)] bg-white dark:bg-gray-950 border-r transition-all duration-300 ease-in-out relative",
        isOpen ? "w-72" : "w-16"
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "absolute -right-3 top-6 z-10 h-6 w-6 rounded-full border bg-background",
          "hover:bg-blue-100 hover:text-blue-600",
          "transition-transform duration-300",
          isOpen ? "rotate-0" : "rotate-180"
        )}
        onClick={onToggle}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <ScrollArea className="h-full custom-scrollbar">
        <div className="space-y-2 p-4">
          {sidebarNavItems.map((item) => (
            <div key={item.href} className="group relative">
              <Button
                variant={pathname === item.href ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start transition-all duration-200",
                  pathname === item.href 
                    ? "bg-blue-50 dark:bg-blue-900" 
                    : "hover:bg-blue-50 dark:hover:bg-blue-900",
                  "group-hover:translate-x-1",
                  !isOpen && "px-2"
                )}
                asChild
              >
                <Link href={item.href} onClick={(e) => handleNavigation(e, item.href)}>
                  <item.icon className={cn(
                    "shrink-0",
                    isOpen ? "mr-2 h-4 w-4" : "h-5 w-5"
                  )} />
                  {isOpen && (
                    <div className="flex flex-col items-start min-w-0">
                      <span className="truncate">{t(item.titleKey)}</span>
                      <span 
                        className="text-xs text-muted-foreground truncate hover:whitespace-normal hover:text-clip group-hover:overflow-x-auto"
                        title={t(item.descriptionKey)}
                      >
                        {t(item.descriptionKey)}
                      </span>
                    </div>
                  )}
                </Link>
              </Button>
            </div>
          ))}

          {isAdmin && (
            <>
              <div className="pt-4">
                {isOpen && (
                  <div className="flex items-center gap-2 px-2 py-1.5 text-sm font-medium text-muted-foreground">
                    <Shield className="h-4 w-4" />
                    {t("admin-menu")}
                  </div>
                )}
                <Separator className="my-2" />
              </div>
              {adminNavItems.map((item) => (
                <div key={item.href} className="group relative">
                  <Button
                    variant={pathname === item.href ? "secondary" : "ghost"}
                    className={cn(
                      "w-full justify-start transition-all duration-200",
                      pathname === item.href 
                        ? "bg-blue-100 dark:bg-blue-800" 
                        : "hover:bg-blue-100 dark:hover:bg-blue-800",
                      "group-hover:translate-x-1",
                      !isOpen && "px-2",
                      "text-blue-800 dark:text-blue-200"
                    )}
                    asChild
                  >
                    <Link href={item.href} onClick={(e) => handleNavigation(e, item.href)}>
                      <item.icon className={cn(
                        "shrink-0",
                        isOpen ? "mr-2 h-4 w-4" : "h-5 w-5"
                      )} />
                      {isOpen && (
                        <div className="flex flex-col items-start min-w-0">
                          <span className="truncate">{t(item.titleKey)}</span>
                          <span 
                            className="text-xs text-muted-foreground truncate hover:whitespace-normal hover:text-clip group-hover:overflow-x-auto"
                            title={t(item.descriptionKey)}
                          >
                            {t(item.descriptionKey)}
                          </span>
                        </div>
                      )}
                    </Link>
                  </Button>
                </div>
              ))}
            </>
          )}
        </div>
      </ScrollArea>
    </nav>
  )
}