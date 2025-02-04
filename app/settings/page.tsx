"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Moon, Sun, Languages, Save } from "lucide-react"
import { useI18n, TranslationKeys } from "@/lib/i18n/context"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useState } from "react"

const userFormSchema = z.object({
  lastNameEn: z.string().min(1, {
    message: "required-last-name-en"
  }),
  firstNameEn: z.string().min(1, {
    message: "required-first-name-en"
  }),
  department: z.string().min(1, {
    message: "required-department"
  }),
})

const defaultValues = {
  employeeId: "6096",
  lastName: "新間",
  firstName: "健太",
  lastNameEn: "Shinma",
  firstNameEn: "Kenta",
  email: "kenta.shinma@example.com",
  department: "NIS浜松",
}

const departments = [
  "NIS浜松", "NIS名古屋", "NIS大阪", "NIS東京",
  "GRS大阪", "GRS名古屋", "GRS東京", "NAL名古屋",
]

// エラーメッセージをTranslationKeysにマッピングする関数
const getErrorMessageKey = (message: string | undefined): TranslationKeys => {
  switch (message) {
    case "姓（英語）は必須です":
    case "Last name (English) is required":
      return "last-name-en-required";
    case "名（英語）は必須です":
    case "First name (English) is required":
      return "first-name-en-required";
    case "所属を選択してください":
    case "Please select your department":
      return "department-required";
    default:
      return "required-field" as TranslationKeys;
  }
};

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const { language, setLanguage, t } = useI18n()
  const [selectedAvatar, setSelectedAvatar] = useState("https://api.dicebear.com/7.x/personas/svg?seed=Kenta")
  
  const form = useForm<z.infer<typeof userFormSchema>>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      lastNameEn: defaultValues.lastNameEn,
      firstNameEn: defaultValues.firstNameEn,
      department: defaultValues.department,
    },
  })

  function onSubmit(values: z.infer<typeof userFormSchema>) {
    console.log(values)
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          {t("settings")}
        </h1>
        <p className="text-muted-foreground">
          {t("settings-description")}
        </p>
      </div>

      <div className="grid gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>{t("theme-settings")}</CardTitle>
              <CardDescription>
                {t("theme-settings-description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Sun className="h-4 w-4" />
                  <span>{t("light-mode")}</span>
                </div>
                <Switch
                  checked={theme === "dark"}
                  onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                />
                <div className="flex items-center space-x-2">
                  <Moon className="h-4 w-4" />
                  <span>{t("dark-mode")}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle>{t("language-settings")}</CardTitle>
              <CardDescription>
                {t("language-settings-description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Languages className="h-4 w-4" />
                  <span>日本語</span>
                </div>
                <Switch
                  checked={language === "en"}
                  onCheckedChange={(checked) => setLanguage(checked ? "en" : "ja")}
                />
                <div className="flex items-center space-x-2">
                  <Languages className="h-4 w-4" />
                  <span>English</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-start justify-between">
            <div>
              <CardTitle>{t("user-info")}</CardTitle>
              <CardDescription>
                {t("user-info-description")}
              </CardDescription>
            </div>
            <Avatar className="h-20 w-20 avatar-shake">
              <AvatarImage src={selectedAvatar} alt="User avatar" className="bg-white" />
              <AvatarFallback className="text-2xl">
                {defaultValues.lastName[0]}
              </AvatarFallback>
            </Avatar>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-4">
                  <div className="flex gap-4 items-center">
                    <FormLabel className="w-24">{t("employee-id")}</FormLabel>
                    <Input value={defaultValues.employeeId} disabled className="max-w-[240px]" />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-4">
                      <div className="flex gap-4 items-center">
                        <FormLabel className="w-24">{t("last-name")}</FormLabel>
                        <Input 
                          value={defaultValues.lastName}
                          disabled
                          className="flex-1"
                        />
                      </div>

                      <div className="flex gap-4 items-center">
                        <FormLabel className="w-24">{t("first-name")}</FormLabel>
                        <Input 
                          value={defaultValues.firstName}
                          disabled
                          className="flex-1"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="lastNameEn"
                        render={({ field }) => (
                          <FormItem className="flex gap-4 items-center">
                            <FormLabel className="w-24">{t("last-name-en")}</FormLabel>
                            <div className="flex-1">
                              <FormControl>
                                <Input {...field} placeholder="e.g., Shinma" />
                              </FormControl>
                              <FormMessage>
                                {form.formState.errors.lastNameEn?.message ? 
                                  t(getErrorMessageKey(form.formState.errors.lastNameEn.message)) 
                                  : ""}
                              </FormMessage>
                            </div>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="firstNameEn"
                        render={({ field }) => (
                          <FormItem className="flex gap-4 items-center">
                            <FormLabel className="w-24">{t("first-name-en")}</FormLabel>
                            <div className="flex-1">
                              <FormControl>
                                <Input {...field} placeholder="e.g., Kenta" />
                              </FormControl>
                              <FormMessage>
                                {form.formState.errors.firstNameEn?.message ? 
                                  t(getErrorMessageKey(form.formState.errors.firstNameEn.message)) 
                                  : ""}
                              </FormMessage>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="flex gap-4 items-center">
                    <FormLabel className="w-24">{t("email")}</FormLabel>
                    <Input 
                      value={defaultValues.email}
                      type="email"
                      disabled
                      className="flex-1"
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="department"
                    render={({ field }) => (
                      <FormItem className="flex gap-4 items-center">
                        <FormLabel className="w-24">{t("department")}</FormLabel>
                        <div className="flex-1">
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t("select-department")} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {departments.map((dept) => (
                                <SelectItem key={dept} value={dept}>
                                  {dept}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage>
                            {form.formState.errors.department?.message ? 
                              t(getErrorMessageKey(form.formState.errors.department.message)) 
                              : ""}
                          </FormMessage>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end">
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                    <Save className="h-4 w-4 mr-2" />
                    {t("save")}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}