"use client"

import { useState, useEffect, useMemo } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card"
import {
  Clock,
  Calendar,
  Clock4,
  Bell,
  TrendingUp,
  Users,
  LogIn,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  ExternalLink
} from "lucide-react"
import { useI18n } from "@/lib/i18n/context"
import { format, parseISO, differenceInMinutes, addMonths, isToday } from "date-fns"
import { ja } from "date-fns/locale"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabaseClient"
import { useAuth } from "@/providers/AuthProvider"
import { CheckInModal } from './check-in-modal'
import { CheckOutModal } from './check-out-modal'
import { MonthlyReportModal } from './monthly-report-modal'
import { AttendanceHistoryModal } from './attendance-history-modal'
import { useToast } from "@/components/ui/use-toast"

// お知らせのデータ型定義
interface Notification {
  id: string
  title: string
  content: string
  publishDate: string
  expiryDate: string
  isPublished: boolean
}

// 勤怠記録の型定義
interface AttendanceRecord {
  id?: string
  header_id?: string  // 任意に変更（既存コードとの互換性のため）
  user_id?: string    // 任意に追加（既存コードとの互換性のため）
  date: string
  start_time: string | null
  end_time: string | null
  break_time?: number | null
  actual_working_hours?: number | null
  work_type_code?: string | null
  remarks?: string | null
}

// ヘッダーの型定義
interface AttendanceHeader {
  id: string
  user_id: string
  year: number
  month: number
  status: string
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
  const { session } = useAuth()
  const { toast } = useToast()
  const [userId, setUserId] = useState<string | null>(null)
  
