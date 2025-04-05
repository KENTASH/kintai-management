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
} from "lucide-react"
import { useI18n } from "@/lib/i18n/context"
import { format, parseISO, differenceInMinutes, addMonths, isToday } from "date-fns"
import { ja } from "date-fns/locale"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabaseClient"
import { useAuth } from "@/providers/AuthProvider"

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
  const userId = session?.user?.id
  
  const [currentTime, setCurrentTime] = useState(new Date())
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null)
  const [isCheckingIn, setIsCheckingIn] = useState(false)
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(new Date())
  const [monthlyData, setMonthlyData] = useState<AttendanceRecord[]>([])
  const [isLoadingMonthly, setIsLoadingMonthly] = useState(false)

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
        const today = format(new Date(), 'yyyy-MM-dd')
        
        const { data, error } = await supabase
          .from('attendance_details')
          .select('*')
          .eq('user_id', userId)
          .eq('date', today)
          .single()
          
        if (error && error.code !== 'PGRST116') {
          console.error('今日の勤怠データ取得エラー:', error)
          return
        }
        
        setTodayRecord(data || null)
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
      
      console.log(`${year}年${month}月のデータを取得します - ユーザーID: ${userId}`)
      
      // Supabaseに接続テストを実行
      const { data: connTest, error: connError } = await supabase
        .from('users')
        .select('id')
        .limit(1)
      
      if (connError) {
        console.error('Supabase接続テスト失敗:', connError)
      } else {
        console.log('Supabase接続テスト成功')
      }
      
      // まずattendance_headersからヘッダーIDを取得
      const { data: headerData, error: headerError } = await supabase
        .from('attendance_headers')
        .select('id')
        .eq('user_id', userId)
        .eq('year', year)
        .eq('month', month)
        .single()
      
      if (headerError && headerError.code !== 'PGRST116') {
        console.error('月間勤怠ヘッダ取得エラー:', headerError)
        console.log('attendance_headersからのデータ取得に失敗したため、attendance_detailsから直接取得を試みます')
        await fetchMonthlyDataByDateRange(year, month)
        return
      }
      
      if (!headerData?.id) {
        console.log(`${year}年${month}月のヘッダーレコードが見つかりません`)
        console.log('attendance_detailsから直接取得を試みます')
        await fetchMonthlyDataByDateRange(year, month)
        return
      }
      
      const headerId = headerData.id
      console.log(`ヘッダーID取得成功: ${headerId}`)
      
      // 次にattendance_detailsから日ごとのデータを取得
      const { data: detailsData, error: detailsError } = await supabase
        .from('attendance_details')
        .select('id, date, start_time, end_time, break_time, actual_working_hours, work_type_code, remarks')
        .eq('header_id', headerId)
        .order('date', { ascending: true })
      
      if (detailsError) {
        console.error('月間勤怠詳細取得エラー:', detailsError)
        console.log('header_idによる取得に失敗したため、日付範囲による取得を試みます')
        await fetchMonthlyDataByDateRange(year, month)
        return
      }
      
      console.log('取得したデータ数:', detailsData?.length || 0)
      
      // データがなければ日付範囲による取得を試みる
      if (!detailsData || detailsData.length === 0) {
        console.log('header_idで取得したデータが0件のため、日付範囲による取得を試みます')
        await fetchMonthlyDataByDateRange(year, month)
        return
      }
      
      processMonthlyData(detailsData, year, month)
    } catch (error) {
      console.error('月間データ取得中にエラーが発生しました:', error)
      // エラーの場合は日付範囲による取得を試みる
      const year = targetMonth.getFullYear()
      const month = targetMonth.getMonth() + 1
      await fetchMonthlyDataByDateRange(year, month)
    } finally {
      setIsLoadingMonthly(false)
    }
  }
  
  // 日付範囲でattendance_detailsから直接データを取得
  const fetchMonthlyDataByDateRange = async (year: number, month: number) => {
    if (!userId) return
    
    try {
      console.log('日付範囲でattendance_detailsから直接データを取得します')
      
      // 日付範囲を計算
      const startDate = `${year}-${month.toString().padStart(2, '0')}-01`
      const lastDay = new Date(year, month, 0).getDate()
      const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay}`
      
      console.log(`検索期間: ${startDate} 〜 ${endDate}`)
      console.log(`検索条件: ユーザーID=${userId}、開始日=${startDate}、終了日=${endDate}`)
      
      // ヘッダーIDをまず取得
      const { data: headers, error: headerError } = await supabase
        .from('attendance_headers')
        .select('id')
        .eq('user_id', userId)
        .eq('year', year)
        .eq('month', month)
      
      if (headerError) {
        console.error('ヘッダー検索エラー:', headerError)
      } else {
        console.log(`取得したヘッダー数: ${headers?.length || 0}`)
        if (headers && headers.length > 0) {
          console.log('使用可能なヘッダーID:', headers.map(h => h.id))
          
          // ヘッダーIDでattendance_detailsを検索
          const headerIds = headers.map(h => h.id)
          
          for (const headerId of headerIds) {
            console.log(`ヘッダーID ${headerId} でデータ検索中...`)
            
            const { data: detailsData, error: detailsError } = await supabase
              .from('attendance_details')
              .select('id, date, start_time, end_time, break_time, actual_working_hours, work_type_code, remarks')
              .eq('header_id', headerId)
              .order('date', { ascending: true })
            
            if (detailsError) {
              console.error(`ヘッダーID ${headerId} による検索エラー:`, detailsError)
              continue
            }
            
            if (detailsData && detailsData.length > 0) {
              console.log(`ヘッダーID ${headerId} で ${detailsData.length} 件のデータを取得しました`)
              processMonthlyData(detailsData, year, month)
              return
            } else {
              console.log(`ヘッダーID ${headerId} ではデータが見つかりませんでした`)
            }
          }
          
          console.log('すべてのヘッダーIDで検索しましたが、データが見つかりませんでした')
        }
      }
      
      // 開発用のダミーデータを生成
      generateDummyData(year, month)
    } catch (error) {
      console.error('日付範囲でのデータ取得中にエラーが発生しました:', error)
      generateDummyData(year, month)
    }
  }
  
  // 取得したデータの処理
  const processMonthlyData = (detailsData: any[], year: number, month: number) => {
    if (!detailsData || detailsData.length === 0) {
      console.log('処理するデータがありません')
      setMonthlyData([])
      return
    }
    
    const sampleRecord = detailsData[0]
    console.log('処理するデータサンプル:', sampleRecord)
    console.log('データのプロパティ一覧:', Object.keys(sampleRecord))
    console.log('actual_working_hoursの型:', typeof sampleRecord.actual_working_hours)
    console.log('actual_working_hoursの値:', sampleRecord.actual_working_hours)
    
    // 取得したデータのクリーニングと型変換
    const cleanedData = detailsData.map((record, index) => {
      // PostgreSQLのnumeric型から数値型に変換
      let actualHours = null
      if (record.actual_working_hours !== null && record.actual_working_hours !== undefined) {
        try {
          // 確実にnumber型に変換
          let hourValue = 0;
          
          if (typeof record.actual_working_hours === 'number') {
            hourValue = record.actual_working_hours;
          } else if (typeof record.actual_working_hours === 'string') {
            hourValue = parseFloat(record.actual_working_hours);
          } else {
            // 他の型の場合（オブジェクト等）
            hourValue = parseFloat(String(record.actual_working_hours));
          }
          
          actualHours = isNaN(hourValue) ? 0 : hourValue;
          console.log(`レコード[${index}]: 日付=${record.date}, 変換後の勤務時間 = ${actualHours}`);
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
    
    console.log('変換後のデータ例:', cleanedData[0])
    console.log('最終的なデータ件数:', cleanedData.length)
    
    // データを状態に設定
    setMonthlyData(cleanedData)
  }
  
  // 開発用ダミーデータの生成
  const generateDummyData = (year: number, month: number) => {
    console.log('開発用ダミーデータを生成します')
    if (process.env.NODE_ENV === 'development') {
      // ダミーデータを生成
      const daysInMonth = new Date(year, month, 0).getDate()
      
      const dummyData: AttendanceRecord[] = Array.from({ length: 20 }, (_, i) => {
        const day = Math.floor(Math.random() * daysInMonth) + 1
        const hours = Math.floor(Math.random() * 5) + 5 // 5〜10時間
        
        return {
          id: `dummy-${i}`,
          date: `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`,
          start_time: '09:00:00',
          end_time: '18:00:00',
          break_time: 60,
          actual_working_hours: hours, // 数値型として設定
          work_type_code: '01', // 通常勤務
          remarks: ''
        }
      })
      
      console.log('生成したダミーデータ例:', dummyData[0])
      setMonthlyData(dummyData)
    } else {
      setMonthlyData([])
    }
  }
  
  // コンポーネントマウント時に月間データを取得
  useEffect(() => {
    fetchMonthlyData()
  }, [userId, selectedMonth])
  
  // 出勤処理
  const handleCheckIn = async () => {
    if (!userId || isCheckingIn) return
    
    try {
      setIsCheckingIn(true)
      const now = new Date()
      const today = format(now, 'yyyy-MM-dd')
      const timeNow = format(now, 'HH:mm:ss')
      
      // 既存レコードがあるか確認
      if (todayRecord?.id) {
        // 既に出勤済みの場合は処理をスキップ
        if (todayRecord.start_time) {
          console.log('既に出勤済みです')
          return
        }
        
        // 既存レコードを更新
        const { error } = await supabase
          .from('attendance_details')
          .update({ start_time: timeNow })
          .eq('id', todayRecord.id)
          
        if (error) throw error
        
        setTodayRecord({
          ...todayRecord,
          start_time: timeNow
        })
      } else {
        // 新規レコードを作成
        const newRecord = {
          user_id: userId,
          date: today,
          start_time: timeNow,
          end_time: null
        }
        
        const { data, error } = await supabase
          .from('attendance_details')
          .insert(newRecord)
          .select()
          
        if (error) throw error
        
        setTodayRecord(data?.[0] || null)
      }
    } catch (error) {
      console.error('出勤処理中にエラーが発生しました:', error)
    } finally {
      setIsCheckingIn(false)
    }
  }
  
  // 退勤処理
  const handleCheckOut = async () => {
    if (!userId || !todayRecord?.id || isCheckingOut) return
    
    try {
      setIsCheckingOut(true)
      const now = new Date()
      const timeNow = format(now, 'HH:mm:ss')
      
      // 既に退勤済みの場合は処理をスキップ
      if (todayRecord.end_time) {
        console.log('既に退勤済みです')
        return
      }
      
      // 実働時間を計算（分）
      let actualMinutes = 0
      if (todayRecord.start_time) {
        const startDate = parseISO(`${todayRecord.date}T${todayRecord.start_time}`)
        actualMinutes = differenceInMinutes(now, startDate)
        
        // 休憩時間（デフォルト60分）を引く
        const breakTimeMinutes = todayRecord.break_time || 60
        actualMinutes -= breakTimeMinutes
      }
      
      // 時間に変換（小数点第1位まで）
      const actualHours = Math.max(0, actualMinutes / 60)
      const roundedHours = Math.round(actualHours * 10) / 10
      
      // レコードを更新
      const { error } = await supabase
        .from('attendance_details')
        .update({
          end_time: timeNow,
          actual_working_hours: roundedHours,
          break_time: todayRecord.break_time || 60
        })
        .eq('id', todayRecord.id)
        
      if (error) throw error
      
      setTodayRecord({
        ...todayRecord,
        end_time: timeNow,
        actual_working_hours: roundedHours
      })
    } catch (error) {
      console.error('退勤処理中にエラーが発生しました:', error)
    } finally {
      setIsCheckingOut(false)
    }
  }
  
  // 前月・翌月の切り替え
  const goToPreviousMonth = () => {
    setSelectedMonth(prev => addMonths(prev, -1))
    // 明示的にデータ再取得をトリガー
    fetchMonthlyData(addMonths(selectedMonth, -1))
  }
  
  const goToNextMonth = () => {
    setSelectedMonth(prev => addMonths(prev, 1))
    // 明示的にデータ再取得をトリガー
    fetchMonthlyData(addMonths(selectedMonth, 1))
  }
  
  // 月間データからグラフ用のデータを生成
  const monthlyChartData = useMemo(() => {
    // 月の日数を取得
    const year = selectedMonth.getFullYear()
    const month = selectedMonth.getMonth() + 1
    const daysInMonth = new Date(year, month, 0).getDate()
    
    console.log('月間データの内容:', JSON.stringify(monthlyData).substring(0, 200) + '...')
    
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
    console.log('勤怠データをマッピングします、件数:', monthlyData.length)
    
    monthlyData.forEach((record, index) => {
      if (!record.date) {
        console.log(`レコード[${index}]: 日付がありません`)
        return
      }
      
      try {
        const recordDate = new Date(record.date)
        const day = recordDate.getDate()
        
        if (day >= 1 && day <= daysInMonth) {
          // actual_working_hoursが数値変換済みであることを想定
          if (record.actual_working_hours === null || record.actual_working_hours === undefined) {
            console.log(`レコード[${index}]: 勤務時間が未設定です - ${record.date}`)
            return
          }
          
          // 既に数値型になっているはずだが、念のためチェック
          const actualHours = Number(record.actual_working_hours)
          
          if (!isNaN(actualHours)) {
            console.log(`レコード[${index}]: 日付=${record.date}, 日=${day}, 勤務時間=${actualHours}`)
            dailyData[day - 1].actualHours = actualHours
          } else {
            console.error(`レコード[${index}]: 勤務時間が数値変換できません - ${record.date}, ${record.actual_working_hours}`)
          }
        }
      } catch (e) {
        console.error(`レコード[${index}]: 日付処理中にエラーが発生しました - ${record.date}:`, e)
      }
    })
    
    // データ確認
    const hasHours = dailyData.some(d => d.actualHours > 0)
    console.log('勤務時間が設定されているデータがあるか:', hasHours)
    
    if (!hasHours) {
      console.log('グラフデータに勤務時間が一つも設定されていません！')
    }
    
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

      <div className="grid gap-4 md:grid-cols-2">
        {/* お知らせセクション */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-blue-600" />
              <CardTitle>{t("notifications")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[320px] pr-4">
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

        {/* 今日の勤怠 */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              <CardTitle>今日の勤怠</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {/* 現在時刻表示、出勤時間、退勤時間を横一行に並べる */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              {/* 現在時刻表示 */}
              <div className="bg-white rounded-lg p-3 flex flex-col h-24 justify-between">
                <div className="text-sm text-muted-foreground font-medium text-center">現在時刻 (JST)</div>
                <div className="flex flex-col items-center">
                  <div className="text-3xl font-bold text-blue-700">
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
                    {todayRecord?.start_time ? todayRecord.start_time.substring(0, 5) : '--:--'}
                  </div>
                  <Button 
                    className="bg-blue-600 hover:bg-blue-700 text-white h-8 w-24"
                    onClick={handleCheckIn}
                    disabled={isCheckingIn || !!todayRecord?.start_time}
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
                    {todayRecord?.end_time ? todayRecord.end_time.substring(0, 5) : '--:--'}
                  </div>
                  <Button 
                    className="bg-amber-500 hover:bg-amber-600 text-white h-8 w-24"
                    onClick={handleCheckOut}
                    disabled={isCheckingOut || !todayRecord?.start_time || !!todayRecord?.end_time}
                  >
                    <LogOut className="h-4 w-4 mr-1" />
                    退勤
                  </Button>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              {/* 本日の勤務時間と残業時間を1つのカードにまとめる */}
              <div className="flex flex-col bg-gray-50 rounded-lg p-3 col-span-2">
                <div className="flex justify-around">
                  <div className="flex flex-col items-center">
                    <div className="text-sm text-muted-foreground mb-1 text-center">本日の勤務時間</div>
                    <div className="text-2xl font-bold text-center">
                      {todayRecord?.actual_working_hours 
                        ? `${todayRecord.actual_working_hours}時間` 
                        : '00:00'}
                    </div>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="text-sm text-muted-foreground mb-1 text-center">残業時間</div>
                    <div className="text-2xl font-bold text-red-500 text-center">
                      {todayRecord?.actual_working_hours 
                        ? `${Math.max(0, todayRecord.actual_working_hours - 8)}時間` 
                        : '00:00'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* 休暇状況セクション */}
            <div className="border-t pt-4 mt-2">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="h-4 w-4 text-green-600" />
                <div className="font-semibold">休暇状況</div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="flex flex-col">
                  <div className="text-sm text-muted-foreground mb-1">有休残日数</div>
                  <div className="text-2xl font-bold text-green-600">12.5日</div>
                </div>
                <div className="flex flex-col">
                  <div className="text-sm text-muted-foreground mb-1">今年度休暇実績</div>
                  <div className="text-2xl font-bold">7.5日</div>
                </div>
                <div className="flex flex-col justify-end">
                  <Button 
                    className="bg-green-600 hover:bg-green-700 text-white h-10 w-auto px-4"
                  >
                    <Calendar className="h-4 w-4 mr-1" />
                    休暇申請
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 月間レポート */}
        <Card>
          <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              <CardTitle>月間レポート</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={goToPreviousMonth}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="font-medium">
                {format(selectedMonth, 'yyyy年M月')}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={goToNextMonth}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="text-sm text-blue-700 mb-1">勤務日数</div>
                  <div className="text-2xl font-bold">{monthlyData.length} 日</div>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="text-sm text-green-700 mb-1">勤務時間</div>
                  <div className="text-2xl font-bold">{totalHours.toFixed(1)} 時間</div>
                </div>
              </div>
              
              {/* 勤務時間グラフ */}
              <div className="bg-gray-50 p-4 rounded-lg min-h-[300px]">
                {isLoadingMonthly ? (
                  <div className="flex items-center justify-center h-[300px]">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700"></div>
                  </div>
                ) : monthlyChartData.length > 0 ? (
                  <div className="relative h-[300px]">
                    {/* デバッグ情報（非表示） */}
                    <div className="hidden">
                      {monthlyChartData.length > 0 ? 'データあり' : 'データなし'}
                    </div>
                    
                    {/* 凡例 - 右上に配置 */}
                    <div className="absolute right-0 top-0 flex items-center gap-2 text-xs z-10">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-blue-500"></div>
                        <span>勤務時間</span>
                      </div>
                    </div>
                  
                    {/* X軸とY軸 */}
                    <div className="absolute left-10 top-0 bottom-10 w-px bg-gray-300"></div>
                    <div className="absolute left-10 right-0 bottom-10 h-px bg-gray-300"></div>
                    
                    {/* Y軸ラベル - 1時間刻み */}
                    <div className="absolute left-0 top-0 bottom-10 flex flex-col justify-between text-xs text-gray-500">
                      <div>10時間</div>
                      <div>9時間</div>
                      <div>8時間</div>
                      <div>7時間</div>
                      <div>6時間</div>
                      <div>5時間</div>
                      <div>4時間</div>
                      <div>3時間</div>
                      <div>2時間</div>
                      <div>1時間</div>
                      <div>0時間</div>
                    </div>
                    
                    {/* グラフ本体 */}
                    <div className="absolute left-12 right-2 top-4 bottom-12 flex items-end justify-between">
                      {monthlyChartData.map((day, index) => (
                        <div 
                          key={index} 
                          className="flex-1 flex flex-col items-center justify-end h-full"
                          style={{ minWidth: '4px', maxWidth: '12px' }}
                        >
                          {/* 勤務時間バー */}
                          <div 
                            className={`w-[80%] bg-blue-500 rounded-t`}
                            style={{ 
                              height: `${Math.max((day.actualHours / 10) * 100, day.actualHours > 0 ? 1 : 0)}%`,
                            }}
                            title={`${day.day}日: ${day.actualHours}時間`}
                          ></div>
                          
                          {/* X軸ラベル（すべての日を表示） */}
                          <div className="mt-1 text-[9px] text-gray-500 absolute bottom-[-38px] flex flex-col items-center">
                            <span>{day.day}</span>
                            <span>{format(new Date(day.date), 'E', { locale: ja })}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-gray-500">
                    勤務記録がありません
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
    </div>
  )
}