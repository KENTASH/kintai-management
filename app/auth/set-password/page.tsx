"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8F9FE]">
      <div className="flex items-center gap-2 mb-8">
        <img src="@logo.png" alt="" className="h-5 w-5" />
        <span className="text-[#4361ee] text-lg font-medium">勤怠管理システム</span>
      </div>
      <Card className="w-[400px] rounded-3xl shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
        <CardHeader className="bg-[#F8F9FE]/40 rounded-t-3xl border-b-0 pb-4 px-6 pt-5">
          <CardTitle className="text-[17px] font-medium text-[#4361ee]">パスワードの設定</CardTitle>
          <CardDescription className="text-[13px] text-[#6b7280] mt-0.5">
            初回ログイン用のパスワードを設定してください。
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div>
            <div className="text-[13px] font-medium text-[#1a1a1a] mb-1.5">新しいパスワード</div>
            <Input
              type="password"
              placeholder="8文字以上の英数字"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border-[#e5e7eb] focus:border-[#4361ee] focus:ring-[#4361ee] h-11 text-[13px] placeholder:text-[#9ca3af]"
            />
          </div>
          <div>
            <div className="text-[13px] font-medium text-[#1a1a1a] mb-1.5">パスワードの確認</div>
            <Input
              type="password"
              placeholder="パスワードを再入力"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="rounded-lg border-[#e5e7eb] focus:border-[#4361ee] focus:ring-[#4361ee] h-11 text-[13px] placeholder:text-[#9ca3af]"
            />
          </div>
          <div className="bg-[#F8F9FE]/60 rounded-lg p-4 space-y-1">
            <div className="text-[13px] font-medium text-[#4361ee] mb-2">パスワードの要件：</div>
            <ul className="space-y-1.5 text-[13px] text-[#6b7280]">
              <li>• 8文字以上</li>
              <li>• 大文字を含む</li>
              <li>• 小文字を含む</li>
              <li>• 数字を含む</li>
              <li>• 特殊文字(@#$%^&*)を含む</li>
            </ul>
          </div>
          <Button 
            type="submit"
            onClick={handleSubmit}
            className="w-full bg-[#4361ee] hover:bg-[#3a51d4] rounded-lg h-11 text-[15px] font-medium mt-2" 
            disabled={isLoading}
          >
            {isLoading ? "設定中..." : "パスワードを設定"}
          </Button>
        </CardContent>
      </Card>
      <div className="mt-8 text-sm text-[#6b7280]">
        © NISZ HAMAMATSU 2025
      </div>
    </div>
  )
} 