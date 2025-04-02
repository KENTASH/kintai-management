"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { useRouter } from 'next/navigation'
import { 
  Clock, Search, ChevronRight, CheckCircle, XCircle, ArrowLeft,
  Calendar, IdCard, Building2, User, Activity, ListChecks, SearchX,
  Sun, Timer, AlertCircle, X, Info, AlertCircle as AlertCircleIcon, CheckCircle2
} from "lucide-react"
import { supabase } from '@/lib/supabaseClient'
import React from 'react'
import { AnimatePresence, motion } from 'framer-motion'

// 年の選択肢
const years = Array.from({ length: 3 }, (_, i) => 2024 + i)

// 月の選択肢
const months = Array.from({ length: 12 }, (_, i) => i + 1)

// ステータスの選択肢
const statusOptions = [
  { value: "_all", label: "すべて" },
  { value: "00", label: "下書き" },
  { value: "01", label: "申請中" },
  { value: "02", label: "承認済" },
  { value: "03", label: "差戻し" }
]

interface Branch {
  code: string
  name: string
}

interface AttendanceSummary {
  id: string
  year: number
  month: number
  user_id: string
  employee_id: string
  branch_code: string
  branch_name: string
  user_name: string
  status: string
  leader_approved_at: string | null
  leader_approved_by: string | null
  leader_approved_by_name: string | null
  admin_approved_at: string | null
  admin_approved_by: string | null
  admin_approved_by_name: string | null
  total_working_days: number
  holiday_working_days: number
  absence_days: number
  total_working_hours: number
  late_early_hours: number
  paid_leave_days: number
}

