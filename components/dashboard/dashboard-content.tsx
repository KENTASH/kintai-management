"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Clock,
  Calendar,
  Clock4,
  Bell,
  TrendingUp,
  Users,
} from "lucide-react"
import { useI18n } from "@/lib/i18n/context"
import { format } from "date-fns"
import { ScrollArea } from "@/components/ui/scroll-area"

// お知らせのデータ型定義
interface Notification {
  id: string
  title: string
  content: string
  publishDate: string
  expiryDate: string
  isPublished: boolean
}

// ダミーのお知らせデータ
const notifications: Notification[] = [
  {
    id: "1",
    title: "年末年始の休暇について",
    content: "12月29日から1月3日までは年末年始休暇となります。",
    publishDate: "2024-12-01",
    expiryDate: "2024-12-28",
    isPublished: true,
  },
  {
    id: "2",
    title: "健康診断の実施について",
    content: "今年度の健康診断を下記の日程で実施します。\n\n実施日：2024年1月15日〜19日\n場所：本社医務室\n\n受診時間は後日、個別に連絡します。",
    publishDate: "2024-12-20",
    expiryDate: "2024-01-19",
    isPublished: true,
  },
  {
    id: "3",
    title: "新人研修のお知らせ",
    content: "2024年度の新人研修を以下の日程で実施します。\n\n【研修概要】\n期間：2024年4月1日〜4月15日\n場所：本社研修室\n\n【研修内容】\n・会社概要説明\n・ビジネスマナー研修\n・技術研修\n・プロジェクト演習\n\n詳細なスケジュールは各部署の責任者に送付済みです。",
    publishDate: "2024-03-01",
    expiryDate: "2024-04-15",
    isPublished: true,
  }
]

export function DashboardContent() {
  const { t } = useI18n()

  // 公開中のお知らせのみをフィルタリング
  const publishedNotifications = notifications.filter(notification => notification.isPublished)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <TrendingUp className="h-8 w-8 text-blue-600" />
          {t("dashboard")}
        </h1>
        <p className="text-muted-foreground">
          {t("dashboard-description")}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("monthly-working-hours")}</CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">142.5{t("hours")}</div>
            <p className="text-xs text-muted-foreground">
              {t("target")}: 160{t("hours")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("remaining-paid-leave")}</CardTitle>
            <Calendar className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12{t("days")}</div>
            <p className="text-xs text-muted-foreground">
              {t("annual-grant")}: 20{t("days")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("monthly-overtime")}</CardTitle>
            <Clock4 className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">8.5{t("hours")}</div>
            <p className="text-xs text-muted-foreground">
              {t("limit")}: 45{t("hours")}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-blue-600" />
              <CardTitle>{t("notifications")}</CardTitle>
            </div>
            <CardDescription>{t("notifications-description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-4">
                {publishedNotifications.map(notification => (
                  <div key={notification.id} className="border-b pb-4">
                    <div className="flex justify-between items-center mb-2">
                      <p className="font-medium">{notification.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(notification.publishDate), 'yyyy/MM/dd')}
                      </p>
                    </div>
                    <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                      {notification.content}
                    </p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              <CardTitle>{t("team-status")}</CardTitle>
            </div>
            <CardDescription>{t("team-status-description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b pb-2">
                <div>
                  <p className="font-medium">{t("member-name-1")}</p>
                  <p className="text-sm text-muted-foreground">{t("working")}</p>
                </div>
                <div className="text-sm text-green-600">9:00 {t("checked-in")}</div>
              </div>
              <div className="flex justify-between items-center border-b pb-2">
                <div>
                  <p className="font-medium">{t("member-name-2")}</p>
                  <p className="text-sm text-muted-foreground">{t("on-leave")}</p>
                </div>
                <div className="text-sm text-blue-600">{t("paid-leave")}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}