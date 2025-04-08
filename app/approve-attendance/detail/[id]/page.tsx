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
  CalendarX,
  Bus,
  CreditCard,
  FileText
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
    work_type_code: string
    remarks: string
    lateEarlyHours: string
  }[]
  expenses?: {
    commuteExpenses: {
      id: string
      date: string
      transportation: string
      from: string
      to: string
      expenseType: string
      roundTripType: string
      amount: number
      remarks: string
    }[]
    businessExpenses: {
      id: string
      date: string
      transportation: string
      from: string
      to: string
      expenseType: string
      roundTripType: string
      amount: number
      remarks: string
    }[]
    receipts?: {
      id: string
      fileName: string
      remarks: string
    }[]
  }
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

// 通勤費の種類
const commuteTypes = [
  { value: 'regular', label: '定期' },
  { value: 'ticket', label: '切符' },
  { value: 'parking', label: '駐輪場' },
  { value: 'gasoline', label: 'ガソリン' },
  { value: 'other', label: 'その他' }
]

// 業務経費の種類
const businessTypes = [
  { value: 'with-receipt', label: '経費（領収書有り）' },
  { value: 'without-receipt', label: '経費（領収書無し）' },
  { value: 'accommodation', label: '宿泊費' },
  { value: 'per-diem', label: '宿泊日当' }
]

