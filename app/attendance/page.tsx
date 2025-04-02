"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import React from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parse, differenceInMinutes, isWeekend } from "date-fns"
import { ja } from "date-fns/locale/ja"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Clock, Save, AlertCircle, CheckCircle2, Info, X, CheckSquare, Edit, 
  Calendar, Building2, User, Briefcase, CalendarCheck, CalendarX, 
  Clock4, Timer, CalendarClock, CalendarDays, AlertTriangle, 
  CheckCircle, XCircle, ArrowLeftRight, CalendarPlus, Plus, Trash2, Bus, FileText, Eye, Upload, CreditCard, Repeat, RotateCcw } from "lucide-react"
import { useI18n } from "@/lib/i18n/context"
import { supabase } from '@/lib/supabaseClient'
import { AnimatePresence, motion } from "framer-motion"
import { saveExpenseData, fetchExpenseData, type ReceiptRecord } from './expense-api'
import type { CommuteExpense, BusinessExpense } from "./expense-api"
import { v4 as uuidv4 } from 'uuid'

interface UserInfo {
  id: string;  // users.id
  employee_id: string;
  branch_code: string;  // branch_code を追加
  branch_name_jp: string;
  branch_name_en: string;
  first_name: string;
  last_name: string;
  first_name_en: string;
  last_name_en: string;
}

// 年の選択肢
const years = Array.from({ length: 3 }, (_, i) => 2024 + i)

// 月の選択肢
const months = Array.from({ length: 12 }, (_, i) => i + 1)

// 時間文字列のフォーマット
const formatTimeString = (value: string): string => {
  // 数字以外を削除
  const numbers = value.replace(/[^\d]/g, '')
  
  if (numbers.length >= 4) {
    const hours = parseInt(numbers.substring(0, 2))
    const minutes = parseInt(numbers.substring(2, 4))
    
    // 時間と分が有効な範囲内かチェック
    if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
    }
    // 無効な時刻の場合は空文字を返す
    return ""
  }
  return value
}

// 実働時間の計算
const calculateActualTime = (startTime: string, endTime: string, breakTime: string): string => {
  if (!startTime || !endTime || !breakTime) return ""

  // 時刻形式のバリデーション（HH:MM形式かどうか）
  const timePattern = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/
  if (!timePattern.test(startTime) || !timePattern.test(endTime)) {
    return ""
  }

  try {
    const start = parse(startTime, 'HH:mm', new Date())
    const end = parse(endTime, 'HH:mm', new Date())
    const [breakHours, breakMinutes] = breakTime.split(':').map(Number)
    
    // 休憩時間の検証
    if (isNaN(breakHours) || isNaN(breakMinutes) || 
        breakHours < 0 || breakHours >= 24 || 
        breakMinutes < 0 || breakMinutes >= 60) {
      return ""
    }
    
    const breakTimeInMinutes = breakHours * 60 + breakMinutes
    const totalMinutes = differenceInMinutes(end, start) - breakTimeInMinutes

    if (totalMinutes <= 0) return "00:00"

    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
  } catch (error) {
    console.error("実働時間計算エラー:", error)
    return ""
  }
}

// 時間の合計を計算（HH:MM形式の文字列の配列から）
const sumTimes = (times: string[]): string => {
  const totalMinutes = times.reduce((acc, time) => {
    if (!time) return acc
    const [hours, minutes] = time.split(':').map(Number)
    return acc + (hours * 60 + minutes)
  }, 0)

  // 時間を小数点形式で返す（例: 12.5時間）
  const hours = Math.floor(totalMinutes / 60)
  const minutesDecimal = ((totalMinutes % 60) / 60).toFixed(1).substring(2)
  return `${hours}.${minutesDecimal}`
}

// レコードの型定義を追加
interface AttendanceRecord {
  id: string
  user_id: string
  date: string
  start_time: string
  end_time: string
  break_time: string
  actual_time: string
  type: string
  remarks: string
  late_early_hours: string
  work_type: {
    code: string
    name: string
  }
}

// メッセージの型を拡張
interface Message {
  type: 'success' | 'error' | 'info'
  text: string
  details?: any  // エラーの詳細情報
  persistent?: boolean  // フェードアウトしないフラグ
  position?: 'top' | 'bottom' | 'center'  // 表示位置
  alignment?: 'left' | 'center'  // 文字寄せ
  dismissible?: boolean  // 手動で消せるフラグ
}

// 経費の型定義を追加
interface ExpenseRecord {
  id: string;
  date: string;
  transportation: string;
  from: string;
  to: string;
  type: string;
  roundTrip: string;
  amount: number;
  remarks: string; // 備考は必須フィールドとして定義
  category: 'commute' | 'business';
}

const commuteTypes = [
  { value: 'regular', label: '定期' },
  { value: 'ticket', label: '切符' },
  { value: 'parking', label: '駐輪場' },
  { value: 'gasoline', label: 'ガソリン' },
  { value: 'other', label: 'その他' }
]

const businessTypes = [
  { value: 'with-receipt', label: '経費（領収書有り）' },
  { value: 'without-receipt', label: '経費（領収書無し）' },
  { value: 'accommodation', label: '宿泊費' },
  { value: 'per-diem', label: '宿泊日当' }
]

const roundTripTypes = [
  { value: 'one-way', label: '片道' },
  { value: 'round-trip', label: '往復' },
  { value: 'other', label: 'その他' }
]

// 通勤手当の型はAPI用とコンポーネント用で異なるため、型エイリアスを作成
type ExpenseItem = {
  id: string;
  date: string;
  transportation: string;
  from: string;
  to: string;
  type: string; // APIでは expenseType
  roundTrip: string; // APIでは roundTripType
  amount: number;
  remarks: string;
};

// 祝日データの型定義
interface Holiday {
  date: string;  // YYYY-MM-DD形式
  name: string;
}

// 祝日データ（2024年-2025年）
const HOLIDAYS: Holiday[] = [
  // 2024年
  { date: '2024-01-01', name: '元日' },
  { date: '2024-01-08', name: '成人の日' },
  { date: '2024-02-11', name: '建国記念の日' },
  { date: '2024-02-12', name: '建国記念の日 振替休日' },
  { date: '2024-03-20', name: '春分の日' },
  { date: '2024-04-29', name: '昭和の日' },
  { date: '2024-05-03', name: '憲法記念日' },
  { date: '2024-05-04', name: 'みどりの日' },
  { date: '2024-05-05', name: 'こどもの日' },
  { date: '2024-05-06', name: 'こどもの日 振替休日' },
  { date: '2024-07-15', name: '海の日' },
  { date: '2024-08-11', name: '山の日' },
  { date: '2024-08-12', name: '山の日 振替休日' },
  { date: '2024-09-16', name: '敬老の日' },
  { date: '2024-09-22', name: '秋分の日' },
  { date: '2024-09-23', name: '秋分の日 振替休日' },
  { date: '2024-10-14', name: 'スポーツの日' },
  { date: '2024-11-03', name: '文化の日' },
  { date: '2024-11-04', name: '文化の日 振替休日' },
  { date: '2024-12-23', name: '天皇誕生日' },
  { date: '2024-12-30', name: '年末年始休暇' },
  { date: '2024-12-31', name: '年末年始休暇' },
  // 2025年
  { date: '2025-01-01', name: '元日' },
  { date: '2025-01-13', name: '成人の日' },
  { date: '2025-02-11', name: '建国記念の日' },
  { date: '2025-03-20', name: '春分の日' },
  { date: '2025-04-29', name: '昭和の日' },
  { date: '2025-05-03', name: '憲法記念日' },
  { date: '2025-05-04', name: 'みどりの日' },
  { date: '2025-05-05', name: 'こどもの日' },
  { date: '2025-05-06', name: 'こどもの日 振替休日' },
  { date: '2025-07-21', name: '海の日' },
  { date: '2025-08-11', name: '山の日' },
  { date: '2025-09-15', name: '敬老の日' },
  { date: '2025-09-23', name: '秋分の日' },
  { date: '2025-10-13', name: 'スポーツの日' },
  { date: '2025-11-03', name: '文化の日' },
  { date: '2025-11-24', name: '勤労感謝の日' },
  { date: '2025-12-23', name: '天皇誕生日' },
  { date: '2025-12-31', name: '年末年始休暇' },
];

// 祝日判定関数
const isJapaneseHoliday = (date: Date): boolean => {
  const dateString = format(date, 'yyyy-MM-dd');
  return HOLIDAYS.some(holiday => holiday.date === dateString);
};

// 祝日名取得関数
const getHolidayName = (date: Date): string | null => {
  const dateString = format(date, 'yyyy-MM-dd');
  const holiday = HOLIDAYS.find(h => h.date === dateString);
  return holiday ? holiday.name : null;
};

// グローバル変数としてメッセージ表示フラグを追加
let isSearchingMessageShown = false;
// 初期ロード完了フラグ（重複実行防止用）
let initialLoadCompleted = false;

