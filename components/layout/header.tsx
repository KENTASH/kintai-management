"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/providers/AuthProvider"
import { useI18n } from "@/lib/i18n/context"
import { supabase } from "@/lib/supabaseClient"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Building2, Settings, X } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { useRouter } from "next/navigation"
import Image from "next/image"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// システム名の定義
const SYSTEM_NAME = {
  ja: "勤怠管理システム",
  en: "Attendance Management System"
} as const;

// アバターの選択肢
const AVATAR_OPTIONS = [
  { id: 'avatar1', seed: 'Kenta' },
  { id: 'avatar2', seed: 'Jane' },
  { id: 'avatar3', seed: 'Mike' },
  { id: 'avatar4', seed: 'Lisa' },
  { id: 'avatar5', seed: 'Tom' },
  { id: 'avatar6', seed: 'Emma' },
  { id: 'avatar7', seed: 'Alex' },
  { id: 'avatar8', seed: 'Sarah' },
  { id: 'avatar9', seed: 'David' },
  { id: 'avatar10', seed: 'Maria' },
  { id: 'avatar11', seed: 'James' },
  { id: 'avatar12', seed: 'Emily' },
  { id: 'avatar13', seed: 'Daniel' },
  { id: 'avatar14', seed: 'Sophie' },
  { id: 'avatar15', seed: 'Oliver' },
  { id: 'avatar16', seed: 'Lucy' },
] as const;

interface HeaderProps {
  toggleSideNav?: () => void;
}

export function Header({ toggleSideNav }: HeaderProps) {
  const { session } = useAuth()
  const { language } = useI18n()
  const { toast } = useToast()
  const router = useRouter()
  const [userProfile, setUserInfo] = useState<any>(null)
  const [isAvatarDialogOpen, setIsAvatarDialogOpen] = useState(false)
  const [selectedAvatarSeed, setSelectedAvatarSeed] = useState('Kenta')

  useEffect(() => {
    const storedUserInfo = sessionStorage.getItem('userProfile')
    if (storedUserInfo) {
      setUserInfo(JSON.parse(storedUserInfo))
    }
  }, [])

  // 言語に応じた氏名の表示
  const getDisplayName = () => {
    if (!userProfile) return ''
    if (language === 'en') {
      return `${userProfile.first_name_en} ${userProfile.last_name_en}`.trim()
    } else {
      return `${userProfile.last_name} ${userProfile.first_name}`.trim()
    }
  }

  // 言語に応じた支店名の表示
  const getBranchName = () => {
    if (!userProfile) return ''
    return language === 'en' ? userProfile.branch_name_en : userProfile.branch_name_jp
  }

  const getSystemName = () => {
    return language === 'en' ? SYSTEM_NAME.en : SYSTEM_NAME.ja
  }

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      localStorage.clear()
      sessionStorage.clear()
      document.cookie.split(";").forEach((c) => {
        document.cookie = c
          .replace(/^ +/, "")
          .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/")
      })
      router.push("/auth/login")
      router.refresh()
    } catch (error) {
      console.error('Logout error:', error)
      toast({
        title: "ログアウトエラー",
        description: "ログアウトに失敗しました。",
        variant: "destructive",
      })
    }
  }

  const handleAvatarSelect = () => {
    setIsAvatarDialogOpen(true)
  }

  const handleAvatarChange = async (seed: string) => {
    setSelectedAvatarSeed(seed)
    setIsAvatarDialogOpen(false)
    toast({
      title: "アバターを更新しました",
      description: "新しいアバターが設定されました。",
    })
  }

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-[200] border-b bg-gradient-to-r from-blue-900 via-blue-600 to-blue-400 text-white">
        <div className="flex h-16 items-center px-4">
          <div className="flex flex-1 items-center justify-between">
            <div className="flex items-center space-x-2">
              <Building2 className="h-6 w-6 text-white" />
              <span className="text-lg font-semibold">{getSystemName()}</span>
            </div>

            <div className="flex items-center space-x-6">
              <Image
                alt="INTER Logo"
                width="100"
                height="32"
                className="h-8 w-auto"
                src="/inter-logo.png"
                style={{ color: 'transparent' }}
              />
              
              <div className="flex items-center space-x-4">
                <div className="flex flex-col items-end">
                  <div className="text-sm font-medium text-white">
                    {getDisplayName()}
                  </div>
                  <div className="text-xs text-blue-100">
                    {userProfile?.employee_id} - {getBranchName()}
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Avatar className="relative flex shrink-0 overflow-hidden rounded-full h-8 w-8 bg-white avatar-shake cursor-pointer">
                      <AvatarImage 
                        src={`https://api.dicebear.com/7.x/personas/svg?seed=${selectedAvatarSeed}`}
                        alt={getDisplayName()} 
                      />
                      <AvatarFallback>
                        {userProfile?.last_name[0]}
                      </AvatarFallback>
                    </Avatar>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-64 bg-white rounded-lg shadow-lg p-2 z-[300]" align="end" sideOffset={5}>
                    <div className="flex flex-col p-2 bg-blue-50 rounded-md mb-2">
                      <span className="text-sm font-medium text-gray-900">名前</span>
                      <span className="text-sm text-gray-600">{getDisplayName()}</span>
                      <span className="text-sm font-medium text-gray-900 mt-2">社員番号</span>
                      <span className="text-sm text-gray-600">{userProfile?.employee_id}</span>
                      <span className="text-sm font-medium text-gray-900 mt-2">部署</span>
                      <span className="text-sm text-gray-600">{getBranchName()}</span>
                    </div>
                    <DropdownMenuItem 
                      onClick={handleAvatarSelect}
                      className="flex items-center px-2 py-1.5 text-sm text-gray-700 hover:bg-blue-50 rounded-md"
                    >
                      <Settings className="mr-2 h-4 w-4" />
                      アイコン設定
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="my-1" />
                    <Button
                      onClick={handleLogout}
                      variant="ghost"
                      className="w-full justify-start px-2 py-1.5 text-sm text-red-600 hover:bg-red-50 hover:text-red-700 rounded-md"
                    >
                      ログアウト
                    </Button>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </div>
      </header>

      <Dialog open={isAvatarDialogOpen} onOpenChange={setIsAvatarDialogOpen}>
        <DialogContent className="fixed left-[50%] top-[50%] grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg sm:max-w-[600px] z-[400]">
          <div className="flex flex-col space-y-1.5 text-center sm:text-left">
            <DialogTitle className="text-lg font-semibold leading-none tracking-tight">
              アイコン設定
            </DialogTitle>
            <p className="text-sm text-muted-foreground">アイコンを選択</p>
          </div>
          <div className="grid grid-cols-4 gap-4 py-4">
            {AVATAR_OPTIONS.map((avatar) => (
              <button
                key={avatar.id}
                onClick={() => handleAvatarChange(avatar.seed)}
                className={`
                  inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium 
                  ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 
                  focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none 
                  disabled:opacity-50 border border-input bg-background hover:text-accent-foreground 
                  p-0 h-20 hover:bg-blue-50
                  ${selectedAvatarSeed === avatar.seed ? 'ring-2 ring-blue-500' : ''}
                `}
              >
                <span className="relative flex shrink-0 overflow-hidden rounded-full h-full w-full bg-white">
                  <img
                    className="aspect-square h-full w-full bg-white"
                    alt={`Avatar ${avatar.id.split('avatar')[1]}`}
                    src={`https://api.dicebear.com/7.x/personas/svg?seed=${avatar.seed}`}
                  />
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setIsAvatarDialogOpen(false)}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
        </DialogContent>
      </Dialog>
    </>
  )
} 