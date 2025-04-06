'use client'

import { useState, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { ja } from 'date-fns/locale'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { X, Calendar, Clock } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { supabase } from '@/lib/supabaseClient'

interface AttendanceHistoryModalProps {
  isOpen: boolean
  onClose: () => void
}

interface AttendanceRecord {
  id: string
  branch: string
  employee_id: string
  work_date: string
  check_in: string | null
  check_out: string | null
  working_hours: number | null
  overtime_hours: number | null
}

export function AttendanceHistoryModal({ isOpen, onClose }: AttendanceHistoryModalProps) {
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      fetchAttendanceHistory()
    }
  }, [isOpen])

  const fetchAttendanceHistory = async () => {
    setIsLoading(true)

    try {
      // セッションストレージからユーザー情報を取得
      const userProfileStr = sessionStorage.getItem('userProfile')
      if (!userProfileStr) {
        console.error('ユーザープロファイルが見つかりません')
        setIsLoading(false)
        return
      }
      
      const userProfile = JSON.parse(userProfileStr)
      const { branch_code: branch, employee_id } = userProfile

      // 直近30日間の出退勤記録を取得
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      
      const { data, error } = await supabase
        .from('daily_attendances')
        .select('*')
        .eq('branch', branch)
        .eq('employee_id', employee_id)
        .gte('work_date', format(thirtyDaysAgo, 'yyyy-MM-dd'))
        .order('work_date', { ascending: false })

      if (error) {
        console.error('出退勤履歴の取得に失敗しました:', error)
        setAttendanceRecords([])
      } else {
        setAttendanceRecords(data || [])
      }
    } catch (error) {
      console.error('出退勤履歴の取得中にエラーが発生しました:', error)
      setAttendanceRecords([])
    } finally {
      setIsLoading(false)
    }
  }

  // 日本語の曜日名を取得する関数
  const getJapaneseDayOfWeek = (dateStr: string) => {
    const date = new Date(dateStr)
    return format(date, 'EEE', { locale: ja })
  }

  // 日付の書式を変換する関数
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return format(date, 'M月d日', { locale: ja })
  }

  // 時間の書式を変換する関数
  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return '--:--'
    return timeStr.substring(0, 5) // "08:30:00" → "08:30"
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] p-0 max-h-[80vh]">
        <div className="relative">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="p-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-600" />
                出退勤履歴
              </DialogTitle>
              <DialogDescription>
                過去30日間の出退勤記録を表示しています
              </DialogDescription>
            </DialogHeader>
            
            <div className="mt-6">
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700"></div>
                </div>
              ) : attendanceRecords.length > 0 ? (
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-1">
                    <div className="grid grid-cols-4 gap-2 text-sm font-medium text-muted-foreground py-2 border-b">
                      <div>日付</div>
                      <div>曜日</div>
                      <div>出勤</div>
                      <div>退勤</div>
                    </div>
                    {attendanceRecords.map((record) => (
                      <div 
                        key={record.id} 
                        className="grid grid-cols-4 gap-2 py-3 text-sm border-b last:border-b-0"
                      >
                        <div className="font-medium">{formatDate(record.work_date)}</div>
                        <div 
                          className={`${
                            getJapaneseDayOfWeek(record.work_date) === '土' 
                              ? 'text-blue-600' 
                              : getJapaneseDayOfWeek(record.work_date) === '日' 
                                ? 'text-red-600' 
                                : ''
                          }`}
                        >
                          {getJapaneseDayOfWeek(record.work_date)}
                        </div>
                        <div>{formatTime(record.check_in)}</div>
                        <div>{formatTime(record.check_out)}</div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  表示できる出退勤記録がありません
                </div>
              )}
            </div>
            
            <div className="flex justify-end mt-6">
              <Button
                onClick={onClose}
                className="bg-white text-blue-600 hover:bg-gray-100 border border-blue-600"
              >
                閉じる
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
} 