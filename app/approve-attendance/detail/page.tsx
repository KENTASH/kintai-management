"use client"

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
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
  AlertTriangle
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
import { format } from "date-fns"
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
  const { id } = useParams()
  const { toast } = useToast()
  
  const [isLoading, setIsLoading] = useState(true)
  const [attendanceData, setAttendanceData] = useState<AttendanceDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [showRejectionDialog, setShowRejectionDialog] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info'; position?: 'top' | 'center'; dismissible?: boolean } | null>(null)

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
      <div className="fixed top-16 left-0 right-0 z-[100] flex justify-center pointer-events-none">
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
              branch_code
            ),
            branch:branches!attendance_headers_branch_code_fkey (
              code,
              name
            )
          `)
          .eq('id', id)
          .single()

        if (headerError) throw headerError

        // 承認情報の取得
        const { data: approvalData, error: approvalError } = await supabase
          .from('attendance_approvals')
          .select('*')
          .eq('attendance_header_id', id)
          .eq('result_code', 'approved')

        if (approvalError) throw approvalError

        // リーダー承認と総務承認の情報を取得
        const leaderApproval = approvalData?.find(a => a.process_type === 'leader')
        const adminApproval = approvalData?.find(a => a.process_type === 'admin')

        // 承認者の名前を取得
        const leaderName = leaderApproval ? await getUserName(leaderApproval.approver_id) : null
        const adminName = adminApproval ? await getUserName(adminApproval.approver_id) : null

        // 勤怠詳細の取得
        const { data: detailsData, error: detailsError } = await supabase
          .from('attendance_details')
          .select('*')
          .eq('attendance_header_id', id)
          .order('date', { ascending: true })

        if (detailsError) throw detailsError

        // データの整形
        const formattedData: AttendanceDetail = {
          ...headerData,
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
            breakTime: detail.break_time ? detail.break_time.substring(0, 5) : '',
            actualTime: detail.actual_time ? detail.actual_time.toFixed(1) : '',
            type: detail.type,
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
  }, [id])

  // 承認処理
  const handleApprove = async () => {
    try {
      setIsSubmitting(true)
      const { error: approvalError } = await supabase
        .from('attendance_approvals')
        .insert({
          attendance_header_id: id,
          process_type: 'leader',
          result_code: 'approved',
          approver_id: (await supabase.auth.getUser()).data.user?.id,
          approved_at: new Date().toISOString()
        })

      if (approvalError) throw approvalError

      // ヘッダーのステータスを更新
      const { error: headerError } = await supabase
        .from('attendance_headers')
        .update({ status: '01' })
        .eq('id', id)

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
          attendance_header_id: id,
          process_type: 'leader',
          result_code: 'sendback',
          approver_id: (await supabase.auth.getUser()).data.user?.id,
          approved_at: new Date().toISOString(),
          remarks: rejectionReason
        })

      if (approvalError) throw approvalError

      // ヘッダーのステータスを更新
      const { error: headerError } = await supabase
        .from('attendance_headers')
        .update({ status: '03' })
        .eq('id', id)

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
    <div className="container mx-auto py-6">
      <MessageAlert />
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-blue-600" />
          <h1 className="text-2xl font-bold text-blue-800">勤怠承認詳細</h1>
        </div>
        <div className="flex items-center gap-4">
          <Button
            onClick={() => router.push('/approve-attendance')}
            variant="outline"
            className="border-gray-300"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            戻る
          </Button>
          <Button
            onClick={() => setShowRejectionDialog(true)}
            variant="destructive"
            disabled={isSubmitting}
          >
            <X className="h-4 w-4 mr-2" />
            差戻し
          </Button>
          <Button
            onClick={handleApprove}
            className="bg-green-600 hover:bg-green-700"
            disabled={isSubmitting}
          >
            <Check className="h-4 w-4 mr-2" />
            承認
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-8">
              <div>
                <div className="text-sm text-muted-foreground">社員番号</div>
                <div className="font-medium">{attendanceData.user?.employee_id || ''}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">部署</div>
                <div className="font-medium">{attendanceData.branch?.name || ''}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">氏名</div>
                <div className="font-medium">
                  {attendanceData.user?.last_name && attendanceData.user?.first_name 
                    ? `${attendanceData.user.last_name} ${attendanceData.user.first_name}` 
                    : attendanceData.user?.last_name || attendanceData.user?.first_name || ''}
                </div>
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">ステータス</div>
              <div className="font-medium flex items-center gap-1">
                {(() => {
                  switch (attendanceData.status) {
                    case '00': return <Calendar className="h-4 w-4 text-gray-500" />;
                    case '01': return <CheckCircle className="h-4 w-4 text-blue-500" />;
                    case '02': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
                    case '03': return <AlertTriangle className="h-4 w-4 text-amber-500" />;
                    default: return <Calendar className="h-4 w-4 text-gray-500" />;
                  }
                })()}
                {(() => {
                  switch (attendanceData.status) {
                    case '00': return '未提出';
                    case '01': return '申請中';
                    case '02': return '承認済';
                    case '03': return '差戻し';
                    default: return '未提出';
                  }
                })()}
              </div>
            </div>
          </div>

          <div className="border rounded-lg border-gray-300 shadow-sm">
            <div className="grid grid-cols-12 gap-0 p-2 bg-blue-50 dark:bg-gray-800 rounded-t-lg text-sm border-b border-gray-300">
              <div className="col-span-1 text-gray-500 font-medium flex items-center justify-center gap-1 px-6">
                <Calendar className="h-4 w-4" />
                日付
              </div>
              <div className="col-span-1 text-gray-500 font-medium flex items-center justify-center gap-1">
                <Clock className="h-4 w-4" />
                開始
              </div>
              <div className="col-span-1 text-gray-500 font-medium flex items-center justify-center gap-1">
                <Clock className="h-4 w-4" />
                終了
              </div>
              <div className="col-span-1 text-gray-500 font-medium flex items-center justify-center gap-1">
                <Timer className="h-4 w-4" />
                休憩
              </div>
              <div className="col-span-1 text-gray-500 font-medium flex items-center justify-center gap-1">
                <CalendarClock className="h-4 w-4" />
                実働
              </div>
              <div className="col-span-2 text-gray-500 font-medium flex items-center gap-1">
                <Briefcase className="h-4 w-4" />
                勤務形態
              </div>
              <div className="col-span-4 text-gray-500 font-medium flex items-center gap-1">
                <Info className="h-4 w-4" />
                作業内容
              </div>
              <div className="col-span-1 text-gray-500 font-medium flex items-center justify-center gap-1">
                <ArrowLeftRight className="h-4 w-4" />
                遅早
              </div>
            </div>

            <div className="divide-y divide-gray-300">
              {attendanceData.records.map((record) => (
                <div
                  key={record.date}
                  className="grid grid-cols-12 gap-0 items-center px-4 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                >
                  <div className="col-span-1 text-sm font-medium px-6">
                    {format(new Date(record.date), 'M/d')}({format(new Date(record.date), 'E', { locale: ja })})
                  </div>
                  <div className="col-span-1 px-2">
                    <div className="h-7 flex items-center justify-center font-medium text-sm">
                      {record.startTime}
                    </div>
                  </div>
                  <div className="col-span-1 px-2">
                    <div className="h-7 flex items-center justify-center font-medium text-sm">
                      {record.endTime}
                    </div>
                  </div>
                  <div className="col-span-1 px-2">
                    <div className="h-7 flex items-center justify-center font-medium text-sm">
                      {record.breakTime}
                    </div>
                  </div>
                  <div className="col-span-1 px-2">
                    <div className="h-7 flex items-center justify-center font-medium text-sm">
                      {record.actualTime}
                    </div>
                  </div>
                  <div className="col-span-2 px-2">
                    <div className="h-7 flex items-center px-3 font-medium text-sm">
                      {(() => {
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
                      {record.remarks}
                    </div>
                  </div>
                  <div className="col-span-1 px-2">
                    <div className="h-7 flex items-center justify-center font-medium text-sm">
                      {record.lateEarlyHours}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

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