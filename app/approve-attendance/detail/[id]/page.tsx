"use client"

import { useState, useEffect, useMemo } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/components/ui/use-toast"
import { supabase } from '@/lib/supabaseClient'
import { 
  Clock, 
  ArrowLeft, 
  CalendarDays, 
  UserCircle, 
  Building, 
  FileCheck, 
  CheckCircle2, 
  X, 
  Check,
  Calendar,
  CheckCircle,
  AlertCircle,
  Info,
  Timer,
  CalendarClock,
  Briefcase,
  ArrowLeftRight,
  Users,
  AlertTriangle,
  CalendarPlus,
  CalendarX
} from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns"
import { ja } from "date-fns/locale"
import { AnimatePresence, motion } from "framer-motion"

// ステータスの選択肢
const statusOptions = [
  { value: "00", label: "未提出" },
  { value: "01", label: "提出済" },
  { value: "02", label: "リーダー承認済" },
  { value: "03", label: "差戻し" },
  { value: "04", label: "総務承認済" }
]

// ユーザー名を取得する関数
async function getUserName(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('first_name, last_name')
      .eq('id', userId)
      .single()

    if (error) throw error
    if (!data) return null

    return `${data.last_name} ${data.first_name}`
  } catch (error) {
    console.error('Error fetching user name:', error)
    return null
  }
}

interface AttendanceDetail {
  id: string
  year: number
  month: number
  user_id: string
  status: string
  user?: {
    id: string
    employee_id: string
    first_name: string
    last_name: string
    email: string
    branch_code: string
  }
  branch?: {
    code: string
    name: string
  }
  leaderApproval?: {
    id: string
    process_type: string
    result_code: string
    approver_id: string
    approved_at: string
    remarks?: string
    approverName?: string
  }
  adminApproval?: {
    id: string
    process_type: string
    result_code: string
    approver_id: string
    approved_at: string
    remarks?: string
    approverName?: string
  }
  leader_approved_by_name?: string
  leader_approved_at?: string
  admin_approved_by_name?: string
  admin_approved_at?: string
  records: {
    date: string
    startTime: string
    endTime: string
    breakTime: string
    actualTime: string
    type: string
    remarks: string
    lateEarlyHours: string
  }[]
}

interface AttendanceRecord {
  id: string
  date: string
  day_of_week: string
  day_class: string
  attendance_type: string
  start_time: string | null
  end_time: string | null
  break_time: number | null
  actual_work_hours: number | null
  is_leave: boolean
  is_late: boolean
  is_early: boolean
  remarks: string | null
}

