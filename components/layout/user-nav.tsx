"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useI18n } from "@/lib/i18n/context"
import { LogOut, Settings } from "lucide-react"
import Image from "next/image"
import { useToast } from "@/components/ui/use-toast"
import { supabase } from "@/lib/supabaseClient"
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
import { useAuth } from "@/providers/AuthProvider"

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

interface StoredUserProfile {
  employee_id: string
  last_name: string
  first_name: string
  last_name_en: string | null
  first_name_en: string | null
  branch_name: string
  branch_name_jp: string
  branch_name_en: string
  avatar_url: string | null
}

export function UserNav() {
  const { session, userProfile, setUserProfile } = useAuth()
  const { t, language } = useI18n()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedAvatar, setSelectedAvatar] = useState(avatarSamples[0].url)
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const checkProfile = () => {
      const storedProfile = sessionStorage.getItem('userProfile')
      if (storedProfile) {
        const parsedProfile = JSON.parse(storedProfile)
        if (setUserProfile) {
          setUserProfile(parsedProfile)
        }
      }
    }

    checkProfile()
    window.addEventListener('storage', checkProfile)

    return () => {
      window.removeEventListener('storage', checkProfile)
    }
  }, [setUserProfile])

  const getFullName = () => {
    if (!userProfile) return ''
    return language === 'en'
      ? `${userProfile.first_name_en || ''} ${userProfile.last_name_en || ''}`
      : `${userProfile.last_name} ${userProfile.first_name}`
  }

  const getBranchName = () => {
    if (!userProfile) return "不明"
    return language === 'en' ? userProfile.branch_name_en : userProfile.branch_name_jp
  }

  const handleLogout = async () => {
    try {
      setIsLoading(true)
  
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
  
      // 🔹 修正: `/` ではなく `/auth/login` へリダイレクト
      window.location.href = "/auth/login";
  
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
        {userProfile && (
          <div className="hidden md:block text-right">
            <p className="text-sm font-medium">{getFullName()}</p>
            <p className="text-xs">{userProfile.employee_id}</p>
            <p className="text-xs">{getBranchName()}</p>
          </div>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              className="relative h-8 w-8 rounded-full hover:bg-white/10"
            >
              <Avatar className="h-8 w-8 bg-white avatar-shake">
                <AvatarImage 
                  src={userProfile?.avatar_url || selectedAvatar} 
                  alt={getFullName()} 
                  className="bg-white" 
                />
                <AvatarFallback className="bg-white text-gray-900">
                  {userProfile?.last_name?.[0] || "U"}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64 z-[300]" align="end">
            {userProfile && (
              <DropdownMenuLabel>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">{t("name-label")}</span>
                    <span className="text-sm font-medium">{getFullName()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">{t("employee-id-label")}</span>
                    <span className="text-sm font-medium">{userProfile.employee_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">{t("branch-label")}</span>
                    <span className="text-sm font-medium">{getBranchName()}</span>
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