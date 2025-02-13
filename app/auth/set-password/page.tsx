"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { createClient } from "@supabase/supabase-js"
import type { Database } from '@/types/supabase'

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function SetPasswordPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      if (password !== confirmPassword) {
        throw new Error("パスワードが一致しません")
      }

      // パスワードを更新
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      })

      if (updateError) throw updateError

      // セッションを更新
      await supabase.auth.refreshSession()

      // ユーザーのステータスを更新
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { error: statusError } = await supabase
          .from('users')
          .update({
            registration_status: '03' as const
          } satisfies Partial<Database['public']['Tables']['users']['Update']>)
          .eq('id', user.id)

        if (statusError) throw statusError
      }

      toast({
        title: "成功",
        description: "パスワードを設定しました",
      })

      router.refresh()
      router.push("/dashboard")
    } catch (error) {
      console.error('Error setting password:', error)
      toast({
        title: "エラー",
        description: error instanceof Error ? error.message : "パスワードの設定に失敗しました",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex h-screen items-center justify-center">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle>パスワードの設定</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="新しいパスワード"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="パスワードの確認"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? "設定中..." : "パスワードを設定"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
} 