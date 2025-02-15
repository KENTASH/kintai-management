"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/lib/i18n/context"
import { LogIn, Eye, EyeOff } from "lucide-react"
import { supabase } from '@/lib/supabaseClient'
import { useToast } from "@/components/ui/use-toast"

export default function LoginPage() {
  const router = useRouter()
  const { t } = useI18n()
  const { toast } = useToast()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setError("メールアドレスかパスワードが間違っています。")
        setIsLoading(false)
        return
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError("セッションの取得に失敗しました")
        setIsLoading(false)
        return
      }

      const { data: profile } = await supabase
        .from('users')
        .select('registration_status')
        .eq('auth_id', session.user.id)
        .single()

      toast({
        title: "ログイン成功",
        description: "ダッシュボードに移動します",
      })

      router.refresh()

      if (profile?.registration_status === '01') {
        router.push("/set-password")
      } else {
        router.push("/dashboard")
      }
    } catch (error) {
      console.error('Login error:', error)
      setError("メールアドレスかパスワードが間違っています。")
      setIsLoading(false)
    }
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle>{t("login-title")}</CardTitle>
          <CardDescription>{t("login-description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                type="email"
                placeholder={t("email-placeholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder={t("password-placeholder")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {error && (
              <div className="text-sm text-red-500">
                {error}
              </div>
            )}
            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700"
              disabled={isLoading}
            >
              <LogIn className="mr-2 h-4 w-4" />
              {isLoading ? "ログイン中..." : "ログイン"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}