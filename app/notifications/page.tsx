"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Bell, Save, Plus, Trash2 } from "lucide-react"
import { useI18n } from "@/lib/i18n/context"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface Notification {
  id: string
  title: string
  content: string
  publishDate: string
  expiryDate: string
  isPublished: boolean
}

export default function NotificationsPage() {
  const { t } = useI18n()
  const [notifications, setNotifications] = useState<Notification[]>([
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
  ])
  const [editingNotifications, setEditingNotifications] = useState<Notification[]>([])
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [notificationToDelete, setNotificationToDelete] = useState<Notification | null>(null)

  const handleAddRow = () => {
    setEditingNotifications([
      ...editingNotifications,
      {
        id: Date.now().toString(),
        title: "",
        content: "",
        publishDate: "",
        expiryDate: "",
        isPublished: false,
      }
    ])
  }

  const handleRemoveRow = (id: string) => {
    setEditingNotifications(editingNotifications.filter(notification => notification.id !== id))
  }

  const handleDeleteNotification = (notification: Notification) => {
    setNotificationToDelete(notification)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    if (notificationToDelete) {
      setNotifications(notifications.filter(notification => notification.id !== notificationToDelete.id))
      setDeleteDialogOpen(false)
      setNotificationToDelete(null)
    }
  }

  const handleInputChange = (id: string, field: keyof Notification, value: string | boolean) => {
    setNotifications(notifications.map(notification => {
      if (notification.id === id) {
        return { ...notification, [field]: value }
      }
      return notification
    }))
    setEditingNotifications(editingNotifications.map(notification => {
      if (notification.id === id) {
        return { ...notification, [field]: value }
      }
      return notification
    }))
  }

  const handleSave = () => {
    console.log("Saving notifications:", [...notifications, ...editingNotifications])
    setNotifications([...notifications, ...editingNotifications])
    setEditingNotifications([])
  }

  const renderNotificationForm = (notification: Notification, isEditing: boolean = false) => {
    return (
      <div key={notification.id} className="space-y-4 p-4 border rounded-lg bg-white dark:bg-gray-950">
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1 space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">{t("notification-title")}</label>
              <Input
                value={notification.title}
                onChange={(e) => handleInputChange(notification.id, 'title', e.target.value)}
                placeholder={t("enter-notification-title")}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">{t("notification-content")}</label>
              <Textarea
                value={notification.content}
                onChange={(e) => handleInputChange(notification.id, 'content', e.target.value)}
                placeholder={t("enter-notification-content")}
                className="min-h-[200px]"
              />
            </div>
          </div>
          <div className="space-y-4 w-[200px]">
            <div>
              <label className="text-sm font-medium mb-2 block">{t("publish-date")}</label>
              <Input
                type="date"
                value={notification.publishDate}
                onChange={(e) => handleInputChange(notification.id, 'publishDate', e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">{t("expiry-date")}</label>
              <Input
                type="date"
                value={notification.expiryDate}
                onChange={(e) => handleInputChange(notification.id, 'expiryDate', e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id={`published-${notification.id}`}
                checked={notification.isPublished}
                onChange={(e) => handleInputChange(notification.id, 'isPublished', e.target.checked)}
                className="h-4 w-4"
              />
              <label
                htmlFor={`published-${notification.id}`}
                className="text-sm font-medium"
              >
                {t("published")}
              </label>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => isEditing ? handleRemoveRow(notification.id) : handleDeleteNotification(notification)}
              className="w-full text-red-500 hover:text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {t("delete")}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Bell className="h-8 w-8 text-blue-600" />
          {t("notifications-management")}
        </h1>
        <p className="text-muted-foreground">
          {t("notifications-management-description")}
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">{t("notification-list")}</h3>
              <div className="space-x-2">
                <Button onClick={handleAddRow} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  {t("add-row")}
                </Button>
                <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
                  <Save className="h-4 w-4 mr-2" />
                  {t("save")}
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              {notifications.map((notification) => renderNotificationForm(notification))}
              {editingNotifications.map((notification) => renderNotificationForm(notification, true))}
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("delete-notification")}</AlertDialogTitle>
            <AlertDialogDescription>
              {notificationToDelete && (
                <>
                  {t("notification-title")}: {notificationToDelete.title}<br />
                  {t("confirm-delete")}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}