"use client"

import { useState } from "react"
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
import { LogOut, Settings } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useI18n } from "@/lib/i18n/context"
import Image from "next/image"

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

export function UserNav() {
  const { t } = useI18n()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedAvatar, setSelectedAvatar] = useState(avatarSamples[0].url)

  // Dummy user data
  const user = {
    id: "6096",
    name: "新間 健太",
    department: "NIS浜松"
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
        <div className="hidden md:block text-right">
          <p className="text-sm font-medium text-gray-200">{user.name}</p>
          <p className="text-xs text-gray-300">{user.id}</p>
          <p className="text-xs text-gray-300">{user.department}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              className="relative h-8 w-8 rounded-full hover:bg-white/10"
            >
              <Avatar className="h-8 w-8 bg-white avatar-shake">
                <AvatarImage src={selectedAvatar} alt={user.name} className="bg-white" />
                <AvatarFallback className="bg-white text-gray-900">
                  {user.name[0]}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64 z-[300]" align="end">
            <DropdownMenuLabel>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">{t("name-label")}</span>
                  <span className="text-sm font-medium">{user.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">{t("employee-id-label")}</span>
                  <span className="text-sm font-medium">{user.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">{t("department-label")}</span>
                  <span className="text-sm font-medium">{user.department}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setIsDialogOpen(true)}>
              <Settings className="mr-2 h-4 w-4" />
              <span>{t("avatar-settings")}</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <LogOut className="mr-2 h-4 w-4" />
              <span>{t("logout")}</span>
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