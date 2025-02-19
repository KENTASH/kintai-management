"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/providers/AuthProvider"
import { useI18n } from "@/lib/i18n/context"
import { supabase } from "@/lib/supabaseClient"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { LogOut, Menu } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { useRouter } from "next/navigation"
import type { Database } from "@/types/supabase"

interface UserBranchInfo {
  branch: string
  branch_master: {
    name_jp: string
    name_en: string
  }
}

export function Header({ toggleSideNav }: { toggleSideNav: () => void }) {
  const { session } = useAuth()
  const { t, language } = useI18n()
  const { toast } = useToast()
  const router = useRouter()
  const [branchInfo, setBranchInfo] = useState<UserBranchInfo | null>(null)

  useEffect(() => {
    const fetchBranchInfo = async () => {
      if (session?.user?.id) {
        const { data, error } = await supabase
          .from('users')
          .select(`
            branch,
            branch_master!users_branch_fkey (
              name_jp,
              name_en
            )
          `)
          .eq('auth_id', session.user.id)
          .single()

        if (error) {
          console.error('Error fetching branch info:', error)
          return
        }

        if (data?.branch_master) {
          setBranchInfo({
            branch: data.branch,
            branch_master: {
              name_jp: data.branch_master[0]?.name_jp || '',
              name_en: data.branch_master[0]?.name_en || ''
            }
          })
        }
      }
    }

    fetchBranchInfo()
  }, [session?.user?.id])

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error

      toast({
        title: "ログアウト成功",
        description: "ログアウトしました",
      })

      router.push("/auth/login")
    } catch (error) {
      console.error('Logout error:', error)
      toast({
        title: "エラー",
        description: "ログアウトに失敗しました",
        variant: "destructive",
      })
    }
  }

  const getBranchName = () => {
    if (!branchInfo?.branch_master) return "不明"
    return language === 'en' ? branchInfo.branch_master.name_en : branchInfo.branch_master.name_jp
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <Button
          variant="ghost"
          className="mr-2 px-2 hover:bg-transparent hover:text-blue-600"
          onClick={toggleSideNav}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="flex flex-1 items-center justify-between">
          <nav className="flex items-center space-x-6">
            {/* ここに必要なヘッダーナビゲーション項目を追加 */}
          </nav>
          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground">
              {getBranchName()}
            </div>
            <Avatar className="h-8 w-8 avatar-shake">
              <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${session?.user?.email}`} />
              <AvatarFallback>
                {session?.user?.email?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="hover:bg-transparent hover:text-red-600"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
} 