  const [currentTime, setCurrentTime] = useState(new Date())
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null)
  const [isCheckingIn, setIsCheckingIn] = useState(false)
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(new Date())
  const [monthlyData, setMonthlyData] = useState<AttendanceRecord[]>([])
  const [isLoadingMonthly, setIsLoadingMonthly] = useState(false)
  const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false)
  const [isCheckOutModalOpen, setIsCheckOutModalOpen] = useState(false)
  const [isMonthlyReportModalOpen, setIsMonthlyReportModalOpen] = useState(false)
  const [isAttendanceHistoryModalOpen, setIsAttendanceHistoryModalOpen] = useState(false)
  const [todayAttendance, setTodayAttendance] = useState<any>(null)
  const [userProfile, setUserProfile] = useState<any>(null)

  // 今日の勤怠データを取得する関数
  const fetchTodayAttendance = async () => {
    if (!session?.user?.id) return;

    try {
      const response = await fetch(`/api/attendance/today?userId=${userProfile?.employee_id}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '勤怠データの取得に失敗しました');
      }

      const data = await response.json();
      setTodayAttendance(data);
    } catch (error) {
      console.error('勤怠データの取得中にエラーが発生:', error);
      toast({
        variant: "destructive",
        description: error instanceof Error ? error.message : '勤怠データの取得に失敗しました',
      });
    }
  };

  // コンポーネントマウント時に今日の勤怠データを取得
  useEffect(() => {
    fetchTodayAttendance()
  }, [])

  // セッションストレージからユーザー情報を取得
  useEffect(() => {
    const getUserFromSession = () => {
      if (typeof window !== 'undefined') {
        try {
          const userProfileStr = sessionStorage.getItem('userProfile')
          if (userProfileStr) {
            const userProfile = JSON.parse(userProfileStr)
            setUserId(userProfile.id)
            setUserProfile(userProfile)
          }
        } catch (e) {
          console.error('ユーザー情報の取得中にエラーが発生:', e)
        }
      }
    }

    getUserFromSession()
  }, [])

  // 時計を更新
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    
    return () => clearInterval(timer)
  }, [])
  
  // 今日の勤怠データを取得
  useEffect(() => {
    const fetchTodayRecord = async () => {
      if (!userId) return
      
      try {
        // 日付フォーマットを修正
        const today = format(new Date(), 'yyyy-MM-dd')
        console.log('検索する日付:', today)
        const currentYear = new Date().getFullYear()
        const currentMonth = new Date().getMonth() + 1

        // まずheaderを取得
        const { data: headerData, error: headerError } = await supabase
          .from('attendance_headers')
          .select('id')
          .eq('user_id', userId)
          .eq('year', currentYear)
          .eq('month', currentMonth)
          .single()

        if (headerError) {
          console.error('ヘッダー取得エラー:', headerError)
          return
        }

        console.log('取得したヘッダー:', headerData)

        // headerが存在する場合のみ、詳細データを取得
        if (headerData?.id) {
          const { data, error } = await supabase
            .from('attendance_details')
            .select('*')
            .eq('header_id', headerData.id)
            .eq('date', today)
            .maybeSingle()

          if (error) {
            console.error('詳細データ取得エラー:', error)
            return
          }

          console.log('取得した詳細データ:', data)
          setTodayRecord(data || null)
        } else {
          setTodayRecord(null)
        }
      } catch (error) {
        console.error('勤怠データ取得中にエラーが発生しました:', error)
      }
    }
    
    fetchTodayRecord()
  }, [userId])
  
  // 月間データの取得
  const fetchMonthlyData = async (targetMonth = selectedMonth) => {
    if (!userId) return

    try {
      setIsLoadingMonthly(true)
      const year = targetMonth.getFullYear()
      const month = targetMonth.getMonth() + 1
      
      // まずattendance_headersからヘッダーIDを取得
      const { data: headerData, error: headerError } = await supabase
        .from('attendance_headers')
        .select('id')
        .eq('user_id', userId)
        .eq('year', year)
        .eq('month', month)
        .single()
      
      if (headerError) {
        generateDummyData(year, month)
        return
      }
      
      if (!headerData?.id) {
        generateDummyData(year, month)
        return
      }
      
      // 次にattendance_detailsから日次データを取得
      const { data: detailsData, error: detailsError } = await supabase
        .from('attendance_details')
        .select('id, date, start_time, end_time, break_time, actual_working_hours, work_type_code, remarks')
        .eq('header_id', headerData.id)
        .order('date', { ascending: true })
      
      if (detailsError) {
        generateDummyData(year, month)
        return
      }
      
      if (!detailsData || detailsData.length === 0) {
        generateDummyData(year, month)
        return
      }
      
      processMonthlyData(detailsData, year, month)
    } catch (error) {
      console.error('データ取得中にエラーが発生:', error)
      generateDummyData(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1)
    } finally {
      setIsLoadingMonthly(false)
    }
  }
  
  // 取得したデータの処理
  const processMonthlyData = (detailsData: any[], year: number, month: number) => {
    if (!detailsData || detailsData.length === 0) {
      console.log('処理するデータがありません')
      setMonthlyData([])
      return
    }
    
    // 取得したデータのクリーニングと型変換
    const cleanedData = detailsData.map(record => {
      // PostgreSQLのnumeric型から数値型に変換
      let actualHours = null
      if (record.actual_working_hours !== null && record.actual_working_hours !== undefined) {
        try {
          let hourValue = 0
          
          if (typeof record.actual_working_hours === 'number') {
            hourValue = record.actual_working_hours
          } else if (typeof record.actual_working_hours === 'string') {
            hourValue = parseFloat(record.actual_working_hours)
          } else {
            hourValue = parseFloat(String(record.actual_working_hours))
          }
          
          actualHours = isNaN(hourValue) ? 0 : hourValue
        } catch (e) {
          console.error(`勤務時間の変換中にエラー発生: ${record.date}`, e)
          actualHours = 0
        }
      }
      
      return {
        ...record,
        actual_working_hours: actualHours
      }
    })
    
    console.log('データ変換完了:', cleanedData.length, '件')
    setMonthlyData(cleanedData)
  }
  
  // 開発用ダミーデータの生成
  const generateDummyData = (year: number, month: number) => {
    console.log('データが存在しません')
    // 開発環境でもダミーデータを生成せず、空の配列を設定
    setMonthlyData([])
  }
  
  // 月間データの取得（依存配列にuserIdを追加）
  useEffect(() => {
    if (userId) {
      fetchMonthlyData()
    }
  }, [userId, selectedMonth])
  
  // 出勤処理
  const handleCheckIn = async () => {
    if (!session?.user?.id || !userProfile) return;

    try {
      const response = await fetch('/api/attendance/today', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: session.user.id,
          branch: userProfile.branch_code,
          employee_id: userProfile.employee_id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '出勤の記録に失敗しました');
      }

      toast({
        description: "出勤を記録しました",
      });

      // モーダルを閉じる
      setIsCheckInModalOpen(false);
      
      // 勤怠データを再取得
      fetchTodayAttendance();
    } catch (error) {
      console.error('出勤記録中にエラーが発生:', error);
      toast({
        variant: "destructive",
        description: error instanceof Error ? error.message : '出勤の記録に失敗しました',
      });
    }
  };
  
  // 退勤処理
  const handleCheckOut = async (time: string) => {
    if (!userId) {
      console.error('ユーザーIDが設定されていません')
      return
    }

    try {
      const today = format(new Date(), 'yyyy-MM-dd')
      
      // セッションストレージからユーザー情報を取得
      const userProfileStr = sessionStorage.getItem('userProfile')
      if (!userProfileStr) {
        console.error('ユーザープロファイルが見つかりません')
        return
      }
      
      const userProfile = JSON.parse(userProfileStr)
      const { branch_code: branch, employee_id } = userProfile

      if (!branch) {
        console.error('所属支店が設定されていません')
        return
      }

      // 既存の出勤記録を確認
      const { data: existingRecord, error: fetchError } = await supabase
        .from('daily_attendances')
        .select('*')
        .eq('branch', branch)
        .eq('employee_id', employee_id)
        .eq('work_date', today)
        .single()

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('出勤記録の確認中にエラーが発生しました:', fetchError)
        return
      }

      if (!existingRecord) {
        console.error('出勤記録が見つかりません')
        toast({
          title: "エラー",
          description: "先に出勤を記録してください。",
          variant: "destructive",
          duration: 3000,
        })
        return
      }

      // 既存の出勤記録を更新して退勤時間を記録
      const { error: updateError } = await supabase
        .from('daily_attendances')
        .update({
          check_out: time,
          working_hours: calculateWorkingHours(existingRecord.check_in, time),
          overtime_hours: calculateOvertimeHours(existingRecord.check_in, time),
          updated_at: new Date().toISOString(),
          updated_by: userId
        })
        .eq('id', existingRecord.id)

      if (updateError) {
        console.error('退勤時刻の更新に失敗しました:', updateError)
        return
      }

      // 出勤記録を再取得
      await fetchTodayAttendance()

      // 成功メッセージを表示
      toast({
        title: "成功",
        description: "退勤時刻を記録しました。",
        duration: 3000,
        variant: "default",
      })

    } catch (error) {
      console.error('退勤時刻の登録に失敗しました:', error)
      toast({
        title: "エラー",
        description: "退勤時刻の登録に失敗しました。",
        variant: "destructive",
        duration: 3000,
      })
    }
  }
  
  // 勤務時間の計算（時間単位）
  const calculateWorkingHours = (checkIn: string, checkOut: string): number => {
    try {
      if (!checkIn || !checkOut) return 0
      
      const [checkInHours, checkInMinutes] = checkIn.split(':').map(Number)
      const [checkOutHours, checkOutMinutes] = checkOut.split(':').map(Number)
      
      let minutes = (checkOutHours * 60 + checkOutMinutes) - (checkInHours * 60 + checkInMinutes)
      
      // 休憩時間（1時間）を引く
      if (minutes > 60) {
        minutes -= 60
      }
      
      // 時間に変換（小数点第2位まで）
      const hours = Math.max(0, minutes / 60)
      return Math.round(hours * 100) / 100
    } catch (error) {
      console.error('勤務時間の計算中にエラーが発生しました:', error)
      return 0
    }
  }

  // 残業時間の計算（8時間を超える部分）
  const calculateOvertimeHours = (checkIn: string, checkOut: string): number => {
    const workingHours = calculateWorkingHours(checkIn, checkOut)
    return Math.max(0, workingHours - 8)
  }
  
  // 前月・翌月の切り替え処理を修正
  const goToPreviousMonth = () => {
    if (!userId) return
    const newMonth = addMonths(selectedMonth, -1)
    setSelectedMonth(newMonth)
    fetchMonthlyData(newMonth)
  }
  
  const goToNextMonth = () => {
    if (!userId) return
    const newMonth = addMonths(selectedMonth, 1)
    setSelectedMonth(newMonth)
    fetchMonthlyData(newMonth)
  }
  
  // 月間データからグラフ用のデータを生成
  const monthlyChartData = useMemo(() => {
    // 月の日数を取得
    const year = selectedMonth.getFullYear()
    const month = selectedMonth.getMonth() + 1
    const daysInMonth = new Date(year, month, 0).getDate()
    
    // 各日付のデータを初期化
    const dailyData = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1
      return {
        day,
        date: `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`,
        actualHours: 0
      }
    })
    
    // 勤怠データを日付ごとにマッピング
    monthlyData.forEach(record => {
      if (!record.date) return
      
      try {
        const recordDate = new Date(record.date)
        const day = recordDate.getDate()
        
        if (day >= 1 && day <= daysInMonth) {
          const actualHours = Number(record.actual_working_hours)
          if (!isNaN(actualHours)) {
            dailyData[day - 1].actualHours = actualHours
          }
        }
      } catch (e) {
        console.error(`日付処理中にエラーが発生しました - ${record.date}:`, e)
      }
    })
    
    return dailyData
  }, [monthlyData, selectedMonth])
  
  // 勤務時間の合計を計算
  const totalHours = useMemo(() => {
    return monthlyData.reduce((sum, record) => {
      let hours = 0
      
      if (record.actual_working_hours !== null && record.actual_working_hours !== undefined) {
        // 型に応じた処理
        if (typeof record.actual_working_hours === 'number') {
          hours = record.actual_working_hours
        } else if (typeof record.actual_working_hours === 'string') {
          hours = parseFloat(record.actual_working_hours)
        } else {
          // その他のケース
          const hourStr = String(record.actual_working_hours)
          hours = parseFloat(hourStr)
        }
        
        // NaNチェック
        if (isNaN(hours)) {
          hours = 0
        }
      }
      
      return sum + hours
    }, 0)
  }, [monthlyData])

  // 残業時間の計算（メモ化）
  const overtimeHours = useMemo(() => {
    return monthlyData.reduce((sum, record) => {
      const hours = Number(record.actual_working_hours) || 0
      return sum + Math.max(0, hours - 8)
    }, 0)
  }, [monthlyData])

  // 公開中のお知らせのみをフィルタリング
  const publishedNotifications = notifications.filter(notification => notification.isPublished)

  return (
    <>
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

        <div className="grid gap-4 md:grid-cols-3">
          {/* お知らせセクション */}
          <Card className="md:col-span-1 h-full flex flex-col">
            <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
                <Bell className="h-6 w-6 text-blue-600" />
                <CardTitle className="text-xl">{t("notifications")}</CardTitle>
            </div>
          </CardHeader>
            <CardContent className="flex-grow overflow-hidden">
              <ScrollArea className="h-full max-h-[calc(100vh-250px)] pr-4">
              <div className="space-y-4">
                {publishedNotifications.map(notification => (
                  <div key={notification.id} className="border-b pb-4">
                    <div className="flex justify-between items-center mb-2">
                        <p className="font-medium text-base">{notification.title}</p>
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

          {/* 右側カラム（今日の勤怠と月間レポート） */}
          <div className="md:col-span-2 flex flex-col gap-4">
            {/* 今日の勤怠 */}
            <Card className="flex flex-col">
              <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-600" />
                  <CardTitle className="text-xl">今日の勤怠</CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsAttendanceHistoryModalOpen(true)}
                    className="h-7 w-7 ml-1 hover:bg-blue-50"
                    title="出退勤履歴を表示"
                  >
                    <ExternalLink className="h-4 w-4 text-blue-600" />
                  </Button>
            </div>
          </CardHeader>
          <CardContent>
                <div className="flex flex-col">
                  {/* 現在時刻表示、出勤時間、退勤時間を縦に並べる */}
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    {/* 現在時刻表示 */}
                    <div className="bg-gray-50 rounded-lg p-3 flex flex-col h-24 justify-between">
                      <div className="text-sm text-muted-foreground font-medium text-center">現在時刻 (JST)</div>
                      <div className="flex flex-col items-center">
                        <div className="text-2xl font-bold text-blue-700">
                          {format(currentTime, 'HH:mm:ss')}
                        </div>
                        <div className="text-sm font-medium">
                          {format(currentTime, 'yyyy年M月d日 EEEE', { locale: ja })}
                        </div>
                      </div>
                    </div>
                    
                    {/* 出勤時間 */}
                    <div className="bg-blue-50 rounded-lg p-3 flex flex-col h-24 justify-between">
                      <div className="text-sm text-muted-foreground font-medium">出勤時間</div>
                      <div className="flex items-center justify-between">
                        <div className="text-xl font-bold">
                          {todayAttendance?.check_in ? format(parseISO(`2000-01-01T${todayAttendance.check_in}`), 'HH:mm') : '--:--'}
                        </div>
                        <Button 
                          onClick={() => setIsCheckInModalOpen(true)}
                          className="bg-blue-600 hover:bg-blue-700 text-white h-8 w-24 text-sm"
                          disabled={!!todayAttendance?.check_in}
                        >
                          <LogIn className="h-4 w-4 mr-1" />
                          出勤
                        </Button>
                      </div>
                    </div>
                    
                    {/* 退勤時間 */}
                    <div className="bg-amber-50 rounded-lg p-3 flex flex-col h-24 justify-between">
                      <div className="text-sm text-muted-foreground font-medium">退勤時間</div>
                      <div className="flex items-center justify-between">
                        <div className="text-xl font-bold">
                          {todayAttendance?.check_out ? format(parseISO(`2000-01-01T${todayAttendance.check_out}`), 'HH:mm') : '--:--'}
                        </div>
                        <Button 
                          className="bg-amber-500 hover:bg-amber-600 text-white h-8 w-24 text-sm"
                          onClick={() => setIsCheckOutModalOpen(true)}
                          disabled={!todayAttendance?.check_in || !!todayAttendance?.check_out}
                        >
                          <LogOut className="h-4 w-4 mr-1" />
                          退勤
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  {/* 休暇状況セクション */}
                  <div className="border-t pt-3 mt-2">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="h-4 w-4 text-green-600" />
                      <div className="font-semibold text-md">休暇状況</div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="flex flex-col">
                        <div className="text-sm text-muted-foreground mb-1">有休残日数</div>
                        <div className="text-xl font-bold text-green-600">12.5日</div>
                      </div>
                      <div className="flex flex-col">
                        <div className="text-sm text-muted-foreground mb-1">今年度休暇実績</div>
                        <div className="text-xl font-bold">7.5日</div>
                      </div>
                      <div className="flex flex-col justify-end">
                        <Button 
                          className="bg-green-600 hover:bg-green-700 text-white h-10 w-auto px-3 text-sm ml-auto"
                          style={{ width: '50%' }}
                        >
                          <Calendar className="h-4 w-4 mr-1" />
                          休暇申請
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 月間レポート */}
            <Card className="flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-6 w-6 text-blue-600" />
                    <CardTitle className="text-xl">月間レポート</CardTitle>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsMonthlyReportModalOpen(true)}
                      className="h-7 w-7 ml-1 hover:bg-blue-50"
                      title="月間レポートを拡大表示"
                    >
                      <Maximize2 className="h-4 w-4 text-blue-600" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={goToPreviousMonth}
                      className="h-8 w-8"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="font-medium text-base">
                      {format(selectedMonth, 'yyyy年M月')}
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={goToNextMonth}
                      className="h-8 w-8"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
              </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <div className="text-sm text-blue-700 mb-1">勤務日数</div>
                      <div className="text-xl font-bold">{monthlyChartData.filter(day => day.actualHours > 0).length} 日</div>
                    </div>
                    <div className="p-3 bg-green-50 rounded-lg">
                      <div className="text-sm text-green-700 mb-1">総勤務時間</div>
                      <div className="text-xl font-bold">{totalHours.toFixed(1)} 時間</div>
                    </div>
                    <div className="p-3 bg-red-50 rounded-lg">
                      <div className="text-sm text-red-700 mb-1">残業時間</div>
                      <div className="text-xl font-bold">
                        {overtimeHours.toFixed(1)} 時間
                      </div>
                    </div>
                  </div>
                  
                  {/* 勤務時間グラフ */}
                  <div className="bg-gray-50 p-3 rounded-lg" style={{ height: '280px' }}>
                    {isLoadingMonthly ? (
                      <div className="flex items-center justify-center h-full">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700"></div>
                      </div>
                    ) : monthlyData.length > 0 && monthlyChartData.some(day => day.actualHours > 0) ? (
                      <div className="relative h-full">
                        {/* 凡例 */}
                        <div className="absolute right-0 top-0 flex items-center gap-3 text-xs z-10">
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 bg-blue-500"></div>
                            <span>通常勤務</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 bg-red-500"></div>
                            <span>残業時間</span>
                          </div>
                        </div>

                        {/* Y軸ラベル */}
                        <div className="absolute left-0 top-6 bottom-16 flex flex-col justify-between text-xs text-gray-500">
                          <div>12時間</div>
                          <div>6時間</div>
                          <div>0時間</div>
                        </div>

                        {/* グラフエリア */}
                        <div className="absolute left-12 right-2 top-6 bottom-16 border-l border-b border-gray-300">
                          {/* Y軸の目盛り線 */}
                          {Array.from({ length: 2 }, (_, i) => (
                            <div
                              key={i}
                              className="absolute left-0 right-0 h-px bg-gray-200"
                              style={{
                                bottom: `${((i + 1) * 6 / 12) * 100}%`,
                              }}
                            />
                          ))}

                          {/* グラフ本体 */}
                          <div className="absolute inset-0 flex items-end justify-between px-1">
                            {monthlyChartData.map((day, index) => (
                              <div 
                                key={index} 
                                className="relative flex-1 flex flex-col items-center justify-end h-full"
                                style={{ minWidth: '3px', maxWidth: '8px' }}
                              >
                                {/* 勤務時間バー */}
                                {day.actualHours > 0 && (
                                  <div 
                                    className="w-[80%] flex flex-col justify-end relative"
                                    style={{ 
                                      height: `${Math.min((day.actualHours / 12) * 100, 100)}%`,
                                    }}
                                    title={`${day.day}日: ${day.actualHours}時間`}
                                  >
                                    {/* 基本の青色バー（8時間まで） */}
                                    <div
                                      className="w-full bg-blue-500 absolute bottom-0"
                                      style={{
                                        height: `${Math.min((Math.min(day.actualHours, 8) / day.actualHours) * 100, 100)}%`,
                                        borderRadius: day.actualHours <= 8 ? '3px 3px 0 0' : '0'
                                      }}
                                    />
                                    {/* 超過分の赤色バー（8時間超過分） */}
                                    {day.actualHours > 8 && (
                                      <div
                                        className="w-full bg-red-500 absolute top-0 rounded-t"
                                        style={{
                                          height: `${((day.actualHours - 8) / day.actualHours) * 100}%`
                                        }}
                                      />
                                    )}
                                  </div>
                                )}

                                {/* X軸ラベル（日付は5日ごとに表示） */}
                                {day.day % 5 === 0 && (
                                  <div className="absolute text-[9px] text-gray-500 top-full mt-1">
                                    <span>{day.day}</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full text-sm text-gray-500">
                        勤務記録がありません
                      </div>
                    )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
      </div>

      <CheckInModal
        isOpen={isCheckInModalOpen}
        onClose={() => setIsCheckInModalOpen(false)}
        onConfirm={handleCheckIn}
      />
      
      <CheckOutModal
        isOpen={isCheckOutModalOpen}
        onClose={() => setIsCheckOutModalOpen(false)}
        onConfirm={handleCheckOut}
      />
      
      <MonthlyReportModal
        isOpen={isMonthlyReportModalOpen}
        onClose={() => setIsMonthlyReportModalOpen(false)}
        monthlyChartData={monthlyChartData}
        selectedMonth={selectedMonth}
        totalHours={totalHours}
        overtimeHours={overtimeHours}
        onPreviousMonth={goToPreviousMonth}
        onNextMonth={goToNextMonth}
      />
      
      <AttendanceHistoryModal
        isOpen={isAttendanceHistoryModalOpen}
        onClose={() => setIsAttendanceHistoryModalOpen(false)}
      />
    </>
  )
}