export default function AttendanceDetailPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  
  console.log('Current params:', params)
  
  const [isLoading, setIsLoading] = useState(true)
  const [attendanceData, setAttendanceData] = useState<AttendanceDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [showRejectionDialog, setShowRejectionDialog] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info'; position?: 'top' | 'center'; dismissible?: boolean } | null>(null)
  const [holidays, setHolidays] = useState<{ date: string; remarks: string }[]>([])

  // サマリ情報の計算
  const summary = useMemo(() => {
    if (!attendanceData?.records) return {
      totalWorkDays: 0,
      regularWorkDays: 0,
      holidayWorkDays: 0,
      absenceDays: 0,
      totalWorkTime: 0,
      lateEarlyHours: 0,
      paidLeaveDays: 0
    }

    const workingDays = attendanceData.records.filter(record => 
      record.actualTime && parseFloat(record.actualTime) > 0
    )
    const regularWorkDays = workingDays.filter(record => 
      !["holiday-work", "paid-leave", "am-leave", "pm-leave", "special-leave", 
        "compensatory-leave", "compensatory-leave-planned", "absence", "late", 
        "early-leave", "delay", "shift", "business-holiday"].includes(record.type)
    )
    const holidayWorkDays = workingDays.filter(record => record.type === "holiday-work")
    const absenceDays = attendanceData.records.filter(record => record.type === "absence")
    const totalWorkTime = workingDays.reduce((sum, record) => 
      sum + (parseFloat(record.actualTime) || 0), 0
    )
    const lateEarlyHours = attendanceData.records.reduce((sum, record) => 
      sum + (parseFloat(record.lateEarlyHours) || 0), 0
    )
    const paidLeaveDays = attendanceData.records.reduce((sum, record) => {
      if (record.type === "paid-leave") return sum + 1
      if (record.type === "am-leave" || record.type === "pm-leave") return sum + 0.5
      return sum
    }, 0)

    return {
      totalWorkDays: workingDays.length,
      regularWorkDays: regularWorkDays.length,
      holidayWorkDays: holidayWorkDays.length,
      absenceDays: absenceDays.length,
      totalWorkTime: totalWorkTime.toFixed(1),
      lateEarlyHours: lateEarlyHours.toFixed(1),
      paidLeaveDays: paidLeaveDays.toFixed(1)
    }
  }, [attendanceData?.records])

  // その月の日付範囲を取得する関数
  const getMonthDays = useMemo(() => {
    if (!attendanceData) return []
    const start = startOfMonth(new Date(attendanceData.year, attendanceData.month - 1))
    const end = endOfMonth(start)
    return eachDayOfInterval({ start, end })
  }, [attendanceData])

  // 日付に対応する勤怠データを取得する関数
  const getAttendanceRecord = (date: Date) => {
    if (!attendanceData?.records) return null
    const dateStr = format(date, 'yyyy-MM-dd')
    return attendanceData.records.find(record => record.date === dateStr)
  }

  // 祝日データの取得
  useEffect(() => {
    const fetchHolidays = async () => {
      if (!attendanceData) return

      try {
        const { data, error } = await supabase
          .from('holiday_master')
          .select('date, remarks')
          .eq('year', attendanceData.year)
          .gte('date', `${attendanceData.year}-${String(attendanceData.month).padStart(2, '0')}-01`)
          .lte('date', `${attendanceData.year}-${String(attendanceData.month).padStart(2, '0')}-31`)

        if (error) throw error
        setHolidays(data || [])
      } catch (error) {
        console.error('Error fetching holidays:', error)
      }
    }

    fetchHolidays()
  }, [attendanceData])

  // 日付が祝日かどうかを判定する関数
  const isHoliday = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    return holidays.some(holiday => holiday.date === dateStr)
  }

  // メッセージ表示用のコンポーネント
  const MessageAlert = () => {
    if (!message) return null

    const styles = {
      success: 'bg-green-50 text-green-800 border-green-200',
      error: 'bg-red-50 text-red-800 border-red-200',
      info: 'bg-blue-50 text-blue-800 border-blue-200'
    }

    const icons = {
      success: <CheckCircle2 className="h-5 w-5 text-green-500" />,
      error: <AlertCircle className="h-5 w-5 text-red-500" />,
      info: <Info className="h-5 w-5 text-blue-500" />
    }

    return (
      <div className="fixed top-20 left-0 right-0 z-[100] flex justify-center pointer-events-none">
        <AnimatePresence mode="wait">
          {message && (
            <motion.div
              key={message.text}
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ 
                duration: 0.3,
                ease: "easeInOut"
              }}
              className={`
                pointer-events-auto
                flex items-center gap-2 
                rounded-lg border p-4 
                shadow-lg
                ${styles[message.type]}
              `}
            >
              {icons[message.type]}
              <span className="text-sm font-medium whitespace-pre-line">{message.text}</span>
              {(message.type === 'error' || message.dismissible) && (
                <button
                  onClick={() => setMessage(null)}
                  className="p-1 hover:bg-gray-100 rounded-full ml-2"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  // 勤怠データの取得
  useEffect(() => {
    const fetchAttendanceData = async () => {
      console.log('Fetching attendance data with params:', params)
      const attendanceId = params?.id as string
      console.log('Attendance ID:', attendanceId)
      if (!attendanceId) {
        setError('IDが見つかりません')
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        const { data: headerData, error: headerError } = await supabase
          .from('attendance_headers')
          .select(`
            *,
            user:users!attendance_headers_user_id_fkey (
              id,
              employee_id,
              first_name,
              last_name,
              email,
              branch
            )
          `)
          .eq('id', attendanceId)
          .single()

        if (headerError) throw headerError

        // 部署情報の取得
        let branchData = null
        if (headerData?.branch) {
          const { data: branchResult, error: branchError } = await supabase
            .from('branch_master')
            .select('code, name_jp')
            .eq('code', headerData.branch)
            .single()

          if (!branchError && branchResult) {
            branchData = branchResult
          }
        }

        // 承認情報の取得
        const { data: approvalData, error: approvalError } = await supabase
          .from('attendance_approvals')
          .select('*')
          .eq('header_id', attendanceId)
          .eq('result_code', 'approved')

        if (approvalError) throw approvalError

        // リーダー承認と総務承認の情報を取得
        const leaderApproval = approvalData?.find(a => a.process_type === 'leader')
        const adminApproval = approvalData?.find(a => a.process_type === 'admin')

        // 承認者の名前を取得
        const leaderName = leaderApproval ? await getUserName(leaderApproval.approved_by) : null
        const adminName = adminApproval ? await getUserName(adminApproval.approved_by) : null

        // 勤怠詳細の取得
        const { data: detailsData, error: detailsError } = await supabase
          .from('attendance_details')
          .select('*')
          .eq('header_id', attendanceId)
          .order('date', { ascending: true })

        if (detailsError) throw detailsError

        // データの整形
        const formattedData: AttendanceDetail = {
          ...headerData,
          branch: {
            code: headerData.branch,
            name: branchData?.name_jp || '不明'
          },
          leaderApproval: leaderApproval ? {
            ...leaderApproval,
            approverName: leaderName
          } : null,
          adminApproval: adminApproval ? {
            ...adminApproval,
            approverName: adminName
          } : null,
          records: detailsData.map(detail => ({
            date: detail.date,
            startTime: detail.start_time ? detail.start_time.substring(0, 5) : '',
            endTime: detail.end_time ? detail.end_time.substring(0, 5) : '',
            breakTime: detail.break_time ? detail.break_time.toString() : '',
            actualTime: detail.actual_working_hours ? detail.actual_working_hours.toFixed(1) : '',
            type: detail.work_type_code,
            remarks: detail.remarks || '',
            lateEarlyHours: detail.late_early_hours ? detail.late_early_hours.toFixed(1) : ''
          }))
        }

        setAttendanceData(formattedData)
      } catch (error) {
        console.error('Error fetching attendance data:', error)
        setError('勤怠データの取得に失敗しました')
      } finally {
        setIsLoading(false)
      }
    }

    fetchAttendanceData()
  }, [params?.id])

  // 承認処理
  const handleApprove = async () => {
    try {
      setIsSubmitting(true)
      const { error: approvalError } = await supabase
        .from('attendance_approvals')
        .insert({
          header_id: params.id,
          process_type: 'leader',
          result_code: 'approved',
          approved_by: (await supabase.auth.getUser()).data.user?.id,
          approved_at: new Date().toISOString()
        })

      if (approvalError) throw approvalError

      // ヘッダーのステータスを更新
      const { error: headerError } = await supabase
        .from('attendance_headers')
        .update({ status: '01' })
        .eq('id', params.id)

      if (headerError) throw headerError

      setMessage({ text: '承認が完了しました', type: 'success' })
      router.push('/approve-attendance')
    } catch (error) {
      console.error('Error approving attendance:', error)
      setMessage({ text: '承認に失敗しました', type: 'error' })
    } finally {
      setIsSubmitting(false)
    }
  }

  // 差戻し処理
  const handleReject = async () => {
    try {
      setIsSubmitting(true)
      const { error: approvalError } = await supabase
        .from('attendance_approvals')
        .insert({
          header_id: params.id,
          process_type: 'leader',
          result_code: 'sendback',
          approved_by: (await supabase.auth.getUser()).data.user?.id,
          approved_at: new Date().toISOString(),
          comments: rejectionReason
        })

      if (approvalError) throw approvalError

      // ヘッダーのステータスを更新
      const { error: headerError } = await supabase
        .from('attendance_headers')
        .update({ status: '03' })
        .eq('id', params.id)

      if (headerError) throw headerError

      setMessage({ text: '差戻しが完了しました', type: 'success' })
      router.push('/approve-attendance')
    } catch (error) {
      console.error('Error rejecting attendance:', error)
      setMessage({ text: '差戻しに失敗しました', type: 'error' })
    } finally {
      setIsSubmitting(false)
      setShowRejectionDialog(false)
    }
  }

  // 戻るボタンのクリックハンドラ
  const handleBack = () => {
    const currentSearchParams = new URLSearchParams(searchParams.toString())
    router.push(`/approve-attendance?${currentSearchParams.toString()}`)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (error || !attendanceData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-500">{error || 'データが見つかりません'}</div>
      </div>
    )
  }

  return (
    <div className="w-full">
      <MessageAlert />
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={handleBack}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            戻る
          </Button>
          <h1 className="text-2xl font-bold text-blue-800 flex items-center gap-2">
            <Users className="h-6 w-6" />
            勤怠承認詳細
          </h1>
        </div>

        <div className="flex items-center gap-8">
          {/* リーダー承認情報 */}
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm text-gray-600">リーダー確認</div>
              <div className="text-sm font-medium">{attendanceData?.leader_approved_by_name || '未確認'}</div>
              <div className="text-xs text-gray-500">
                {attendanceData?.leader_approved_at ? 
                  new Date(attendanceData.leader_approved_at).toLocaleDateString('ja-JP') : 
                  '未確認'}
              </div>
            </div>
            {attendanceData?.leader_approved_at && (
              <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-full">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            )}
          </div>

          {/* 総務承認情報 */}
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm text-gray-600">総務確認</div>
              <div className="text-sm font-medium">{attendanceData?.admin_approved_by_name || '未確認'}</div>
              <div className="text-xs text-gray-500">
                {attendanceData?.admin_approved_at ? 
                  new Date(attendanceData.admin_approved_at).toLocaleDateString('ja-JP') : 
                  '未確認'}
              </div>
            </div>
            {attendanceData?.admin_approved_at && (
              <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-full">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            )}
          </div>

          {/* 承認ボタン */}
          <div className="flex items-center gap-2 ml-4">
            <Button
              variant="outline"
              onClick={() => setShowRejectionDialog(true)}
              className="bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 border-red-200"
            >
              <X className="h-4 w-4 mr-2" />
              差戻し
            </Button>
            <Button
              onClick={handleApprove}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Check className="h-4 w-4 mr-2" />
              承認
            </Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="attendance" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="attendance">勤怠入力</TabsTrigger>
          <TabsTrigger value="expense">経費請求</TabsTrigger>
          <TabsTrigger value="business">業務請求</TabsTrigger>
        </TabsList>
        <TabsContent value="attendance">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-6">
                {/* 基本情報 */}
                <div className="flex items-center gap-4 text-lg">
                  <div className="flex items-center gap-4">
                    <UserCircle className="h-6 w-6 text-blue-600" />
                    <span className="text-blue-800">{attendanceData?.branch?.name}</span>
                    <span className="text-gray-600">{attendanceData?.user?.employee_id}</span>
                    <span className="text-gray-800">{attendanceData?.user?.last_name} {attendanceData?.user?.first_name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-gray-600">{attendanceData?.year}年{attendanceData?.month}月</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium ${
                      attendanceData?.status === '02' ? 'bg-green-100 text-green-800' :
                      attendanceData?.status === '01' ? 'bg-blue-100 text-blue-800' :
                      attendanceData?.status === '00' ? 'bg-yellow-100 text-yellow-800' :
                      attendanceData?.status === '03' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {(() => {
                        switch (attendanceData?.status) {
                          case '00': return '下書き';
                          case '01': return '申請中';
                          case '02': return '承認済';
                          case '03': return '差戻し';
                          case '04': return '総務承認済';
                          default: return '不明';
                        }
                      })()}
                    </span>
                  </div>
                </div>

                {/* サマリ情報 */}
                <div className="grid grid-cols-7 gap-4 mb-6">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-sm text-blue-600 mb-1 flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      総勤務日数
                    </div>
                    <div className="text-2xl font-bold text-blue-800">
                      {summary.totalWorkDays}日
                    </div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-sm text-green-600 mb-1 flex items-center gap-1">
                      <Briefcase className="h-3.5 w-3.5" />
                      通常勤務日数
                    </div>
                    <div className="text-2xl font-bold text-green-800">
                      {summary.regularWorkDays}日
                    </div>
                  </div>
                  <div className="bg-amber-50 p-4 rounded-lg">
                    <div className="text-sm text-amber-600 mb-1 flex items-center gap-1">
                      <CalendarPlus className="h-3.5 w-3.5" />
                      休日出勤日数
                    </div>
                    <div className="text-2xl font-bold text-amber-800">
                      {summary.holidayWorkDays}日
                    </div>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg">
                    <div className="text-sm text-red-600 mb-1 flex items-center gap-1">
                      <CalendarX className="h-3.5 w-3.5" />
                      欠勤日数
                    </div>
                    <div className="text-2xl font-bold text-red-800">
                      {summary.absenceDays}日
                    </div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <div className="text-sm text-purple-600 mb-1 flex items-center gap-1">
                      <Timer className="h-3.5 w-3.5" />
                      総勤務時間
                    </div>
                    <div className="text-2xl font-bold text-purple-800">
                      {summary.totalWorkTime}時間
                    </div>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg">
                    <div className="text-sm text-orange-600 mb-1 flex items-center gap-1">
                      <ArrowLeftRight className="h-3.5 w-3.5" />
                      遅刻早退時間
                    </div>
                    <div className="text-2xl font-bold text-orange-800">
                      {summary.lateEarlyHours}時間
                    </div>
                  </div>
                  <div className="bg-indigo-50 p-4 rounded-lg">
                    <div className="text-sm text-indigo-600 mb-1 flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      有給休暇取得日数
                    </div>
                    <div className="text-2xl font-bold text-indigo-800">
                      {summary.paidLeaveDays}日
                    </div>
                  </div>
                </div>

                <div className="border rounded-lg border-gray-300 shadow-sm">
                  <div className="grid grid-cols-12 gap-0 p-2 bg-blue-50 dark:bg-gray-800 rounded-t-lg text-sm border-b border-gray-300">
                    <div className="col-span-1 text-sm font-medium text-[rgb(30,58,138)] bg-[rgb(239,246,255)] px-2 py-1.5 text-center">
                      日付
                    </div>
                    <div className="col-span-1 text-sm font-medium text-[rgb(30,58,138)] bg-[rgb(239,246,255)] px-2 py-1.5 text-center">
                      開始時間
                    </div>
                    <div className="col-span-1 text-sm font-medium text-[rgb(30,58,138)] bg-[rgb(239,246,255)] px-2 py-1.5 text-center">
                      終了時間
                    </div>
                    <div className="col-span-1 text-sm font-medium text-[rgb(30,58,138)] bg-[rgb(239,246,255)] px-2 py-1.5 text-center">
                      休憩時間
                    </div>
                    <div className="col-span-1 text-sm font-medium text-[rgb(30,58,138)] bg-[rgb(239,246,255)] px-2 py-1.5 text-center">
                      実働時間
                    </div>
                    <div className="col-span-2 text-sm font-medium text-[rgb(30,58,138)] bg-[rgb(239,246,255)] px-2 py-1.5 text-center">
                      勤務区分
                    </div>
                    <div className="col-span-4 text-sm font-medium text-[rgb(30,58,138)] bg-[rgb(239,246,255)] px-2 py-1.5 text-center">
                      作業内容
                    </div>
                    <div className="col-span-1 text-sm font-medium text-[rgb(30,58,138)] bg-[rgb(239,246,255)] px-2 py-1.5 text-center">
                      遅刻早退時間
                    </div>
                  </div>

                  <div className="divide-y divide-gray-300">
                    {getMonthDays.map((date) => {
                      const record = getAttendanceRecord(date)
                      const dateKey = format(date, 'yyyy-MM-dd')
                      const isWeekend = date.getDay() === 0 || date.getDay() === 6
                      const isHolidayDate = isHoliday(date)

                      return (
                        <div
                          key={dateKey}
                          className={`grid grid-cols-12 gap-0 items-center px-4 py-1.5 ${
                            isWeekend || isHolidayDate
                              ? 'bg-gray-50'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className={`col-span-1 text-sm font-medium px-6 ${isWeekend || isHolidayDate ? 'text-red-600' : ''}`}>
                            {format(date, 'M/d')}({format(date, 'E', { locale: ja })})
                          </div>
                          <div className="col-span-1 px-2">
                            <div className="h-7 flex items-center justify-center font-medium text-sm">
                              {record?.startTime || ''}
                            </div>
                          </div>
                          <div className="col-span-1 px-2">
                            <div className="h-7 flex items-center justify-center font-medium text-sm">
                              {record?.endTime || ''}
                            </div>
                          </div>
                          <div className="col-span-1 px-2">
                            <div className="h-7 flex items-center justify-center font-medium text-sm">
                              {record?.breakTime ? `${String(Math.floor(parseInt(record.breakTime) / 60)).padStart(2, '0')}:${String(parseInt(record.breakTime) % 60).padStart(2, '0')}` : ''}
                            </div>
                          </div>
                          <div className="col-span-1 px-2">
                            <div className="h-7 flex items-center justify-center font-medium text-sm">
                              {record?.actualTime ? `${String(Math.floor(parseFloat(record.actualTime))).padStart(2, '0')}:${String(Math.round((parseFloat(record.actualTime) % 1) * 60)).padStart(2, '0')}` : ''}
                            </div>
                          </div>
                          <div className="col-span-2 px-2">
                            <div className="h-7 flex items-center px-3 font-medium text-sm">
                              {(() => {
                                if (!record?.type) return ''
                                switch (record.type) {
                                  case 'holiday-work': return '休出';
                                  case 'paid-leave': return '有休';
                                  case 'am-leave': return '前休';
                                  case 'pm-leave': return '後休';
                                  case 'special-leave': return '特休';
                                  case 'compensatory-leave': return '振休';
                                  case 'compensatory-leave-planned': return '振予';
                                  case 'absence': return '欠勤';
                                  case 'late': return '遅刻';
                                  case 'early-leave': return '早退';
                                  case 'delay': return '遅延';
                                  case 'shift': return 'シフト';
                                  case 'business-holiday': return '休業';
                                  default: return '';
                                }
                              })()}
                            </div>
                          </div>
                          <div className="col-span-4 px-2">
                            <div className="h-7 flex items-center font-medium text-sm">
                              {record?.remarks || ''}
                            </div>
                          </div>
                          <div className="col-span-1 px-2">
                            <div className="h-7 flex items-center justify-center font-medium text-sm">
                              {record?.lateEarlyHours || ''}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="expense">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center text-gray-500">経費請求情報は現在準備中です</div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="business">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center text-gray-500">業務請求情報は現在準備中です</div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 差戻し理由入力ダイアログ */}
      <Dialog open={showRejectionDialog} onOpenChange={setShowRejectionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>差戻し理由の入力</DialogTitle>
            <DialogDescription>
              差戻しの理由を入力してください。
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="差戻しの理由を入力"
              className="min-h-[100px]"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRejectionDialog(false)}
              disabled={isSubmitting}
            >
              キャンセル
            </Button>
            <Button
              onClick={handleReject}
              variant="destructive"
              disabled={isSubmitting || !rejectionReason.trim()}
            >
              差戻し
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
} 