"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/lib/i18n/context"
import { LogIn } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const { t } = useI18n()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    if (email === "test@example.com" && password === "password123") {
      try {
        document.cookie = "auth=true; path=/"
        setTimeout(() => {
          router.push("/dashboard")
        }, 1000)
      } catch (error) {
        setError(t("login-failed"))
        setIsLoading(false)
      }
    } else {
      setError(t("login-error"))
      setIsLoading(false)
    }
  }

  return (
    <div className="flex h-screen items-center justify-center">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle>{t("login-title")}</CardTitle>
          <CardDescription>{t("login-description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="email"
                placeholder={t("email-placeholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Input
                type="password"
                placeholder={t("password-placeholder")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
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
              {isLoading ? t("logging-in") : t("login")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}