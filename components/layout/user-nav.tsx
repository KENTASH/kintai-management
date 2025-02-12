"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabaseClient"
import { useI18n } from "@/lib/i18n/context"
import { LogOut, Settings } from "lucide-react"
import Image from "next/image"
import { useToast } from "@/components/ui/use-toast"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// アバターのサンプル画像
const avatarSamples = [
  { id: 1, url: "https://api.dicebear.com/7.x/personas/svg?seed=Kenta" },
  { id: 2, url: "https://api.dicebear.com/7.x/personas/svg?seed=Jane" },
  { id: 3, url: "https://api.dicebear.com/7.x/personas/svg?seed=Mike" },
  { id: 4, url: "https://api.dicebear.com/7.x/personas/svg?seed=Lisa" },
  { id: 5, url: "https://api.dicebear.com/7.x/personas/svg?seed=Tom" },
  { id: 6, url: "https://api.dicebear.com/7.x/personas/svg?seed=Emma" },
  { id: 7, url: "https://api.dicebear.com/7.x/personas/svg?seed=Alex" },
  { id: 8, url: "https://api.dicebear.com/7.x/personas/svg?seed=Sarah" },
  { id: 9, url: "https://api.dicebear.com/7.x/personas/svg?seed=David" },
  { id: 10, url: "https://api.dicebear.com/7.x/personas/svg?seed=Maria" },
  { id: 11, url: "https://api.dicebear.com/7.x/personas/svg?seed=James" },
  { id: 12, url: "https://api.dicebear.com/7.x/personas/svg?seed=Emily" },
  { id: 13, url: "https://api.dicebear.com/7.x/personas/svg?seed=Daniel" },
  { id: 14, url: "https://api.dicebear.com/7.x/personas/svg?seed=Sophie" },
  { id: 15, url: "https://api.dicebear.com/7.x/personas/svg?seed=Oliver" },
  { id: 16, url: "https://api.dicebear.com/7.x/personas/svg?seed=Lucy" }
]

interface UserData {
  id: string
  auth_id: string
  employee_id: string
  branch: string
  branch_name: string
  last_name: string
  first_name: string
  last_name_en: string
  first_name_en: string
  avatar_url: string | null
  language: string | null
}

export function UserNav() {
  const { t, language } = useI18n()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedAvatar, setSelectedAvatar] = useState(avatarSamples[0].url)
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [userData, setUserData] = useState<UserData | null>(null)

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const supabase = createClient()
        
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError) throw authError

        if (user) {
          // リレーションを正しく指定して取得
          const { data, error } = await supabase
            .from('users')
            .select(`
              id,
              auth_id,
              employee_id,
              last_name,
              first_name,
              last_name_en,
              first_name_en,
              branch,
              avatar_url,
              language,
              branch_master:branch_master!users_branch_fkey (
                name_jp,
                name_en
              )
            `)
            .eq('auth_id', user.id)
            .single()

          if (error) throw error

          if (!data) {
            toast({
              title: "エラー",
              description: "ユーザー情報が見つかりません",
              variant: "destructive",
            })
            return
          }

          // UserDataの型に合わせてデータを整形
          const userData: UserData = {
            id: data.id,
            auth_id: data.auth_id,
            employee_id: data.employee_id,
            branch: data.branch,
            branch_name: data.language === 'en_US' 
              ? data.branch_master.name_en 
              : data.branch_master.name_jp,
            last_name: data.last_name,
            first_name: data.first_name,
            last_name_en: data.last_name_en,
            first_name_en: data.first_name_en,
            avatar_url: data.avatar_url,
            language: data.language
          }

          setUserData(userData)
          if (userData.avatar_url) {
            setSelectedAvatar(userData.avatar_url)
          }
        }
      } catch (error) {
        console.error('Error fetching user data:', error)
        toast({
          title: "エラー",
          description: "ユーザー情報の取得に失敗しました",
          variant: "destructive",
        })
      }
    }

    fetchUserData()
  }, [toast])

  // getFullName関数を修正
  const getFullName = () => {
    if (!userData) return ''
    return userData.language === 'en_US'
      ? `${userData.first_name_en} ${userData.last_name_en}`
      : `${userData.last_name} ${userData.first_name}`
  }

  const handleLogout = async () => {
    try {
      setIsLoading(true)
      const supabase = createClient()

      // セッションを破棄
      const { error } = await supabase.auth.signOut()
      if (error) throw error

      // ブラウザのストレージをクリア
      sessionStorage.clear()
      localStorage.clear()

      // クッキーをクリア
      document.cookie.split(";").forEach((c) => {
        document.cookie = c
          .replace(/^ +/, "")
          .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/")
      })

      toast({
        title: "ログアウト成功",
        description: "ログアウトしました",
      })

      // 完全なページリロードでログイン画面に遷移
      window.location.href = "/"

    } catch (error) {
      console.error("Logout error:", error)
      toast({
        title: "エラー",
        description: "ログアウトに失敗しました",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-4">
        <div className="h-8 w-auto">
          <Image
            src="/inter-logo.png"
            alt="INTER Logo"
            width={100}
            height={32}
            className="h-8 w-auto"
            priority
          />
        </div>
        {userData && (
          <div className="hidden md:block text-right">
            <p className="text-sm font-medium">{getFullName()}</p>
            <p className="text-xs">{userData.employee_id}</p>
            <p className="text-xs">{userData.branch_name}</p>
          </div>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              className="relative h-8 w-8 rounded-full hover:bg-white/10"
            >
              <Avatar className="h-8 w-8 bg-white avatar-shake">
                <AvatarImage src={selectedAvatar} alt={getFullName()} className="bg-white" />
                <AvatarFallback className="bg-white text-gray-900">
                  {userData?.last_name?.[0] || "U"}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64 z-[300]" align="end">
            {userData && (
              <DropdownMenuLabel>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">{t("name-label")}</span>
                    <span className="text-sm font-medium">{getFullName()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">{t("employee-id-label")}</span>
                    <span className="text-sm font-medium">{userData.employee_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">{t("branch-label")}</span>
                    <span className="text-sm font-medium">{userData.branch_name}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setIsDialogOpen(true)}>
              <Settings className="mr-2 h-4 w-4" />
              <span>{t("avatar-settings")}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleLogout}
              disabled={isLoading}
              className="cursor-pointer"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>{isLoading ? "ログアウト中..." : t("logout")}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px] z-[400]">
          <DialogHeader>
            <DialogTitle>{t("avatar-settings")}</DialogTitle>
            <DialogDescription>
              {t("select-avatar")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-4 gap-4 py-4">
            {avatarSamples.map((avatar) => (
              <Button
                key={avatar.id}
                variant="outline"
                className={`p-0 h-20 hover:bg-blue-50 ${
                  selectedAvatar === avatar.url ? "ring-2 ring-blue-500" : ""
                }`}
                onClick={() => {
                  setSelectedAvatar(avatar.url)
                  setIsDialogOpen(false)
                }}
              >
                <Avatar className="h-full w-full bg-white">
                  <AvatarImage src={avatar.url} alt={`Avatar ${avatar.id}`} className="bg-white" />
                  <AvatarFallback className="bg-white">Avatar {avatar.id}</AvatarFallback>
                </Avatar>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}