export default function ApproveAttendancePage() {
  const router = useRouter()
  const { toast } = useToast()
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1)
  const [employeeId, setEmployeeId] = useState<string>("")
  const [branchCode, setBranchCode] = useState<string>("")
  const [employeeName, setEmployeeName] = useState<string>("")
  const [selectedStatus, setSelectedStatus] = useState<string>("")
  const [branches, setBranches] = useState<Branch[]>([])
  const [attendanceSummaries, setAttendanceSummaries] = useState<AttendanceSummary[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [userProfile, setUserProfile] = useState<any>(null)

  // メッセージの状態管理を追加
  interface Message {
    type: 'success' | 'error' | 'info'
    text: string
    dismissible?: boolean
    persistent?: boolean
    details?: any
  }
  const [message, setMessage] = useState<Message | null>(null)

  // メッセージの自動消去
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    
    if (message && (message.type === 'success' || message.type === 'info') && !message.persistent) {
      // 新しいタイマーをセットする前に既存のタイマーをクリア
      if (timer) clearTimeout(timer);
      
      timer = setTimeout(() => {
        setMessageWithStability(null)
      }, 3000)
    }
    
    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [message])

  // メッセージ設定用のラッパー関数を追加
  const setMessageWithStability = (newMessage: Message | null) => {
    // 現在のメッセージと同じタイプで同じテキストの場合は更新しない
    if (newMessage && message && 
        newMessage.type === message.type && 
        newMessage.text === message.text) {
      return;
    }
    
    // メッセージを更新する前に、既存のメッセージをクリア
    setMessage(null);
    
    // 少し遅延させて新しいメッセージを設定
    setTimeout(() => {
      setMessage(newMessage);
    }, 100);
  }

  // メッセージを閉じる処理
  const handleCloseMessage = () => {
    setMessageWithStability(null);
  };

  // ユーザー情報の取得
  useEffect(() => {
    const storedUserInfo = sessionStorage.getItem('userProfile')
    if (storedUserInfo) {
      const userProfile = JSON.parse(storedUserInfo)
      setUserProfile(userProfile)
    }
  }, [])

  // 部署一覧の取得
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        // テーブルが存在するか確認
        const { error: checkError } = await supabase
          .from('branch_master')
          .select('count')
          .limit(1)
          .single()
        
        if (checkError && checkError.code === '42P01') {
          console.warn('所属テーブルが存在しません。メニュー項目のみ表示します。')
          setBranches([])
          return
        }
        
        const { data, error } = await supabase
          .from('branch_master')
          .select('code, name_jp')
          .order('code')

        if (error) throw error

        if (data) {
          setBranches(data.map(branch => ({
            code: branch.code,
            name: branch.name_jp
          })))
        }
      } catch (error) {
        console.error('所属データの取得に失敗しました:', error)
        // エラーが発生しても処理を続行できるようにする
        setBranches([])
      }
    }

    fetchBranches()
  }, [toast])

  // 検索条件のクリア
  const handleClearSearch = () => {
    setEmployeeId("")
    setBranchCode("")
    setEmployeeName("")
    setSelectedStatus("")
  }

  // 勤怠データの検索
  const handleSearch = async () => {
    setIsLoading(true)
    try {
      console.log('検索開始:', {
        year: selectedYear,
        month: selectedMonth,
        status: selectedStatus
      })

      // 検索条件の構築
      let query = supabase
        .from('attendance_headers')
        .select(`
          id,
          year,
          month,
          user_id,
          status,
          total_working_days,
          holiday_working_days,
          absence_days,
          total_working_hours,
          late_early_hours,
          paid_leave_days
        `)
        .eq('year', selectedYear)
        .eq('month', selectedMonth)

      // 追加の検索条件
      if (selectedStatus && selectedStatus !== '_all') {
        query = query.eq('status', selectedStatus)
      }

      console.log('クエリ実行前')
      const { data, error } = await query
      console.log('クエリ実行結果:', { data, error })

      if (error) {
        console.error('勤怠データの検索に失敗しました:', error)
        setMessageWithStability({
          type: 'error',
          text: '勤怠データの検索に失敗しました',
          dismissible: true,
          persistent: true
        })
        return
      }

      if (!data || data.length === 0) {
        console.log('データが見つかりません')
        setAttendanceSummaries([])
        setMessageWithStability({
          type: 'info',
          text: '該当するデータが見つかりませんでした'
        })
        return
      }

      console.log('データ処理開始:', data.length, '件')

      // 結果のフォーマット
      const formattedData = await Promise.all(data.map(async (item) => {
        try {
          console.log('ユーザー情報取得開始:', item.user_id)
          // ユーザー情報の取得
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('employee_id, first_name, last_name, branch')
            .eq('id', item.user_id)
            .single()
          
          console.log('ユーザー情報取得結果:', { userData, userError })
          
          if (userError) {
            console.warn(`ユーザー情報の取得に失敗: ${item.user_id}`, userError)
            return null
          }
          
          // 所属情報の取得
          let branchName = '不明'
          try {
            const { data: branchData, error: branchError } = await supabase
              .from('branch_master')
              .select('name_jp')
              .eq('code', userData.branch)
              .single()
            
            if (!branchError && branchData) {
              branchName = branchData.name_jp
            }
          } catch (branchErr) {
            console.warn('所属情報の取得に失敗:', branchErr)
          }

          // 所属・ユーザー検索条件のフィルタリング
          if (employeeId && userData.employee_id !== employeeId) {
            return null
          }
          
          if (branchCode && branchCode !== '_all' && userData.branch !== branchCode) {
            return null
          }
          
          if (employeeName && 
              !(userData.first_name?.includes(employeeName) || 
                userData.last_name?.includes(employeeName))) {
            return null
          }

          // 承認情報の取得
          let leaderApproval = null
          let adminApproval = null

          try {
            console.log('承認情報の取得開始:', item.id);
            
            // クエリを構築
            const query = supabase
              .from('attendance_approvals')
              .select(`
                id,
                process_type,
                result_code,
                approved_at,
                approved_by,
                header_id
              `)
              .eq('header_id', item.id)
              .order('approved_at', { ascending: true });
            
            // クエリのデバッグ
            console.log('承認情報クエリ:', query);
            
            const { data: approvalData, error: approvalError } = await query;
            
            // 結果のデバッグ
            console.log('承認情報取得結果:', { approvalData, error: approvalError });
            
            if (approvalError) {
              throw approvalError;
            }

            if (approvalData && approvalData.length > 0) {
              // リーダー承認情報の取得
              const leaderApprovalData = approvalData.find(
                approval => approval.process_type === 'leader' && approval.result_code === 'approved'
              )
              if (leaderApprovalData) {
                const { data: leaderData } = await supabase
                  .from('users')
                  .select('first_name, last_name')
                  .eq('id', leaderApprovalData.approved_by)
                  .single()

                leaderApproval = {
                  approved_at: leaderApprovalData.approved_at,
                  approved_by: leaderApprovalData.approved_by,
                  approved_by_name: leaderData ? `${leaderData.last_name} ${leaderData.first_name}` : null
                }
              }

              // 総務承認情報の取得
              const adminApprovalData = approvalData.find(
                approval => approval.process_type === 'admin' && approval.result_code === 'approved'
              )
              if (adminApprovalData) {
                const { data: adminData } = await supabase
                  .from('users')
                  .select('first_name, last_name')
                  .eq('id', adminApprovalData.approved_by)
                  .single()

                adminApproval = {
                  approved_at: adminApprovalData.approved_at,
                  approved_by: adminApprovalData.approved_by,
                  approved_by_name: adminData ? `${adminData.last_name} ${adminData.first_name}` : null
                }
              }
            }
          } catch (approvalErr) {
            console.warn('承認情報の取得に失敗:', approvalErr)
          }

          return {
            id: item.id,
            year: item.year,
            month: item.month,
            user_id: item.user_id,
            employee_id: userData.employee_id || '不明',
            branch_code: userData.branch || '不明',
            branch_name: branchName,
            user_name: userData.last_name && userData.first_name ? 
                       `${userData.last_name} ${userData.first_name}` : '不明',
            status: item.status,
            leader_approved_at: leaderApproval?.approved_at || null,
            leader_approved_by: leaderApproval?.approved_by || null,
            leader_approved_by_name: leaderApproval?.approved_by_name || null,
            admin_approved_at: adminApproval?.approved_at || null,
            admin_approved_by: adminApproval?.approved_by || null,
            admin_approved_by_name: adminApproval?.approved_by_name || null,
            total_working_days: item.total_working_days || 0,
            holiday_working_days: item.holiday_working_days || 0,
            absence_days: item.absence_days || 0,
            total_working_hours: item.total_working_hours || 0,
            late_early_hours: item.late_early_hours || 0,
            paid_leave_days: item.paid_leave_days || 0
          }
        } catch (itemError) {
          console.error('データ処理中にエラーが発生:', itemError)
          return null
        }
      }))

      // nullをフィルタリングして結果を設定
      const filteredData = formattedData.filter(item => item !== null) as AttendanceSummary[]
      console.log('フィルタリング後のデータ:', filteredData.length, '件')
      setAttendanceSummaries(filteredData)

      if (filteredData.length === 0) {
        setMessageWithStability({
          type: 'info',
          text: '該当するデータが見つかりませんでした'
        })
      } else {
        setMessageWithStability({
          type: 'success',
          text: `${filteredData.length}件のデータが見つかりました`
        })
      }
    } catch (error) {
      console.error('勤怠データの検索に失敗しました:', error)
      setMessageWithStability({
        type: 'error',
        text: '勤怠データの検索に失敗しました',
        dismissible: true,
        persistent: true
      })
    } finally {
      setIsLoading(false)
    }
  }

  // 状態名を取得する関数
  const getStatusName = (statusCode: string): string => {
    const status = statusOptions.find(s => s.value === statusCode)
    return status ? status.label : "不明"
  }

  // 勤怠詳細画面に遷移
  const handleRowClick = (headerId: string, userId: string) => {
    router.push(`/approve-attendance/detail?id=${headerId}&user_id=${userId}`)
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
      error: <AlertCircleIcon className="h-5 w-5 text-red-500" />,
      info: <Info className="h-5 w-5 text-blue-500" />
    }

    // 改行を含むメッセージを処理
    const formattedMessage = message.text.split('\n').map((line, index) => (
      <React.Fragment key={index}>
        {line}
        {index < message.text.split('\n').length - 1 && <br />}
      </React.Fragment>
    ));

    return (
      <div className="fixed top-16 left-0 right-0 z-[100] flex justify-center pointer-events-none">
        <AnimatePresence mode="wait">
          {message && (
            <motion.div
              key={message.text} // キーを追加してアニメーションを強制
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
              <span className="text-sm font-medium whitespace-pre-line">{formattedMessage}</span>
              {message.dismissible && (
                <button
                  onClick={handleCloseMessage}
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Clock className="h-8 w-8 text-blue-600" />
          勤怠承認
        </h1>
        <p className="text-muted-foreground">
          メンバーの勤怠情報を確認・承認します
        </p>
      </div>

      <MessageAlert />

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-6">
            {/* 検索条件 */}
            <div className="flex flex-wrap items-end gap-4">
              <div className="w-[280px]">
                <Label className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4 text-blue-600" />
                  年月
                </Label>
                <div className="flex items-center gap-2">
                  <Select
                    value={selectedYear.toString()}
                    onValueChange={(value) => setSelectedYear(parseInt(value))}
                  >
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map(year => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}年
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={selectedMonth.toString()}
                    onValueChange={(value) => setSelectedMonth(parseInt(value))}
                  >
                    <SelectTrigger className="w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {months.map(month => (
                        <SelectItem key={month} value={month.toString()}>
                          {month}月
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="w-[150px]">
                <Label className="flex items-center gap-2 mb-2">
                  <IdCard className="h-4 w-4 text-blue-600" />
                  社員番号
                </Label>
                <Input
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  placeholder="社員番号を入力"
                />
              </div>

              <div className="w-[200px]">
                <Label className="flex items-center gap-2 mb-2">
                  <Building2 className="h-4 w-4 text-blue-600" />
                  所属
                </Label>
                <Select
                  value={branchCode}
                  onValueChange={(value) => setBranchCode(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="所属を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">すべて</SelectItem>
                    {branches.map(branch => (
                      <SelectItem key={branch.code} value={branch.code}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-[200px]">
                <Label className="flex items-center gap-2 mb-2">
                  <User className="h-4 w-4 text-blue-600" />
                  氏名
                </Label>
                <Input
                  value={employeeName}
                  onChange={(e) => setEmployeeName(e.target.value)}
                  placeholder="氏名を入力"
                />
              </div>

              <div className="w-[200px]">
                <Label className="flex items-center gap-2 mb-2">
                  <Activity className="h-4 w-4 text-blue-600" />
                  ステータス
                </Label>
                <Select
                  value={selectedStatus}
                  onValueChange={(value) => setSelectedStatus(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="ステータスを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end gap-2">
                <Button
                  onClick={handleSearch}
                  disabled={isLoading}
                  className="bg-blue-600 hover:bg-blue-700 h-10"
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      検索中...
                    </div>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      検索
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleClearSearch}
                  variant="outline"
                  className="h-10"
                >
                  <X className="h-4 w-4 mr-2" />
                  クリア
                </Button>
              </div>
            </div>

            {/* 検索結果 */}
            <div className="mt-8">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <ListChecks className="h-5 w-5 text-blue-600" />
                検索結果
              </h2>
              
              <div className="border rounded-lg overflow-hidden">
                <div className="grid grid-cols-12 gap-0 p-3 bg-blue-50 border-b text-sm font-medium text-blue-900">
                  <div className="col-span-1">年月</div>
                  <div className="col-span-1">社員番号</div>
                  <div className="col-span-1">所属</div>
                  <div className="col-span-1">氏名</div>
                  <div className="col-span-1">ステータス</div>
                  <div className="col-span-2">リーダー確認</div>
                  <div className="col-span-2">総務確認</div>
                  <div className="col-span-3">勤怠サマリー</div>
                </div>

                <div className="divide-y divide-gray-100">
                  {attendanceSummaries.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 flex items-center justify-center gap-2">
                      <SearchX className="h-4 w-4" />
                      検索結果がありません
                    </div>
                  ) : (
                    attendanceSummaries.map((summary) => (
                      <div
                        key={summary.id}
                        className="grid grid-cols-12 gap-0 p-3 hover:bg-blue-50/50 cursor-pointer transition-colors"
                        onClick={() => handleRowClick(summary.id, summary.user_id)}
                      >
                        <div className="col-span-1 flex items-center text-sm">{summary.year}年{summary.month}月</div>
                        <div className="col-span-1 flex items-center text-sm">{summary.employee_id}</div>
                        <div className="col-span-1 flex items-center text-sm">{summary.branch_name}</div>
                        <div className="col-span-1 flex items-center text-sm">{summary.user_name}</div>
                        <div className="col-span-1 flex items-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium ${
                            summary.status === '02' ? 'bg-green-100 text-green-800' :
                            summary.status === '01' ? 'bg-blue-100 text-blue-800' :
                            summary.status === '00' ? 'bg-yellow-100 text-yellow-800' :
                            summary.status === '03' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {getStatusName(summary.status)}
                          </span>
                        </div>
                        <div className="col-span-2 flex items-center">
                          <div className="text-xs space-y-1">
                            <div>完了日: {summary.leader_approved_at ? new Date(summary.leader_approved_at).toLocaleDateString('ja-JP') : '未確認'}</div>
                            <div>実施者: {summary.leader_approved_by_name || '未確認'}</div>
                          </div>
                        </div>
                        <div className="col-span-2 flex items-center">
                          <div className="text-xs space-y-1">
                            <div>完了日: {summary.admin_approved_at ? new Date(summary.admin_approved_at).toLocaleDateString('ja-JP') : '未確認'}</div>
                            <div>実施者: {summary.admin_approved_by_name || '未確認'}</div>
                          </div>
                        </div>
                        <div className="col-span-3 flex items-center">
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5 text-blue-600" />
                              総勤務: {summary.total_working_days}日
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5 text-blue-600" />
                              休日: {summary.holiday_working_days}日
                            </div>
                            <div className="flex items-center gap-1">
                              <XCircle className="h-3.5 w-3.5 text-red-600" />
                              欠勤: {summary.absence_days}日
                            </div>
                            <div className="flex items-center gap-1">
                              <Timer className="h-3.5 w-3.5 text-blue-600" />
                              総時間: {summary.total_working_hours}h
                            </div>
                            <div className="flex items-center gap-1">
                              <AlertCircle className="h-3.5 w-3.5 text-yellow-600" />
                              遅早: {summary.late_early_hours}h
                            </div>
                            <div className="flex items-center gap-1">
                              <Sun className="h-3.5 w-3.5 text-green-600" />
                              有休: {summary.paid_leave_days}日
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}