"use client"

import { useState, useEffect } from "react"
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

  // 初期ロード時に認証状態をチェック
  useEffect(() => {
    const checkSession = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        router.push("/dashboard")
      }
    }
    checkSession()
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      // ログイン処理
      const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setError("メールアドレスかパスワードが間違っています。")
        return
      }

      // セッションの取得を確認
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError("セッションの取得に失敗しました")
        return
      }

      // セッションが確実に設定されるのを待つ
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // ダッシュボードへ遷移
      window.location.href = "/dashboard"

    } catch (error) {
      console.error('Login error:', error)
      setError("ログイン処理中にエラーが発生しました")
    } finally {
      setIsLoading(false)
    }
  }

  // 認証状態の変更を監視
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        router.push("/dashboard")
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [router])

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