export default function AttendancePage() {
  const { t } = useI18n()
  // 初期日付を設定（現在の日付から1日を引いて、前月の最終日を設定）
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [workplace, setWorkplace] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [message, setMessage] = useState<Message | null>(null)
  const [attendanceData, setAttendanceData] = useState<{
    [key: string]: {
      startTime: string
      endTime: string
      breakTime: string
      actualTime: string
      type: string
      remarks: string
      lateEarlyHours: string
    }
  }>({})
  const [branchInfo, setBranchInfo] = useState<{ name: string; code: string } | null>(null)
  const [status, setStatus] = useState<string>("00")
  const [errorDates, setErrorDates] = useState<Set<string>>(new Set())
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([])
  const [isAddingExpense, setIsAddingExpense] = useState(false)
  const [newExpense, setNewExpense] = useState<Partial<ExpenseRecord>>({
    category: 'commute'
  })
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [expenseValidationError, setExpenseValidationError] = useState<string | null>(null)
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null)
  const [currentTab, setCurrentTab] = useState("attendance")
  const [receipts, setReceipts] = useState<ReceiptRecord[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptRecord | null>(null)
  const [showReceiptViewer, setShowReceiptViewer] = useState(false)
  const [showReceiptInput, setShowReceiptInput] = useState(false)
  const [newReceipt, setNewReceipt] = useState<Partial<ReceiptRecord>>({
    id: Date.now().toString(),
    fileName: '',
    fileUrl: '',
    filePath: '',
    remarks: '',
    uploadedAt: new Date().toISOString()
  })
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [holidayMasterData, setHolidayMasterData] = useState<string[]>([]) // holiday_masterから取得した休日データ

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })

  // 勤務状況のサマリーを計算
  const summary = useMemo(() => {
    const entries = Object.entries(attendanceData)
    const workingDays = entries.filter(([_, data]) => data.actualTime && data.actualTime !== "00:00")
    const regularWorkDays = workingDays.filter(([_, data]) => 
      !["holiday-work", "paid-leave", "am-leave", "pm-leave", "special-leave", 
        "compensatory-leave", "compensatory-leave-planned", "absence", "late", 
        "early-leave", "delay", "shift", "business-holiday"].includes(data.type || ""))
    const holidayWorkDays = workingDays.filter(([_, data]) => data.type === "holiday-work")
    const absenceDays = entries.filter(([_, data]) => data.type === "absence")
    const actualTimes = workingDays.map(([_, data]) => data.actualTime)
    const lateEarlyHours = entries.reduce((acc, [_, data]) => {
      const hours = parseFloat(data.lateEarlyHours || "0")
      return acc + (isNaN(hours) ? 0 : hours)
    }, 0)
    const paidLeaveDays = entries.reduce((acc, [_, data]) => {
      if (data.type === "paid-leave") return acc + 1
      if (data.type === "am-leave" || data.type === "pm-leave") return acc + 0.5
      return acc
    }, 0)

    return {
      totalWorkDays: workingDays.length,
      regularWorkDays: regularWorkDays.length,
      holidayWorkDays: holidayWorkDays.length,
      absenceDays: absenceDays.length,
      totalWorkTime: sumTimes(actualTimes),
      lateEarlyHours: lateEarlyHours.toFixed(1),
      paidLeaveDays
    }
  }, [attendanceData])

  // 経費の合計を計算
  const expenseSummary = useMemo(() => {
    const commuteTotal = expenses
      .filter(expense => expense.category === 'commute')
      .reduce((sum, expense) => sum + expense.amount, 0)

    const businessTotal = expenses
      .filter(expense => expense.category === 'business')
      .reduce((sum, expense) => sum + expense.amount, 0)

    return {
      commuteTotal,
      businessTotal
    }
  }, [expenses])

  // 時間入力の変更ハンドラー
  const handleTimeChange = (
    day: Date,
    field: string,
    value: string
  ) => {
    const dateKey = format(day, 'yyyy-MM-dd')
    const currentData = attendanceData[dateKey] || {
      startTime: '',
      endTime: '',
      breakTime: '',
      actualTime: '',
      type: 'none',
      remarks: '',
      lateEarlyHours: ''
    }

    let newData = { ...currentData }

    if (field === 'startTime' || field === 'endTime' || field === 'breakTime') {
      // 時間のフォーマット
      newData[field as keyof typeof newData] = formatTimeString(value)
      
      // 値が空になった場合は実働時間をクリア
      if (!value.trim()) {
        newData.actualTime = ''
      }
      // 入力値が変更された場合で、3つの時間項目が全て入力済みなら実働時間を計算
      else if (
        (field === 'startTime' && newData.endTime && newData.breakTime) || 
        (field === 'endTime' && newData.startTime && newData.breakTime) || 
        (field === 'breakTime' && newData.startTime && newData.endTime)
      ) {
        const actualTime = calculateActualTime(
          newData.startTime,
          newData.endTime,
          newData.breakTime
        )
        if (actualTime) {
          newData.actualTime = actualTime
        }
      }
    } else {
      // その他のフィールド
      newData[field as keyof typeof newData] = value
    }

    setAttendanceData((prev: typeof attendanceData) => ({
      ...prev,
      [dateKey]: newData
    }))
  }

  // 時間入力のフォーカスが外れた時のハンドラー
  const handleTimeBlur = (day: Date) => {
    const dateKey = format(day, 'yyyy-MM-dd')
    const currentData = attendanceData[dateKey]
    
    if (!currentData) return
    
    // 開始時間、終了時間、休憩時間が全て入力されている場合のみ実働時間を計算
    if (currentData.startTime && currentData.endTime && currentData.breakTime) {
      const actualTime = calculateActualTime(
        currentData.startTime,
        currentData.endTime,
        currentData.breakTime
      )
      
      // 計算結果が有効な場合のみ更新
      if (actualTime) {
        setAttendanceData((prev: typeof attendanceData) => ({
          ...prev,
          [dateKey]: {
            ...prev[dateKey],
            actualTime
          }
        }))
      }
    } else {
      // いずれかの値が空の場合は実働時間をクリア
      setAttendanceData((prev: typeof attendanceData) => ({
        ...prev,
        [dateKey]: {
          ...prev[dateKey],
          actualTime: ''
        }
      }))
    }
  }

  // メッセージ設定用のラッパー関数を改良
  const setMessageWithStability = (newMessage: Message | null) => {
    // 「データを検索中です」メッセージの場合、グローバル変数でフラグ管理
    if (newMessage && newMessage.text === 'データを検索中です...') {
      if (isSearchingMessageShown) {
        // すでに表示中なら何もしない
        console.log('すでに検索中メッセージが表示されているため、重複を防止します');
        return;
      }
      isSearchingMessageShown = true;
    }
    
    // メッセージをクリアする場合、検索中フラグもリセット
    if (newMessage === null && isSearchingMessageShown) {
      isSearchingMessageShown = false;
    }
    
    // 現在のメッセージと同じタイプで同じテキストの場合は更新しない
    if (newMessage && message && 
        newMessage.type === message.type && 
        newMessage.text === message.text) {
      return;
    }
    
    // メッセージを直接設定（遅延なし）
    setMessage(newMessage);
  }

  // メッセージを閉じる処理
  const handleCloseMessage = () => {
    setMessageWithStability(null);
  }

  // ステータスを次に進める関数
  const moveToNextStatus = () => {
    // 現在のステータスに応じて次のステータスを設定
    switch (status) {
      case '00': // 下書きから申請中へ
        setStatus('01');
        break;
      case '03': // 差戻しから申請中へ
        setStatus('01');
        break;
      default:
        // その他のステータスは変更しない
        break;
    }
  }

  // ステータスを下書きに戻す関数
  const moveToEditStatus = async () => {
    try {
      // データベースのステータスを更新
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;

      const { data: existingHeader, error: headerError } = await supabase
        .from('attendance_headers')
        .select('*')
        .eq('user_id', userInfo?.id)
        .eq('year', year)
        .eq('month', month)
        .single();

      if (headerError && headerError.code !== 'PGRST116') {
        throw new Error('ヘッダーデータの取得に失敗しました');
      }

      if (existingHeader) {
        const { error: updateError } = await supabase
          .from('attendance_headers')
          .update({
            status: '00',
            updated_at: new Date().toISOString()
          })
          .eq('id', existingHeader.id);

        if (updateError) {
          throw new Error('ステータスの更新に失敗しました');
        }
      }

      // 画面のステータスを更新
      setStatus('00');
      setMessageWithStability({ 
        type: 'success', 
        text: '再編集モードに変更しました',
        position: 'bottom'
      });
    } catch (error) {
      console.error('再編集モードへの切り替えでエラーが発生しました:', error);
      setMessageWithStability({ 
        type: 'error', 
        text: '再編集モードへの切り替えに失敗しました',
        persistent: true
      });
    }
  }

  // 編集可能かどうかを判定する関数
  const isEditable = () => {
    return status === '00' || status === '03';
  }

  // チェックボタンの処理
  const handleCheck = async () => {
    if (!userInfo?.id || !branchInfo?.code) {
      console.error('チェックエラー: ユーザー情報または所属情報が不足しています', { userInfo, branchInfo });
      setMessageWithStability({ 
        type: 'error', 
        text: 'ユーザー情報または所属情報が取得できません。再ログインしてください。',
        persistent: true
      });
      return;
    }

    // バリデーションエラーメッセージを格納する配列
    const validationErrors: string[] = [];
    const newErrorDates = new Set<string>();

    // 入力データのバリデーションチェック
    Object.entries(attendanceData).forEach(([date, data]) => {
      const { startTime, endTime, breakTime, remarks, type, lateEarlyHours } = data;
      const dateDisplay = format(new Date(date), 'M/d');

      // 時刻形式のバリデーション（HH:MM形式かどうか）
      const timePattern = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/;
      
      // 開始時間のチェック
      if (startTime && !timePattern.test(startTime)) {
        validationErrors.push(`${dateDisplay}の開始時間「${startTime}」が正しい形式（HH:MM）ではありません。`);
        newErrorDates.add(date);
      }
      
      // 終了時間のチェック
      if (endTime && !timePattern.test(endTime)) {
        validationErrors.push(`${dateDisplay}の終了時間「${endTime}」が正しい形式（HH:MM）ではありません。`);
        newErrorDates.add(date);
      }
      
      // 開始時間と終了時間の逆転チェック
      if (startTime && endTime && timePattern.test(startTime) && timePattern.test(endTime)) {
        const start = parse(startTime, 'HH:mm', new Date());
        const end = parse(endTime, 'HH:mm', new Date());
        
        if (end < start) {
          validationErrors.push(`${dateDisplay}の終了時間（${endTime}）が開始時間（${startTime}）より前になっています。`);
          newErrorDates.add(date);
        }
      }

      // 入力項目がある場合の必須チェック
      if (startTime || endTime || breakTime || remarks || type !== 'none' || lateEarlyHours) {
        if (!startTime || !endTime || !breakTime || !remarks) {
          validationErrors.push(`${dateDisplay}の入力が不完全です。全ての項目を入力してください。`);
          newErrorDates.add(date);
        }
      }
    });

    // エラー日付を更新
    setErrorDates(newErrorDates);

    // バリデーションエラーがある場合は処理を中断
    if (validationErrors.length > 0) {
      setMessageWithStability({ 
        type: 'error', 
        text: `以下のエラーを修正してください：\n${validationErrors.join('\n')}`,
        persistent: true,
        position: 'top'
      });
      return;
    }

    try {
      // データベースに保存（チェックボタン用のパラメータをtrueで渡す）
      await handleSaveData(true);
      
      // 保存成功時にエラー表示をクリア
      setErrorDates(new Set<string>());
      
      // 成功メッセージを表示
      setMessageWithStability({ 
        type: 'success', 
        text: 'チェックが完了し、申請中ステータスに更新しました。',
        position: 'bottom'
      });
    } catch (error) {
      console.error('チェック処理でエラーが発生しました:', error);
      setMessageWithStability({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'チェック処理に失敗しました',
        persistent: true,
        position: 'top'
      });
    }
  }

  // 保存処理のロジックを分離
  const handleSaveData = async (isCheck: boolean = false) => {
    if (!userInfo?.id || !branchInfo?.code) {
      console.error('保存エラー: ユーザー情報または所属情報が不足しています', { userInfo, branchInfo });
      setMessageWithStability({ 
        type: 'error', 
        text: 'ユーザー情報または所属情報が取得できません。再ログインしてください。',
        persistent: true
      });
      return;
    }

    try {
      // 保存対象の年月を取得
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;

      // ヘッダーデータの保存
      const headerData = {
        user_id: userInfo.id,
        year: year,
        month: month,
        branch_code: branchInfo.code,
        status: isCheck ? '01' : '00', // チェックボタンの場合は01、それ以外は00
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // 既存のヘッダーデータを確認
      const { data: existingHeader, error: headerError } = await supabase
        .from('attendance_headers')
        .select('*')
        .eq('user_id', userInfo.id)
        .eq('year', year)
        .eq('month', month)
        .single();

      if (headerError && headerError.code !== 'PGRST116') {
        console.error('ヘッダーデータの取得エラー:', headerError);
        throw new Error('ヘッダーデータの取得に失敗しました');
      }

      let headerId: string;
      if (existingHeader) {
        // 既存のヘッダーデータを更新
        const { error: updateError } = await supabase
          .from('attendance_headers')
          .update({
            status: isCheck ? '01' : '00', // チェックボタンの場合は01、それ以外は00
            updated_at: new Date().toISOString()
          })
          .eq('id', existingHeader.id);

        if (updateError) {
          console.error('ヘッダーデータの更新エラー:', updateError);
          throw new Error('ヘッダーデータの更新に失敗しました');
        }
        headerId = existingHeader.id;
      } else {
        // 新規ヘッダーデータを作成
        const { data: newHeader, error: insertError } = await supabase
          .from('attendance_headers')
          .insert([headerData])
          .select()
          .single();

        if (insertError) {
          console.error('ヘッダーデータの作成エラー:', insertError);
          throw new Error('ヘッダーデータの作成に失敗しました');
        }
        headerId = newHeader.id;
      }

      // 詳細データの保存
      const detailData = Object.entries(attendanceData).map(([date, data]) => ({
        header_id: headerId,
        date: date,
        start_time: data.startTime || null,
        end_time: data.endTime || null,
        break_time: convertBreakTimeToMinutes(data.breakTime),
        remarks: data.remarks || null,
        work_type_code: data.type === 'none' ? '01' : convertTypeToCode(data.type),
        late_early_hours: data.lateEarlyHours ? parseFloat(data.lateEarlyHours) : null,
        actual_working_hours: convertTimeToHours(data.actualTime),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: userInfo.id,
        updated_by: userInfo.id
      }));

      // 既存の詳細データを削除
      const { error: deleteError } = await supabase
        .from('attendance_details')
        .delete()
        .eq('header_id', headerId);

      if (deleteError) {
        console.error('詳細データの削除エラー:', deleteError);
        throw new Error('詳細データの削除に失敗しました');
      }

      // 新規詳細データを作成
      const { error: insertError } = await supabase
        .from('attendance_details')
        .insert(detailData);

      if (insertError) {
        console.error('詳細データの作成エラー:', insertError);
        throw new Error('詳細データの作成に失敗しました');
      }

      // ステータスを更新
      setStatus(isCheck ? '01' : '00');

      return true;
    } catch (error) {
      console.error('保存処理でエラーが発生しました:', error);
      throw error;
    }
  }

  // 勤怠データを保存する関数
  const handleSave = async () => {
    if (!userInfo?.id || !branchInfo?.code) {
      console.error('保存エラー: ユーザー情報または所属情報が不足しています', { userInfo, branchInfo });
      setMessageWithStability({ 
        type: 'error', 
        text: 'ユーザー情報または所属情報が取得できません。再ログインしてください。',
        persistent: true
      });
      return;
    }

    // バリデーションエラーメッセージを格納する配列
    const validationErrors: string[] = [];
    const newErrorDates = new Set<string>();

    // 入力データのバリデーションチェック
    Object.entries(attendanceData).forEach(([date, data]) => {
      const { startTime, endTime } = data;
      const dateDisplay = format(new Date(date), 'M/d');

      // 時刻形式のバリデーション（HH:MM形式かどうか）
      const timePattern = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/;
      
      // 開始時間のチェック
      if (startTime && !timePattern.test(startTime)) {
        validationErrors.push(`${dateDisplay}の開始時間「${startTime}」が正しい形式（HH:MM）ではありません。`);
        newErrorDates.add(date);
      }
      
      // 終了時間のチェック
      if (endTime && !timePattern.test(endTime)) {
        validationErrors.push(`${dateDisplay}の終了時間「${endTime}」が正しい形式（HH:MM）ではありません。`);
        newErrorDates.add(date);
      }
      
      // 開始時間と終了時間の逆転チェック
      if (startTime && endTime && timePattern.test(startTime) && timePattern.test(endTime)) {
        const start = parse(startTime, 'HH:mm', new Date());
        const end = parse(endTime, 'HH:mm', new Date());
        
        if (end < start) {
          validationErrors.push(`${dateDisplay}の終了時間（${endTime}）が開始時間（${startTime}）より前になっています。`);
          newErrorDates.add(date);
        }
      }
    });

    // エラー日付を更新
    setErrorDates(newErrorDates);

    // バリデーションエラーがある場合は処理を中断
    if (validationErrors.length > 0) {
      // エラーメッセージを表示
      setMessageWithStability({ 
        type: 'error', 
        text: `以下のエラーを修正してください：\n${validationErrors.join('\n')}`,
        persistent: true,
        position: 'top'
      });
      return;
    }

    try {
      await handleSaveData();
      
      // 保存成功時にエラー表示をクリア
      setErrorDates(new Set<string>());
      
      // 保存後にデータを再取得
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      await fetchAllData(year, month);
      
      // データ取得後に成功メッセージを表示
      setMessageWithStability({ 
        type: 'success', 
        text: '勤怠データを保存しました',
        position: 'bottom'
      });
    } catch (error) {
      console.error('保存処理でエラーが発生しました:', error);
      setMessageWithStability({ 
        type: 'error', 
        text: error instanceof Error ? error.message : '勤怠データの保存に失敗しました',
        persistent: true,
        position: 'top'
      });
    }
  }

  // ステータス名を取得する関数
  const getStatusName = (statusCode: string): string => {
    switch (statusCode) {
      case '00': return '下書き';
      case '01': return '申請中';
      case '02': return '承認済';
      case '03': return '差戻し';
      default: return '下書き';
    }
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

    // 改行を含むメッセージを処理
    const formattedMessage = message.text.split('\n').map((line, index) => (
      <React.Fragment key={index}>
        {line}
        {index < message.text.split('\n').length - 1 && <br />}
      </React.Fragment>
    ));

    // 中央配置のモーダルメッセージ（検索中表示用）
    if (message.position === 'center') {
  return (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ 
              duration: 0.3,
              ease: "easeInOut"
            }}
            className={`
              rounded-lg border p-6 
              shadow-lg max-w-md w-full
              ${styles[message.type]}
            `}
          >
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100">
                {message.type === 'info' && (
                  <svg className="animate-spin h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {message.type !== 'info' && icons[message.type]}
              </div>
              <span className="text-lg font-medium whitespace-pre-line">{formattedMessage}</span>
            </div>
          </motion.div>
        </div>
      )
    }

    // すべてのメッセージを画面上部に表示
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
              <span className="text-sm font-medium whitespace-pre-line">{formattedMessage}</span>
              {(message.type === 'error' || message.dismissible) && (
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

  // 画面上の勤務形態を、データベースの勤務形態コードに変換する関数を追加
  const convertTypeToCode = (type: string): string => {
    switch (type) {
      case 'none': return '01';
      case 'holiday-work': return '02';
      case 'paid-leave': return '03';
      case 'am-leave': return '04';
      case 'pm-leave': return '05';
      case 'special-leave': return '06';
      case 'compensatory-leave': return '07';
      case 'compensatory-leave-planned': return '08';
      case 'absence': return '09';
      case 'late': return '10';
      case 'early-leave': return '11';
      case 'delay': return '12';
      case 'shift': return '13';
      case 'business-holiday': return '14';
      default: return '01';
    }
  };

  // 休憩時間を分単位に変換する関数を追加
  const convertBreakTimeToMinutes = (breakTime: string): number | null => {
    if (!breakTime) return null;
    
    // 時刻形式のバリデーション（HH:MM形式かどうか）
    const timePattern = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/;
    if (!timePattern.test(breakTime)) return null;
    
    const [hours, minutes] = breakTime.split(':').map(Number);
    return (hours * 60) + minutes;
  };

  // 時間（HH:MM形式）を小数時間に変換する関数
  const convertTimeToHours = (timeString: string): number | null => {
    if (!timeString) return null;
    
    // 時刻形式のバリデーション（HH:MM形式かどうか）
    const timePattern = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/;
    if (!timePattern.test(timeString)) return null;
    
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours + (minutes / 60);
  };

  // ステータスアイコンを取得する関数を追加
  const getStatusIcon = (statusCode: string) => {
    switch (statusCode) {
      case '00': return <Calendar className="h-4 w-4 text-gray-500" />;
      case '01': return <CheckCircle className="h-4 w-4 text-blue-500" />;
      case '02': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case '03': return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      default: return <Calendar className="h-4 w-4 text-gray-500" />;
    }
  }

  // 新規経費の追加
  const handleAddExpense = () => {
    // バリデーションチェック
    if (!newExpense.date || !newExpense.transportation || !newExpense.from || 
        !newExpense.to || !newExpense.type || !newExpense.roundTrip || 
        !newExpense.amount || !newExpense.remarks) {
      setExpenseValidationError('すべての項目を入力してください。')
      return
    }

    // 金額のバリデーション
    if (isNaN(Number(newExpense.amount)) || Number(newExpense.amount) <= 0) {
      setExpenseValidationError('金額には正の数字を入力してください。')
      return
    }

    // カテゴリを明示的に保持
    const currentCategory = newExpense.category || 'commute';

    const expense: ExpenseRecord = {
      id: newExpense.id || uuidv4(),
      date: newExpense.date || '',
      transportation: newExpense.transportation || '',
      from: newExpense.from || '',
      to: newExpense.to || '',
      type: newExpense.type || '',
      roundTrip: newExpense.roundTrip || '',
      amount: Number(newExpense.amount) || 0,
      remarks: newExpense.remarks || '',
      category: currentCategory as 'commute' | 'business'
    }

    if (newExpense.id) {
      setExpenses(expenses.map(e => e.id === newExpense.id ? expense : e))
    } else {
      setExpenses([...expenses, expense])
    }

    setIsAddingExpense(false)
    
    // カテゴリだけでなく、他の必須フィールドも初期化
    setNewExpense({
      date: format(new Date(), 'yyyy/MM/dd'),
      transportation: '',
      from: '',
      to: '',
      type: '',
      roundTrip: '',
      amount: 0,
      remarks: '',
      category: currentCategory
    })
    
    setExpenseValidationError(null)
    setHasUnsavedChanges(true)
  }

  // 経費の削除
  const handleDeleteExpense = (id: string) => {
    setExpenses(expenses.filter(expense => expense.id !== id))
    setHasUnsavedChanges(true)
  }

  // 保存処理
  const handleExpenseSave = async () => {
    if (isSaving) return;
    
    try {
      setIsSaving(true);
      setSaveError(null);
      setSaveSuccess(false);

      // セッションストレージからユーザー情報を取得
      const userInfoStr = sessionStorage.getItem('userProfile');
      if (!userInfoStr) {
        throw new Error('ユーザー情報が取得できませんでした');
      }
      
      const userProfile = JSON.parse(userInfoStr);
      const userId = userProfile.id;
      const employeeId = userProfile.employee_id;
      const branch = userProfile.branch_code;
      
      // 画面上のセレクトボックスから年月を取得
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;

      console.log('経費保存用ユーザー情報:', { userId, employeeId, branch, year, month });
      console.log('保存する経費データ:', expenses);

      // 通勤費と業務経費を分離
      const commuteExpenses = expenses
        .filter(expense => expense.category === 'commute')
        .map(expense => ({
          id: expense.id,
          date: expense.date,
          transportation: expense.transportation,
          from: expense.from,
          to: expense.to,
          expenseType: expense.type,
          roundTripType: expense.roundTrip,
          amount: expense.amount,
          remarks: expense.remarks || ''
        }));
      
      const businessExpenses = expenses
        .filter(expense => expense.category === 'business')
        .map(expense => ({
          id: expense.id,
          date: expense.date,
          transportation: expense.transportation,
          from: expense.from,
          to: expense.to,
          expenseType: expense.type,
          roundTripType: expense.roundTrip,
          amount: expense.amount,
          remarks: expense.remarks || ''
        }));

      console.log('通勤費データ:', commuteExpenses.length, '件');
      console.log('業務経費データ:', businessExpenses.length, '件');

      // 保存するデータを準備
      const expenseData = {
        commuteExpenses,
        businessExpenses,
        receipts, 
        employeeId, 
        branch
      };

      // データの保存
      const result = await saveExpenseData(userId, year, month, expenseData);
      
      if (result.success) {
        setMessageWithStability({ 
          type: 'success', 
          text: '経費データを保存しました',
          position: 'bottom'
        });
      } else {
        throw new Error(result.error || '経費データの保存に失敗しました');
      }
    } catch (error) {
      console.error("経費データの保存に失敗しました", error);
      setMessageWithStability({ 
        type: 'error', 
        text: error instanceof Error ? error.message : '経費データの保存に失敗しました。もう一度お試しください。',
        persistent: true,
        position: 'top'
      });
    } finally {
      setIsSaving(false);
    }
  };

  // タブ切り替え時の処理
  const handleTabChange = (value: string) => {
    setCurrentTab(value)
  }

  // ファイルアップロード処理
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setUploadError(null)

    try {
      // ファイル名を一意にするためのタイムスタンプを追加
      const timestamp = new Date().getTime()
      const uniqueFileName = `${timestamp}_${file.name}`
      const filePath = `receipts/${uniqueFileName}`

      // Supabase Storageにファイルをアップロード
      const { data, error } = await supabase.storage
        .from('receipts')
        .upload(filePath, file)

      if (error) throw error

      // アップロードしたファイルのURLを取得
      const { data: { publicUrl } } = supabase.storage
        .from('receipts')
        .getPublicUrl(filePath)

      // 新しい領収書レコードを作成
      const newReceipt: ReceiptRecord = {
        id: Date.now().toString(),
        fileName: file.name,
        fileUrl: publicUrl,
        remarks: '',
        uploadedAt: new Date().toISOString(),
        filePath: filePath
      }

      setReceipts([...receipts, newReceipt])
      setMessageWithStability({ 
        type: 'success', 
        text: 'ファイルをアップロードしました',
        position: 'bottom'
      })
    } catch (error) {
      console.error('ファイルアップロードエラー:', error)
      setUploadError('ファイルのアップロードに失敗しました')
      setMessageWithStability({ 
        type: 'error', 
        text: 'ファイルのアップロードに失敗しました',
        persistent: true
      })
    } finally {
      setIsUploading(false)
    }
  }

  // 領収書の備考を更新
  const handleReceiptRemarksChange = (id: string, remarks: string) => {
    setReceipts(receipts.map(receipt => 
      receipt.id === id ? { ...receipt, remarks } : receipt
    ))
  }

  // 領収書の削除
  const handleDeleteReceipt = async (id: string) => {
    const receipt = receipts.find(r => r.id === id)
    if (!receipt) return

    try {
      // Supabase Storageからファイルを削除
      const filePath = receipt.fileUrl.split('/').pop()
      if (filePath) {
        const { error } = await supabase.storage
          .from('receipts')
          .remove([filePath])

        if (error) throw error
      }

      // 状態から削除
      setReceipts(receipts.filter(r => r.id !== id))
      setMessageWithStability({ 
        type: 'success', 
        text: 'ファイルを削除しました',
        position: 'bottom'
      })
    } catch (error) {
      console.error('ファイル削除エラー:', error)
      setMessageWithStability({ 
        type: 'error', 
        text: 'ファイルの削除に失敗しました',
        persistent: true
      })
    }
  }

  // 休日判定関数を拡張（holiday_masterのデータも含める）
  const isHoliday = (day: Date): boolean => {
    const dateString = format(day, 'yyyy-MM-dd')
    return isJapaneseHoliday(day) || holidayMasterData.includes(dateString)
  }

  // 勤怠データと経費データを一括して取得する統合関数
  const fetchAllData = useCallback(async (year: number, month: number) => {
    if (!userInfo?.id) return;
    
    // すでにデータをロード中の場合は再度実行しない
    if (isLoading) {
      console.log('すでにデータ取得中のため、重複呼び出しをスキップします');
      return;
    }
    
    // 一度だけメッセージを表示
    setMessageWithStability({ 
      type: 'info', 
      text: 'データを検索中です...',
      position: 'center',
      alignment: 'center',
      persistent: true
    });
    
    setIsLoading(true);
    
    try {
      // 1. 休日マスタデータを取得
      try {
        const response = await fetch(`/api/holidays?year=${year}`)
        if (response.ok) {
          const data = await response.json()
          const holidayDates = data.map((holiday: any) => holiday.date)
          setHolidayMasterData(holidayDates)
        }
      } catch (error) {
        console.error('休日マスタデータの取得エラー:', error)
      }
      
      // 2. 勤怠データを取得
      const { data: headerData, error: headerError } = await supabase
        .from('attendance_headers')
        .select('*')
        .eq('user_id', userInfo.id)
        .eq('year', year)
        .eq('month', month)
        .maybeSingle()

      if (headerError) throw headerError

      if (headerData) {
        // 勤務場所とステータスを設定
        setWorkplace(headerData.workplace || '')
        setStatus(headerData.status || '00')

        // 勤怠詳細を取得
        const { data: detailsData, error: detailsError } = await supabase
          .from('attendance_details')
          .select('*')
          .eq('header_id', headerData.id)
          .order('date')

        if (detailsError) throw detailsError

        // 勤怠データを設定
        const newAttendanceData: typeof attendanceData = {}
        
        detailsData?.forEach(detail => {
          // 勤務形態コードを画面表示用の値に変換
          let type = 'none'
          switch (detail.work_type_code) {
            case '01': type = 'none'; break;
            case '02': type = 'holiday-work'; break;
            case '03': type = 'paid-leave'; break;
            case '04': type = 'am-leave'; break;
            case '05': type = 'pm-leave'; break;
            case '06': type = 'special-leave'; break;
            case '07': type = 'compensatory-leave'; break;
            case '08': type = 'compensatory-leave-planned'; break;
            case '09': type = 'absence'; break;
            case '10': type = 'late'; break;
            case '11': type = 'early-leave'; break;
            case '12': type = 'delay'; break;
            case '13': type = 'shift'; break;
            case '14': type = 'business-holiday'; break;
          }

          // 実労働時間を時:分形式に変換
          const actualHours = Math.floor(detail.actual_working_hours || 0)
          const actualMinutes = Math.round(((detail.actual_working_hours || 0) % 1) * 60)
          const actualTime = `${actualHours.toString().padStart(2, '0')}:${actualMinutes.toString().padStart(2, '0')}`

          // 休憩時間を時:分形式に変換
          const breakHours = Math.floor((detail.break_time || 0) / 60)
          const breakMinutes = (detail.break_time || 0) % 60
          const breakTime = `${breakHours.toString().padStart(2, '0')}:${breakMinutes.toString().padStart(2, '0')}`

          // 開始時間と終了時間をHH:MM形式に整形
          const startTime = detail.start_time ? detail.start_time.substring(0, 5) : '';
          const endTime = detail.end_time ? detail.end_time.substring(0, 5) : '';

          newAttendanceData[detail.date] = {
            startTime: startTime,
            endTime: endTime,
            breakTime: breakTime,
            actualTime: actualTime,
            type: type,
            remarks: detail.remarks || '',
            lateEarlyHours: detail.late_early_hours ? detail.late_early_hours.toFixed(1) : ''
          }
        })

        setAttendanceData(newAttendanceData)
      } else {
        // ヘッダーデータがない場合は空のデータを設定
        setAttendanceData({})
        const storedWorkplace = sessionStorage.getItem('workplace')
        setWorkplace(storedWorkplace || '')
        setStatus('00')
      }
      
      // 3. 経費データを取得
      if (userInfo.id) {
        const result = await fetchExpenseData(userInfo.id, year, month);
        
        if (result.success && result.data) {
          // 通勤費データを画面表示用に変換
          const commuteExpenses = result.data.commuteExpenses.map(expense => ({
            id: expense.id || uuidv4(),
            date: expense.date,
            transportation: expense.transportation,
            from: expense.from,
            to: expense.to,
            type: expense.expenseType,
            roundTrip: expense.roundTripType,
            amount: expense.amount,
            remarks: expense.remarks || '',
            category: 'commute' as const
          }));
          
          // 業務経費データを画面表示用に変換
          const businessExpenses = result.data.businessExpenses.map(expense => ({
            id: expense.id || uuidv4(),
            date: expense.date,
            transportation: expense.transportation,
            from: expense.from,
            to: expense.to,
            type: expense.expenseType,
            roundTrip: expense.roundTripType,
            amount: expense.amount,
            remarks: expense.remarks || '',
            category: 'business' as const
          }));
          
          // 領収書データをそのまま設定
          setReceipts(result.data.receipts);
          
          // 通勤費と業務経費を統合して画面に表示
          setExpenses([...commuteExpenses, ...businessExpenses]);
        }
      }
      
      // 検索完了時にメッセージをクリア
      setMessageWithStability(null)
    } catch (error) {
      console.error('Error fetching data:', error)
      setMessageWithStability({ 
        type: 'error', 
        text: 'データの取得に失敗しました', 
        persistent: true
      })
    } finally {
      setIsLoading(false)
    }
  }, [userInfo?.id]); // userInfoだと再レンダリングの原因になるため、idだけに依存

  // 月選択時のハンドラー
  const handleMonthChange = useCallback((month: string) => {
    const newMonth = parseInt(month);
    if (!isNaN(newMonth) && newMonth >= 1 && newMonth <= 12) {
      const newDate = new Date(currentDate);
      newDate.setMonth(newMonth - 1);
      setCurrentDate(newDate);
      
      // 統合関数を呼び出し
      fetchAllData(newDate.getFullYear(), newMonth);
    }
  }, [currentDate, fetchAllData]);

  // 年選択時のハンドラー
  const handleYearChange = useCallback((year: string) => {
    const newYear = parseInt(year);
    if (!isNaN(newYear)) {
      const newDate = new Date(currentDate);
      newDate.setFullYear(newYear);
      setCurrentDate(newDate);
      
      // 統合関数を呼び出し
      fetchAllData(newYear, newDate.getMonth() + 1);
    }
  }, [currentDate, fetchAllData]);
  
  // 初期表示時のデータ取得（最初の1回だけ）
  useEffect(() => {
    if (userInfo?.id && !initialLoadCompleted) {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth() + 1
      console.log('初期データロード:', year, month, userInfo.id);
      fetchAllData(year, month)
      initialLoadCompleted = true;
    }
  }, [userInfo, fetchAllData]);

  // ユーザー情報を取得
  useEffect(() => {
    const storedUserInfo = sessionStorage.getItem('userProfile')
    if (storedUserInfo) {
      const userProfile = JSON.parse(storedUserInfo)
      console.log('User profile from session storage:', userProfile)
      setUserInfo(userProfile)
      setBranchInfo({ name: userProfile.branch_name_jp, code: userProfile.branch_code })
    } else {
      console.warn('No user profile found in session storage')
    }
  }, [])

  // メッセージの自動消去
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    
    if (message && (message.type === 'success' || message.type === 'info')) {
      // 新しいタイマーをセットする前に既存のタイマーをクリア
      if (timer) clearTimeout(timer);
      
      // 表示時間を3秒に設定
      timer = setTimeout(() => {
        setMessageWithStability(null)
      }, 3000)
    }
    
    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [message])

  return (
    <div className="space-y-6 relative z-[1]">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Clock className="h-8 w-8 text-blue-600" />
          勤怠入力・経費請求
        </h1>
        <p className="text-muted-foreground">
          日々の勤怠情報と経費を登録します
        </p>
      </div>

      <MessageAlert />

      <Tabs defaultValue="attendance" className="space-y-4" onValueChange={handleTabChange}>
        <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-8">
                  <div className="flex items-center gap-4">
                    <Select
                      value={currentDate.getFullYear().toString()}
                      onValueChange={handleYearChange}
                    >
                      <SelectTrigger className="w-28">
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
                      value={(currentDate.getMonth() + 1).toString()}
                      onValueChange={handleMonthChange}
                    >
                      <SelectTrigger className="w-24">
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

                  <div className="flex items-center gap-8">
                    <div>
                      <div className="text-sm text-muted-foreground">{t("employee-id")}</div>
                <div className="font-medium">{userInfo?.employee_id || ''}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">{t("department")}</div>
                <div className="font-medium">{branchInfo?.name || ''}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">{t("name")}</div>
                <div className="font-medium">
                  {userInfo?.last_name && userInfo?.first_name 
                    ? `${userInfo.last_name} ${userInfo.first_name}` 
                    : userInfo?.last_name || userInfo?.first_name || ''}
                    </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">ステータス</div>
                <div className="font-medium flex items-center gap-1">
                  {getStatusIcon(status)}
                  {getStatusName(status)}
                </div>
              </div>
              {!isEditable() && (
                <Button 
                  onClick={moveToEditStatus} 
                  className="bg-amber-600 hover:bg-amber-700 ml-4"
                  disabled={isLoading || isSaving}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  再編集
                </Button>
              )}
            </div>
          </div>

          <TabsList className="h-9">
            <TabsTrigger value="attendance">勤怠入力</TabsTrigger>
            <TabsTrigger value="expenses">経費請求</TabsTrigger>
            <TabsTrigger value="business">業務請求</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="attendance">
          <Card>
            <CardContent className="pt-6">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-8">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-semibold">勤怠入力</h2>
                  </div>
                  <div className="flex items-center gap-4">
                    {isEditable() ? (
                    <Input
                      value={workplace}
                      onChange={(e) => setWorkplace(e.target.value)}
                        className="w-64 border-[#d1d5db] border-opacity-85"
                      placeholder={t("enter-workplace")}
                    />
                    ) : (
                      <div className="w-64">
                        <div className="text-sm text-muted-foreground">勤務場所</div>
                        <div className="font-medium">{workplace || t("enter-workplace")}</div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isEditable() ? (
                    <>
                      <Button 
                        onClick={handleCheck} 
                        className="bg-green-600 hover:bg-green-700"
                        disabled={isLoading || isSaving}
                      >
                        <CheckSquare className="h-4 w-4 mr-2" />
                        チェック
                      </Button>
                      <Button 
                        onClick={handleSave} 
                        className="bg-blue-600 hover:bg-blue-700"
                        disabled={isLoading || isSaving}
                      >
                        {isSaving ? (
                          <span className="flex items-center">
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            保存中...
                          </span>
                        ) : (
                          <>
                  <Save className="h-4 w-4 mr-2" />
                  {t("save")}
                          </>
                        )}
                </Button>
                    </>
                  ) : null}
                </div>
              </div>

              <div className="grid grid-cols-7 gap-x-4 mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {t("total-work-days")}
                  </span>
                  <span className="text-base font-medium">{summary.totalWorkDays}{t("days-suffix")}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Briefcase className="h-3.5 w-3.5" />
                    {t("regular-work-days")}
                  </span>
                  <span className="text-base font-medium">{summary.regularWorkDays}{t("days-suffix")}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <CalendarPlus className="h-3.5 w-3.5" />
                    {t("holiday-work-days")}
                  </span>
                  <span className="text-base font-medium">{summary.holidayWorkDays}{t("days-suffix")}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <CalendarX className="h-3.5 w-3.5" />
                    {t("absence-days")}
                  </span>
                  <span className="text-base font-medium">{summary.absenceDays}{t("days-suffix")}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock4 className="h-3.5 w-3.5" />
                    {t("total-work-time")}
                  </span>
                  <span className="text-base font-medium">{summary.totalWorkTime}{t("hours")}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <ArrowLeftRight className="h-3.5 w-3.5" />
                    {t("late-early-hours")}
                  </span>
                  <span className="text-base font-medium">{summary.lateEarlyHours}{t("hours")}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <CalendarCheck className="h-3.5 w-3.5" />
                    {t("paid-leave-days")}
                  </span>
                  <span className="text-base font-medium">{summary.paidLeaveDays}{t("days-suffix")}</span>
                </div>
              </div>

              <div className="border rounded-lg border-gray-300 shadow-sm">
                <div className="grid grid-cols-12 gap-0 p-2 bg-blue-50 dark:bg-gray-800 rounded-t-lg text-sm border-b border-gray-300">
                  <div className="col-span-1 text-gray-500 font-medium flex items-center justify-center gap-1 px-6">
                    <Calendar className="h-4 w-4" />
                    {t("date")}
                  </div>
                  <div className="col-span-1 text-gray-500 font-medium flex items-center justify-center gap-1">
                    <Clock className="h-4 w-4" />
                    {t("start-time")}
                  </div>
                  <div className="col-span-1 text-gray-500 font-medium flex items-center justify-center gap-1">
                    <Clock className="h-4 w-4" />
                    {t("end-time")}
                  </div>
                  <div className="col-span-1 text-gray-500 font-medium flex items-center justify-center gap-1">
                    <Timer className="h-4 w-4" />
                    {t("break-time")}
                  </div>
                  <div className="col-span-1 text-gray-500 font-medium flex items-center justify-center gap-1">
                    <CalendarClock className="h-4 w-4" />
                    {t("actual-time")}
                  </div>
                  <div className="col-span-2 text-gray-500 font-medium flex items-center gap-1">
                    <Briefcase className="h-4 w-4" />
                    {t("attendance-type")}
                  </div>
                  <div className="col-span-4 text-gray-500 font-medium flex items-center gap-1">
                    <Info className="h-4 w-4" />
                    作業内容
                  </div>
                  <div className="col-span-1 text-gray-500 font-medium flex items-center justify-center gap-1">
                    <ArrowLeftRight className="h-4 w-4" />
                    {t("late-early-hours")}
                  </div>
                </div>

                <div className="divide-y divide-gray-300">
                  {days.map((day) => {
                    const dateKey = format(day, 'yyyy-MM-dd')
                    const dayOfWeek = format(day, 'E', { locale: ja })
                    const isWeekend = [0, 6].includes(day.getDay())
                    const hasError = errorDates?.has(dateKey)

                    return (
                      <div
                        key={dateKey}
                        className={`grid grid-cols-12 gap-0 items-center px-4 py-1.5 ${
                          hasError 
                            ? 'bg-yellow-50 dark:bg-yellow-900/20' 
                            : isWeekend || isHoliday(day)
                              ? 'bg-gray-50 dark:bg-gray-800/50' 
                              : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                        }`}
                      >
                        <div className={`col-span-1 text-sm font-medium px-6 ${isEditable() ? 'py-1.5' : 'py-1'} ${isWeekend || isHoliday(day) ? 'text-red-600' : ''}`}>
                          {format(day, 'M/d')}({dayOfWeek})
                        </div>
                        <div className="col-span-1 px-2">
                          {isEditable() ? (
                          <Input
                            type="text"
                            inputMode="numeric"
                            placeholder="HH:MM"
                            value={attendanceData[dateKey]?.startTime || ""}
                            onChange={(e) => handleTimeChange(day, 'startTime', e.target.value)}
                              onBlur={() => handleTimeBlur(day)}
                              className="h-8 text-center placeholder:text-gray-300 border-[#d1d5db] border-opacity-85"
                          />
                          ) : (
                            <div className="h-7 flex items-center justify-center font-medium text-sm">
                              {attendanceData[dateKey]?.startTime || ""}
                        </div>
                          )}
                        </div>
                        <div className="col-span-1 px-2">
                          {isEditable() ? (
                          <Input
                            type="text"
                            inputMode="numeric"
                            placeholder="HH:MM"
                            value={attendanceData[dateKey]?.endTime || ""}
                            onChange={(e) => handleTimeChange(day, 'endTime', e.target.value)}
                              onBlur={() => handleTimeBlur(day)}
                              className="h-8 text-center placeholder:text-gray-300 border-[#d1d5db] border-opacity-85"
                          />
                          ) : (
                            <div className="h-7 flex items-center justify-center font-medium text-sm">
                              {attendanceData[dateKey]?.endTime || ""}
                        </div>
                          )}
                        </div>
                        <div className="col-span-1 px-2">
                          {isEditable() ? (
                          <Input
                            type="text"
                            inputMode="numeric"
                            placeholder="HH:MM"
                            value={attendanceData[dateKey]?.breakTime || ""}
                            onChange={(e) => handleTimeChange(day, 'breakTime', e.target.value)}
                              onBlur={() => handleTimeBlur(day)}
                              className="h-8 text-center placeholder:text-gray-300 border-[#d1d5db] border-opacity-85"
                          />
                          ) : (
                            <div className="h-7 flex items-center justify-center font-medium text-sm">
                              {attendanceData[dateKey]?.breakTime || ""}
                        </div>
                          )}
                        </div>
                        <div className="col-span-1 px-2">
                          <div className={`flex items-center justify-center font-medium text-sm ${isEditable() ? 'h-8' : 'h-7'}`}>
                            {attendanceData[dateKey]?.actualTime || ""}
                          </div>
                        </div>
                        <div className="col-span-2 px-2">
                          {isEditable() ? (
                          <Select
                            onValueChange={(value) => handleTimeChange(day, 'type', value)}
                            value={attendanceData[dateKey]?.type || "none"}
                          >
                              <SelectTrigger className="h-8 border-[#d1d5db] border-opacity-85">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none" className="h-7"></SelectItem>
                              <SelectItem value="holiday-work" className="h-7">休出</SelectItem>
                              <SelectItem value="paid-leave" className="h-7">有休</SelectItem>
                              <SelectItem value="am-leave" className="h-7">前休</SelectItem>
                              <SelectItem value="pm-leave" className="h-7">後休</SelectItem>
                              <SelectItem value="special-leave" className="h-7">特休</SelectItem>
                              <SelectItem value="compensatory-leave" className="h-7">振休</SelectItem>
                              <SelectItem value="compensatory-leave-planned" className="h-7">振予</SelectItem>
                              <SelectItem value="absence" className="h-7">欠勤</SelectItem>
                              <SelectItem value="late" className="h-7">遅刻</SelectItem>
                              <SelectItem value="early-leave" className="h-7">早退</SelectItem>
                              <SelectItem value="delay" className="h-7">遅延</SelectItem>
                              <SelectItem value="shift" className="h-7">シフト</SelectItem>
                              <SelectItem value="business-holiday" className="h-7">休業</SelectItem>
                            </SelectContent>
                          </Select>
                          ) : (
                            <div className="h-7 flex items-center px-3 font-medium text-sm">
                              {(() => {
                                switch (attendanceData[dateKey]?.type) {
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
                          )}
                        </div>
                        <div className="col-span-4 px-2">
                          {isEditable() ? (
                          <Input
                            type="text"
                            value={attendanceData[dateKey]?.remarks || ""}
                            onChange={(e) => handleTimeChange(day, 'remarks', e.target.value)}
                              className="h-8 placeholder:text-gray-300 border-[#d1d5db] border-opacity-85"
                            placeholder={t("remarks-placeholder")}
                          />
                          ) : (
                            <div className="h-7 flex items-center px-3 font-medium text-sm">
                              {attendanceData[dateKey]?.remarks || ""}
                        </div>
                          )}
                        </div>
                        <div className="col-span-1 px-2">
                          {isEditable() ? (
                          <Input
                            type="text"
                            inputMode="numeric"
                            placeholder="0.0"
                            value={attendanceData[dateKey]?.lateEarlyHours || ""}
                            onChange={(e) => handleTimeChange(day, 'lateEarlyHours', e.target.value)}
                              className="h-8 text-center placeholder:text-gray-300 border-[#d1d5db] border-opacity-85"
                          />
                          ) : (
                            <div className="h-7 flex items-center justify-center font-medium text-sm">
                              {attendanceData[dateKey]?.lateEarlyHours || ""}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expenses">
          <Card>
            <CardContent className="pt-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">経費請求</h2>
                {(status === '00' || status === '03') && (
                  <Button
                    onClick={handleExpenseSave}
                    className="bg-blue-600 hover:bg-blue-700"
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        保存中...
                      </span>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        保存
                      </>
                    )}
                  </Button>
                )}
              </div>

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
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Bus className="h-5 w-5 text-blue-600" />
                    <h2 className="text-lg font-semibold text-blue-800">通勤費</h2>
                  </div>
                  {(status === '00' || status === '03') && (
                    <Button
                      onClick={() => {
                        setIsAddingExpense(true)
                        setNewExpense({ category: 'commute' })
                      }}
                      className="bg-white hover:bg-gray-100 text-gray-900 border border-gray-200"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      通勤費追加
                    </Button>
                  )}
                </div>

                <div className="border rounded-lg border-gray-200 overflow-hidden">
                  <div className="grid grid-cols-9 gap-0 p-2 bg-blue-50 text-sm border-b border-gray-200">
                    <div className="col-span-1 text-blue-700 font-medium px-2">発生日</div>
                    <div className="col-span-1 text-blue-700 font-medium px-2">交通機関</div>
                    <div className="col-span-2 text-blue-700 font-medium px-2">区間</div>
                    <div className="col-span-1 text-blue-700 font-medium px-2">種類</div>
                    <div className="col-span-1 text-blue-700 font-medium px-2">片道/往復</div>
                    <div className="col-span-1 text-blue-700 font-medium px-2">金額</div>
                    <div className="col-span-1 text-blue-700 font-medium px-2">目的・備考</div>
                    <div className="col-span-1 text-blue-700 font-medium px-2">操作</div>
                  </div>

                  <div className="divide-y divide-gray-100">
                    {expenses
                      .filter(expense => expense.category === 'commute')
                      .map((expense) => (
                        <div 
                          key={expense.id} 
                          className="grid grid-cols-9 gap-0 p-1.5 hover:bg-blue-50/50 cursor-pointer items-center"
                          onClick={() => {
                            setNewExpense(expense)
                            setIsAddingExpense(true)
                          }}
                        >
                          <div className="col-span-1 px-2 text-sm">{expense.date}</div>
                          <div className="col-span-1 px-2 text-sm">{expense.transportation}</div>
                          <div className="col-span-2 px-2 text-sm">{expense.from} → {expense.to}</div>
                          <div className="col-span-1 px-2 text-sm">
                            {commuteTypes.find(type => type.value === expense.type)?.label}
                          </div>
                          <div className="col-span-1 px-2 text-sm">
                            {roundTripTypes.find(type => type.value === expense.roundTrip)?.label}
                          </div>
                          <div className="col-span-1 px-2 text-sm">¥{expense.amount.toLocaleString()}</div>
                          <div className="col-span-1 px-2 text-sm">{expense.remarks}</div>
                          <div className="col-span-1 px-2">
                            {(status === '00' || status === '03') && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteExpense(expense.id)
                                }}
                                className="h-7 w-7"
                              >
                                <Trash2 className="h-3.5 w-3.5 text-red-500" />
                              </Button>
                            )}
                          </div>
                        </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 業務経費セクション */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-5 w-5 text-green-600" />
                    <h2 className="text-lg font-semibold text-green-800">業務経費</h2>
                  </div>
                  {(status === '00' || status === '03') && (
                    <Button
                      onClick={() => {
                        setIsAddingExpense(true)
                        setNewExpense({ category: 'business' })
                      }}
                      className="bg-white hover:bg-gray-100 text-gray-900 border border-gray-200"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      業務経費追加
                    </Button>
                  )}
                </div>

                <div className="border rounded-lg border-gray-200 overflow-hidden">
                  <div className="grid grid-cols-9 gap-0 p-2 bg-green-50 text-sm border-b border-gray-200">
                    <div className="col-span-1 text-green-700 font-medium px-2">発生日</div>
                    <div className="col-span-1 text-green-700 font-medium px-2">交通機関/宿泊先</div>
                    <div className="col-span-2 text-green-700 font-medium px-2">区間</div>
                    <div className="col-span-1 text-green-700 font-medium px-2">費目</div>
                    <div className="col-span-1 text-green-700 font-medium px-2">片道/往復</div>
                    <div className="col-span-1 text-green-700 font-medium px-2">金額</div>
                    <div className="col-span-1 text-green-700 font-medium px-2">目的・備考</div>
                    <div className="col-span-1 text-green-700 font-medium px-2">操作</div>
                  </div>

                  <div className="divide-y divide-gray-100">
                    {expenses
                      .filter(expense => expense.category === 'business')
                      .map((expense) => (
                        <div 
                          key={expense.id} 
                          className="grid grid-cols-9 gap-0 p-1.5 hover:bg-green-50/50 cursor-pointer items-center"
                          onClick={() => {
                            setNewExpense(expense)
                            setIsAddingExpense(true)
                          }}
                        >
                          <div className="col-span-1 px-2 text-sm">{expense.date}</div>
                          <div className="col-span-1 px-2 text-sm">{expense.transportation}</div>
                          <div className="col-span-2 px-2 text-sm">{expense.from} → {expense.to}</div>
                          <div className="col-span-1 px-2 text-sm">
                            {businessTypes.find(type => type.value === expense.type)?.label}
                          </div>
                          <div className="col-span-1 px-2 text-sm">
                            {roundTripTypes.find(type => type.value === expense.roundTrip)?.label}
                          </div>
                          <div className="col-span-1 px-2 text-sm">¥{expense.amount.toLocaleString()}</div>
                          <div className="col-span-1 px-2 text-sm">{expense.remarks}</div>
                          <div className="col-span-1 px-2">
                            {(status === '00' || status === '03') && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteExpense(expense.id)
                                }}
                                className="h-7 w-7"
                              >
                                <Trash2 className="h-3.5 w-3.5 text-red-500" />
                              </Button>
                            )}
                          </div>
                        </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 新規経費入力フォーム */}
              {isAddingExpense && (
                <AnimatePresence>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                  >
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className="bg-white rounded-lg p-6 w-[800px] max-h-[90vh] overflow-y-auto"
                    >
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                          {newExpense.category === 'commute' ? (
                            <>
                              <Bus className="h-5 w-5 text-blue-600" />
                              <h3 className="text-lg font-semibold text-blue-800">通勤費の追加</h3>
                            </>
                          ) : (
                            <>
                              <Briefcase className="h-5 w-5 text-green-600" />
                              <h3 className="text-lg font-semibold text-green-800">業務経費の追加</h3>
                            </>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setIsAddingExpense(false)
                            // カテゴリを維持したまま初期化する
                            const currentCategory = newExpense.category || 'commute';
                            setNewExpense({
                              date: format(new Date(), 'yyyy/MM/dd'),
                              transportation: '',
                              from: '',
                              to: '',
                              type: '',
                              roundTrip: '',
                              amount: 0,
                              remarks: '',
                              category: currentCategory as 'commute' | 'business'
                            })
                            setExpenseValidationError(null)
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      {expenseValidationError && (
                        <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200 flex items-center gap-2">
                          <AlertCircle className="h-5 w-5 text-red-500" />
                          <span className="text-sm">{expenseValidationError}</span>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium mb-1 block">発生日</label>
                          <Input
                            type="date"
                            value={newExpense.date ? format(new Date(newExpense.date.replace(/\//g, '-')), 'yyyy-MM-dd') : ''}
                            onChange={(e) => {
                              if (!e.target.value) return;
                              const formattedDate = e.target.value.replace(/-/g, '/');
                              setNewExpense({ ...newExpense, date: formattedDate });
                            }}
                            placeholder="YYYY/MM/DD"
                            disabled={status !== '00' && status !== '03'}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-1 block">
                            {newExpense.category === 'commute' ? '交通機関' : '交通機関/宿泊先など'}
                          </label>
                          <Input
                            value={newExpense.transportation || ''}
                            onChange={(e) => setNewExpense({ ...newExpense, transportation: e.target.value })}
                            disabled={status !== '00' && status !== '03'}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-1 block">区間（から）</label>
                          <Input
                            value={newExpense.from || ''}
                            onChange={(e) => setNewExpense({ ...newExpense, from: e.target.value })}
                            disabled={status !== '00' && status !== '03'}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-1 block">区間（まで）</label>
                          <Input
                            value={newExpense.to || ''}
                            onChange={(e) => setNewExpense({ ...newExpense, to: e.target.value })}
                            disabled={status !== '00' && status !== '03'}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-1 block">
                            {newExpense.category === 'commute' ? '種類' : '費目'}
                          </label>
                          <Select
                            value={newExpense.type || ''}
                            onValueChange={(value) => setNewExpense({ ...newExpense, type: value })}
                            disabled={status !== '00' && status !== '03'}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(newExpense.category === 'commute' ? commuteTypes : businessTypes).map(type => (
                                <SelectItem key={type.value} value={type.value}>
                                  {type.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-1 block">片道・往復</label>
                          <Select
                            value={newExpense.roundTrip || ''}
                            onValueChange={(value) => setNewExpense({ ...newExpense, roundTrip: value })}
                            disabled={status !== '00' && status !== '03'}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {roundTripTypes.map(type => (
                                <SelectItem key={type.value} value={type.value}>
                                  {type.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-1 block">金額</label>
                          <Input
                            type="number"
                            value={newExpense.amount || ''}
                            onChange={(e) => setNewExpense({ ...newExpense, amount: Number(e.target.value) })}
                            disabled={status !== '00' && status !== '03'}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-1 block">目的・備考</label>
                          <Input
                            value={newExpense.remarks || ''}
                            onChange={(e) => setNewExpense({ ...newExpense, remarks: e.target.value })}
                            disabled={status !== '00' && status !== '03'}
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 mt-6">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setIsAddingExpense(false)
                            const currentCategory = newExpense.category || 'commute';
                            setNewExpense({
                              date: format(new Date(), 'yyyy/MM/dd'),
                              transportation: '',
                              from: '',
                              to: '',
                              type: '',
                              roundTrip: '',
                              amount: 0,
                              remarks: '',
                              category: currentCategory as 'commute' | 'business'
                            })
                          }}
                        >
                          キャンセル
                        </Button>
                        {(status === '00' || status === '03') && (
                          <Button
                            onClick={handleAddExpense}
                            className={newExpense.category === 'commute' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}
                          >
                            追加
                          </Button>
                        )}
                      </div>
                    </motion.div>
                  </motion.div>
                </AnimatePresence>
              )}

              {/* 領収書・定期券セクション */}
              <div className="mt-8">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-purple-600" />
                    <h2 className="text-lg font-semibold text-purple-800">領収書・定期券</h2>
                  </div>
                  {(status === '00' || status === '03') && (
                    <Button
                      onClick={() => {
                        setSelectedReceipt(null)
                        setShowReceiptViewer(false)
                        setShowReceiptInput(true)
                      }}
                      className="bg-white hover:bg-gray-100 text-gray-900 border border-gray-200"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      ファイル追加
                    </Button>
                  )}
                </div>

                <div className="border rounded-lg border-gray-200 overflow-hidden max-w-2xl">
                  <div className="grid grid-cols-3 gap-0 p-2 bg-gray-50 text-sm border-b border-gray-200">
                    <div className="col-span-2 text-gray-700 font-medium px-2">ファイル名</div>
                    <div className="col-span-1 text-gray-700 font-medium px-2">備考</div>
                  </div>

                  <div className="divide-y divide-gray-100">
                    {receipts.map((receipt) => (
                      <div 
                        key={receipt.id} 
                        className="grid grid-cols-3 gap-0 p-1.5 hover:bg-gray-50/50 items-center"
                      >
                        <div className="col-span-2 px-2">
                          <button
                            onClick={() => {
                              setSelectedReceipt(receipt)
                              setShowReceiptViewer(true)
                            }}
                            className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {receipt.fileName}
                          </button>
                        </div>
                        <div className="col-span-1 px-2">
                          <Input
                            value={receipt.remarks}
                            onChange={(e) => handleReceiptRemarksChange(receipt.id, e.target.value)}
                            className="h-7 text-sm"
                            placeholder="備考を入力"
                          />
                        </div>
                        <div className="col-span-1 px-2">
                          {(status === '00' || status === '03') && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteReceipt(receipt.id)}
                              className="h-7 w-7"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-red-500" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 領収書入力モーダル */}
              {showReceiptInput && (
                <AnimatePresence>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                  >
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className="bg-white rounded-lg p-6 w-[500px]"
                    >
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                          <FileText className="h-5 w-5 text-purple-600" />
                          <h3 className="text-lg font-semibold">領収書・定期券の追加</h3>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setShowReceiptInput(false)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-medium mb-1 block">ファイル</label>
                          <div className="flex items-center gap-2">
                            <label className="flex-1">
                              <input
                                type="file"
                                className="hidden"
                                accept="image/*,.pdf"
                                onChange={handleFileUpload}
                                disabled={isUploading}
                              />
                              <Button
                                variant="outline"
                                className="w-full bg-gray-50 hover:bg-gray-100 text-gray-900 border-gray-200"
                                disabled={isUploading}
                                onClick={() => {
                                  const input = document.querySelector('input[type="file"]') as HTMLInputElement
                                  if (input) {
                                    input.click()
                                  }
                                }}
                              >
                                {isUploading ? (
                                  <span className="flex items-center gap-2">
                                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    アップロード中...
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-2">
                                    <Upload className="h-4 w-4" />
                                    ファイルを選択
                                  </span>
                                )}
                              </Button>
                            </label>
                          </div>
                          {uploadError && (
                            <p className="text-sm text-red-500 mt-1">{uploadError}</p>
                          )}
                        </div>

                        <div>
                          <label className="text-sm font-medium mb-1 block">備考</label>
                          <Input
                            value={newReceipt?.remarks || ''}
                            onChange={(e) => setNewReceipt(prev => ({ ...prev, remarks: e.target.value }))}
                            placeholder="備考を入力"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 mt-6">
                        <Button
                          variant="outline"
                          onClick={() => setShowReceiptInput(false)}
                        >
                          キャンセル
                        </Button>
                        <Button
                          onClick={() => {
                            if (newReceipt?.fileUrl && newReceipt?.fileName) {
                              const filePath = newReceipt.fileUrl.split('?')[0].split('/').slice(-1)[0];
                              const receipt: ReceiptRecord = {
                                id: Date.now().toString(),
                                fileName: newReceipt.fileName,
                                fileUrl: newReceipt.fileUrl,
                                filePath: filePath,
                                remarks: newReceipt.remarks || '',
                                uploadedAt: new Date().toISOString()
                              }
                              setReceipts([...receipts, receipt])
                              setShowReceiptInput(false)
                              setNewReceipt({
                                id: Date.now().toString(),
                                fileName: '',
                                fileUrl: '',
                                filePath: '',
                                remarks: '',
                                uploadedAt: new Date().toISOString()
                              })
                            }
                          }}
                          disabled={!newReceipt?.fileUrl}
                          className="bg-purple-600 hover:bg-purple-700"
                        >
                          追加
                        </Button>
                      </div>
                    </motion.div>
                  </motion.div>
                </AnimatePresence>
              )}

              {/* 領収書ビューワーモーダル */}
              {showReceiptViewer && selectedReceipt && (
                <AnimatePresence>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                  >
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className="bg-white rounded-lg p-6 w-[90vw] h-[90vh] flex flex-col"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold">{selectedReceipt.fileName}</h3>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setShowReceiptViewer(false)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex-1 overflow-auto">
                        {selectedReceipt.fileUrl.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                          <img
                            src={selectedReceipt.fileUrl}
                            alt={selectedReceipt.fileName}
                            className="max-w-full h-auto"
                          />
                        ) : (
                          <iframe
                            src={selectedReceipt.fileUrl}
                            className="w-full h-full"
                            title={selectedReceipt.fileName}
                          />
                        )}
                      </div>
                    </motion.div>
                  </motion.div>
                </AnimatePresence>
              )}

              {/* 保存ボタンエリア */}
              <div className="flex justify-end mt-6 mb-4">
                <div className="flex items-center gap-4">
                  {saveError && (
                    <div className="flex items-center text-red-500">
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      <span className="text-sm">{saveError}</span>
                    </div>
                  )}
                  {saveSuccess && (
                    <div className="flex items-center text-green-500">
                      <span className="text-sm">保存が完了しました</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="business">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center text-muted-foreground">
                業務請求機能は準備中です
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}