// 片道/往復の種類
const roundTripTypes = [
  { value: 'one-way', label: '片道' },
  { value: 'round-trip', label: '往復' },
  { value: 'other', label: 'その他' }
]

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
  const [selectedReceipt, setSelectedReceipt] = useState<{ 
    id: string; 
    fileName: string; 
    fileUrl?: string; 
    filePath?: string;
    fileSize?: number;
    fileType?: string;
    remarks?: string;
    uploadedAt?: string;
  } | null>(null)
  const [showReceiptViewer, setShowReceiptViewer] = useState(false)

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

    // 総勤務時間と遅刻早退時間の計算
    const totalWorkTime = attendanceData.records.reduce((sum, record) => 
      sum + (record.actualTime ? parseFloat(record.actualTime) : 0), 0
    )
    
    const lateEarlyHours = attendanceData.records.reduce((sum, record) => 
      sum + (record.lateEarlyHours ? parseFloat(record.lateEarlyHours) : 0), 0
    )

    // 休日出勤日数のカウント - 休出コードで実働時間がある
    const holidayWorkRecords = attendanceData.records.filter(record => {
      const isHolidayWork = record.work_type_code === 'holiday-work' || record.work_type_code === '10';
      const hasActualTime = record.actualTime && parseFloat(record.actualTime) > 0;
      return isHolidayWork && hasActualTime;
    });
    
    const holidayWorkDays = holidayWorkRecords.length;

    // 欠勤日数のカウント
    const absenceRecords = attendanceData.records.filter(record => 
      record.work_type_code === 'absence' || record.work_type_code === '06'
    );
    
    const absenceDays = absenceRecords.length;

    // 通常勤務日数のカウント:
    // 実働時間があり、かつ休出でないレコード
    const workingDaysRecords = attendanceData.records.filter(record => {
      // 数値に変換された実働時間
      const actualTimeValue = record.actualTime ? parseFloat(record.actualTime) : 0;
      // 実働時間があるか
      const hasActualTime = actualTimeValue > 0;
      // 休出でないか
      const isNotHolidayWork = record.work_type_code !== 'holiday-work' && record.work_type_code !== '10';
      
      return hasActualTime && isNotHolidayWork;
    });
    
    const regularWorkDays = workingDaysRecords.length;

    // 総勤務日数（実働時間が存在するレコードの件数）- 休出含む
    const allWorkingDaysRecords = attendanceData.records.filter(record => {
      const actualTimeValue = record.actualTime ? parseFloat(record.actualTime) : 0;
      return actualTimeValue > 0;
    });
    
    const totalWorkDays = allWorkingDaysRecords.length;

    // 有給休暇日数の計算
    const paidLeaveDays = attendanceData.records.reduce((sum, record) => {
      if (record.work_type_code === 'paid-leave' || record.work_type_code === '02') return sum + 1;
      if (record.work_type_code === 'am-leave' || record.work_type_code === 'pm-leave' || 
          record.work_type_code === '03' || record.work_type_code === '04') return sum + 0.5;
      return sum;
    }, 0);

    return {
      totalWorkDays,
      regularWorkDays,
      holidayWorkDays,
      absenceDays,
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
        // 月の最終日を計算
        const lastDayOfMonth = new Date(attendanceData.year, attendanceData.month, 0).getDate()
        
        const { data, error } = await supabase
          .from('holiday_master')
          .select('date, remarks')
          .eq('year', attendanceData.year)
          .gte('date', `${attendanceData.year}-${String(attendanceData.month).padStart(2, '0')}-01`)
          .lte('date', `${attendanceData.year}-${String(attendanceData.month).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`)

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

  // 経費の合計金額を計算
  const expenseSummary = useMemo(() => {
    if (!attendanceData?.expenses) {
      return {
        commuteTotal: 0,
        businessTotal: 0,
        total: 0
      }
    }

    const commuteTotal = attendanceData.expenses.commuteExpenses.reduce(
      (sum, expense) => sum + expense.amount,
      0
    )

    const businessTotal = attendanceData.expenses.businessExpenses.reduce(
      (sum, expense) => sum + expense.amount,
      0
    )

    return {
      commuteTotal,
      businessTotal,
      total: commuteTotal + businessTotal
    }
  }, [attendanceData?.expenses])

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

        // 勤務区分の取得
        const { data: workTypesData, error: workTypesError } = await supabase
          .from('work_types')
          .select('code, name_ja')
          .order('code', { ascending: true })

        if (workTypesError) throw workTypesError

        // 経費データの取得
        const { data: expenseHeaderData, error: expenseHeaderError } = await supabase
          .from('expense_headers')
          .select('id')
          .eq('user_id', headerData.user_id)
          .eq('year', headerData.year)
          .eq('month', headerData.month)
          .maybeSingle()

        if (expenseHeaderError) throw expenseHeaderError

        // 経費明細の取得
        let expenseData: Array<{
          id: string;
          date: string;
          transportation: string;
          from_location: string;
          to_location: string;
          expense_type: string;
          round_trip_type: string;
          amount: number;
          remarks: string | null;
          category: string;
        }> = [];
        let receiptsData: Array<{
          id: string;
          file_name: string;
          file_path: string | null;
          file_size: number | null;
          file_type: string | null;
          remarks: string | null;
          uploaded_at: string;
        }> = [];
        let receipts: Array<{
          id: string;
          fileName: string;
          fileUrl: string;
          filePath: string | null;
          fileSize: number | null;
          fileType: string | null;
          remarks: string;
          uploadedAt: string;
        }> = [];

        if (expenseHeaderData) {
          // 経費明細の取得
          const { data, error: expenseError } = await supabase
            .from('expense_details')
            .select(`
              id,
              date,
              transportation,
              from_location,
              to_location,
              expense_type,
              round_trip_type,
              amount,
              remarks,
              category
            `)
            .eq('header_id', expenseHeaderData.id)

          if (expenseError) throw expenseError
          expenseData = data || [];

          // 領収書データの取得
          const { data: receiptData, error: receiptsError } = await supabase
            .from('expense_receipts')
            .select(`
              id,
              file_name,
              file_path,
              file_size,
              file_type,
              remarks,
              uploaded_at
            `)
            .eq('header_id', expenseHeaderData.id)

          if (receiptsError) throw receiptsError
          receiptsData = receiptData || [];

          // 領収書の公開URLを取得
          receipts = receiptsData.map(item => {
            let fileUrl = '';
            if (item.file_path) {
              try {
                const { data } = supabase.storage
                  .from('expense-evidences')
                  .getPublicUrl(item.file_path);
                fileUrl = data.publicUrl;
              } catch (error) {
                console.error('領収書の公開URL取得エラー:', error);
              }
            }
            return {
              id: item.id,
              fileName: item.file_name,
              fileUrl: fileUrl,
              filePath: item.file_path,
              fileSize: item.file_size,
              fileType: item.file_type,
              remarks: item.remarks || '',
              uploadedAt: item.uploaded_at
            };
          });
        }

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
          records: detailsData.map(detail => {
            return {
              date: detail.date,
              startTime: detail.start_time ? detail.start_time.substring(0, 5) : '',
              endTime: detail.end_time ? detail.end_time.substring(0, 5) : '',
              breakTime: detail.break_time ? detail.break_time.toString() : '',
              actualTime: detail.actual_working_hours ? detail.actual_working_hours.toFixed(1) : '',
              type: workTypesData?.find(type => type.code === detail.work_type_code)?.name_ja || detail.work_type_code,
              work_type_code: detail.work_type_code || '',
              remarks: detail.remarks || '',
              lateEarlyHours: detail.late_early_hours ? detail.late_early_hours.toFixed(1) : ''
            }
          }),
          expenses: {
            commuteExpenses: expenseData
              ?.filter(expense => expense.category === 'commute')
              ?.map(expense => ({
                id: expense.id,
                date: expense.date,
                transportation: expense.transportation,
                from: expense.from_location,
                to: expense.to_location,
                expenseType: expense.expense_type,
                roundTripType: expense.round_trip_type,
                amount: expense.amount,
                remarks: expense.remarks || ''
              })) || [],
            businessExpenses: expenseData
              ?.filter(expense => expense.category === 'business')
              ?.map(expense => ({
                id: expense.id,
                date: expense.date,
                transportation: expense.transportation,
                from: expense.from_location,
                to: expense.to_location,
                expenseType: expense.expense_type,
                roundTripType: expense.round_trip_type,
                amount: expense.amount,
                remarks: expense.remarks || ''
              })) || [],
            receipts: receipts
          }
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
                        if (!record?.work_type_code || record.work_type_code === '01' || record.work_type_code === '') {
                          return '';
                        }
                        
                        return record?.type || '';
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
              <div className="space-y-6">
                {/* 経費サマリー */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                    <div className="flex items-center gap-2 text-blue-700 mb-1">
                      <Bus className="h-5 w-5" />
                      <div className="text-sm font-medium">通勤費合計</div>
                    </div>
                    <div className="text-2xl font-bold text-blue-800">
                      ¥{expenseSummary.commuteTotal.toLocaleString()}
                    </div>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                    <div className="flex items-center gap-2 text-green-700 mb-1">
                      <Briefcase className="h-5 w-5" />
                      <div className="text-sm font-medium">業務経費合計</div>
                    </div>
                    <div className="text-2xl font-bold text-green-800">
                      ¥{expenseSummary.businessTotal.toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* 通勤費セクション */}
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    <Bus className="h-5 w-5 text-blue-600" />
                    <h2 className="text-lg font-semibold text-blue-800">通勤費</h2>
                  </div>

                  <div className="border rounded-lg border-gray-200 overflow-hidden mb-6">
                    <div className="grid grid-cols-8 gap-0 p-2 bg-blue-50 text-sm border-b border-gray-200">
                      <div className="col-span-1 text-blue-700 font-medium px-2">発生日</div>
                      <div className="col-span-1 text-blue-700 font-medium px-2">交通機関</div>
                      <div className="col-span-2 text-blue-700 font-medium px-2">区間</div>
                      <div className="col-span-1 text-blue-700 font-medium px-2">種類</div>
                      <div className="col-span-1 text-blue-700 font-medium px-2">片道/往復</div>
                      <div className="col-span-1 text-blue-700 font-medium px-2">金額</div>
                      <div className="col-span-1 text-blue-700 font-medium px-2">目的・備考</div>
                    </div>

                    <div className="divide-y divide-gray-100">
                      {attendanceData?.expenses?.commuteExpenses?.map((expense) => (
                        <div 
                          key={expense.id} 
                          className="grid grid-cols-8 gap-0 p-1.5 hover:bg-blue-50/50 items-center"
                        >
                          <div className="col-span-1 px-2 text-sm">{expense.date}</div>
                          <div className="col-span-1 px-2 text-sm">{expense.transportation}</div>
                          <div className="col-span-2 px-2 text-sm">{expense.from} → {expense.to}</div>
                          <div className="col-span-1 px-2 text-sm">
                            {commuteTypes.find(type => type.value === expense.expenseType)?.label || '不明'}
                          </div>
                          <div className="col-span-1 px-2 text-sm">
                            {roundTripTypes.find(type => type.value === expense.roundTripType)?.label || '不明'}
                          </div>
                          <div className="col-span-1 px-2 text-sm">¥{expense.amount.toLocaleString()}</div>
                          <div className="col-span-1 px-2 text-sm">{expense.remarks}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 業務経費セクション */}
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    <Briefcase className="h-5 w-5 text-green-600" />
                    <h2 className="text-lg font-semibold text-green-800">業務経費</h2>
                  </div>

                  <div className="border rounded-lg border-gray-200 overflow-hidden mb-6">
                    <div className="grid grid-cols-8 gap-0 p-2 bg-green-50 text-sm border-b border-gray-200">
                      <div className="col-span-1 text-green-700 font-medium px-2">発生日</div>
                      <div className="col-span-1 text-green-700 font-medium px-2">交通機関/宿泊先</div>
                      <div className="col-span-2 text-green-700 font-medium px-2">区間</div>
                      <div className="col-span-1 text-green-700 font-medium px-2">費目</div>
                      <div className="col-span-1 text-green-700 font-medium px-2">片道/往復</div>
                      <div className="col-span-1 text-green-700 font-medium px-2">金額</div>
                      <div className="col-span-1 text-green-700 font-medium px-2">目的・備考</div>
                    </div>

                    <div className="divide-y divide-gray-100">
                      {attendanceData?.expenses?.businessExpenses?.map((expense) => (
                        <div 
                          key={expense.id} 
                          className="grid grid-cols-8 gap-0 p-1.5 hover:bg-green-50/50 items-center"
                        >
                          <div className="col-span-1 px-2 text-sm">{expense.date}</div>
                          <div className="col-span-1 px-2 text-sm">{expense.transportation}</div>
                          <div className="col-span-2 px-2 text-sm">{expense.from} → {expense.to}</div>
                          <div className="col-span-1 px-2 text-sm">
                            {businessTypes.find(type => type.value === expense.expenseType)?.label || '不明'}
                          </div>
                          <div className="col-span-1 px-2 text-sm">
                            {roundTripTypes.find(type => type.value === expense.roundTripType)?.label || '不明'}
                          </div>
                          <div className="col-span-1 px-2 text-sm">¥{expense.amount.toLocaleString()}</div>
                          <div className="col-span-1 px-2 text-sm">{expense.remarks}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 領収書セクション */}
                <div className="mt-8">
                  <div className="flex items-center gap-2 mb-4">
                    <FileText className="h-5 w-5 text-purple-600" />
                    <h2 className="text-lg font-semibold text-purple-800">領収書・定期券</h2>
                  </div>
                  <div className="border rounded-lg border-gray-200 overflow-hidden max-w-2xl">
                    <div className="grid grid-cols-12 gap-0 p-2 bg-gray-50 text-sm border-b border-gray-200">
                      <div className="col-span-8 text-gray-700 font-medium px-2">ファイル名</div>
                      <div className="col-span-4 text-gray-700 font-medium px-2">備考</div>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {attendanceData?.expenses?.receipts && attendanceData.expenses.receipts.length > 0 ? (
                        attendanceData.expenses.receipts.map((receipt) => (
                          <div 
                            key={receipt.id} 
                            className="grid grid-cols-12 gap-0 p-1.5 hover:bg-gray-50/50 items-center"
                          >
                            <div className="col-span-8 px-2 text-left">
                              <button
                                onClick={() => {
                                  setSelectedReceipt(receipt);
                                  setShowReceiptViewer(true);
                                }}
                                className="text-sm text-blue-600 hover:text-blue-800 hover:underline text-left"
                              >
                                {receipt.fileName}
                              </button>
                            </div>
                            <div className="col-span-4 px-2">
                              <span className="text-sm text-gray-700">{receipt.remarks || '―'}</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="py-4 text-center text-gray-500">
                          登録されている領収書がありません
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
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

      {/* 領収書ビューダイアログ */}
      <Dialog open={showReceiptViewer} onOpenChange={setShowReceiptViewer}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>領収書</DialogTitle>
            <DialogDescription className="truncate">
              {selectedReceipt?.fileName}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 flex-1 overflow-auto bg-gray-100 rounded-md flex items-center justify-center">
            {selectedReceipt && (
              selectedReceipt.fileUrl ? (
                selectedReceipt.fileUrl.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                  // 画像ファイルの場合
                  <img
                    src={selectedReceipt.fileUrl}
                    alt={selectedReceipt.fileName}
                    className="max-w-full max-h-[60vh] object-contain"
                    onError={(e) => {
                      console.error('画像ロード失敗:', selectedReceipt.fileUrl);
                      const target = e.target as HTMLImageElement;
                      target.onerror = null;
                      target.style.display = 'none';
                      target.insertAdjacentHTML('afterend', `
                        <div class="text-center p-4 text-gray-500">
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto mb-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <p>画像の読み込みに失敗しました</p>
                        </div>
                      `);
                    }}
                  />
                ) : selectedReceipt.fileUrl.match(/\.pdf$/i) ? (
                  // PDFファイルの場合
                  <iframe
                    src={selectedReceipt.fileUrl + '#toolbar=0'}
                    className="w-full h-[60vh]"
                    title={selectedReceipt.fileName}
                  />
                ) : (
                  // 対応していないファイル形式の場合
                  <div className="text-center p-4 text-gray-500">
                    <FileText className="h-16 w-16 mx-auto mb-2 text-gray-400" />
                    <p>このファイル形式はプレビューできません</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={() => {
                        if (selectedReceipt.fileUrl) {
                          window.open(selectedReceipt.fileUrl, '_blank');
                        }
                      }}
                    >
                      ファイルを開く
                    </Button>
                  </div>
                )
              ) : (
                // ファイルURLがない場合
                <div className="text-center p-4 text-gray-500">
                  <AlertTriangle className="h-16 w-16 mx-auto mb-2 text-amber-400" />
                  <p>ファイルを表示できません</p>
                </div>
              )
            )}
          </div>
          <div className="mt-2 text-sm text-gray-500">
            <p><span className="font-medium">備考: </span>{selectedReceipt?.remarks || 'なし'}</p>
          </div>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setShowReceiptViewer(false)}
            >
              閉じる
            </Button>
            {selectedReceipt?.fileUrl && (
              <Button
                onClick={() => {
                  if (selectedReceipt.fileUrl) {
                    window.open(selectedReceipt.fileUrl, '_blank');
                  }
                }}
              >
                ブラウザで開く
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
} 