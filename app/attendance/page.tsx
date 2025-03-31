"use client"

import { useState, useMemo, useEffect } from "react"
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
  CheckCircle, XCircle, ArrowLeftRight, CalendarPlus } from "lucide-react"
import { useI18n } from "@/lib/i18n/context"
import { supabase } from '@/lib/supabaseClient'
import { AnimatePresence, motion } from "framer-motion"

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

export default function AttendancePage() {
  const { t } = useI18n()
  const [currentDate, setCurrentDate] = useState(new Date())
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

  // 勤怠データを取得する関数
  const fetchAttendanceData = async (year: number, month: number) => {
    if (!userInfo?.id) return;
    
    setIsLoading(true)
    try {
      // 1. 勤怠ヘッダーを取得
      const { data: headerData, error: headerError } = await supabase
        .from('attendance_headers')
        .select('*')
        .eq('user_id', userInfo.id)
        .eq('year', year)
        .eq('month', month)
        .maybeSingle()

      if (headerError) throw headerError

      if (headerData) {
        // 勤務場所を設定
        setWorkplace(headerData.workplace || '')
        // ステータスを設定
        setStatus(headerData.status || '00')

        // 2. 勤怠詳細を取得
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
        console.log('No header data found, initializing empty data')
        setAttendanceData({})
        // セッションストレージの値を使用して勤務場所を初期化
        const storedWorkplace = sessionStorage.getItem('workplace')
        setWorkplace(storedWorkplace || '')
        // ステータスを初期化
        setStatus('00')
      }
      
      // 検索完了時にメッセージをクリア
      setMessageWithStability(null)
    } catch (error) {
      console.error('Error fetching attendance data:', error)
      setMessageWithStability({ type: 'error', text: '勤怠データの取得に失敗しました' })
    } finally {
      setIsLoading(false)
    }
  }

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

  // 初期表示時のデータ取得
  useEffect(() => {
    if (userInfo?.id) {
      const year = currentDate.getFullYear()
      const month = currentDate.getMonth() + 1
      fetchAttendanceData(year, month)
    }
  }, [userInfo, currentDate])

  // 年選択時のハンドラー
  const handleYearChange = (year: string) => {
    const newDate = new Date(currentDate)
    newDate.setFullYear(parseInt(year))
    setCurrentDate(newDate)
    setMessageWithStability({ 
      type: 'info', 
      text: '勤怠データを検索中です...',
      position: 'center',
      alignment: 'center',
      persistent: true
    });
    fetchAttendanceData(parseInt(year), newDate.getMonth() + 1)
  }

  // 月選択時のハンドラー
  const handleMonthChange = (month: string) => {
    const newDate = new Date(currentDate)
    newDate.setMonth(parseInt(month) - 1)
    setCurrentDate(newDate)
    setMessageWithStability({ 
      type: 'info', 
      text: '勤怠データを検索中です...',
      position: 'center',
      alignment: 'center',
      persistent: true
    });
    fetchAttendanceData(newDate.getFullYear(), parseInt(month))
  }

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
      await fetchAttendanceData(year, month);
      
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

      <Tabs defaultValue="attendance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="attendance">勤怠入力</TabsTrigger>
          <TabsTrigger value="expenses">経費請求</TabsTrigger>
          <TabsTrigger value="business">業務請求</TabsTrigger>
        </TabsList>

        <TabsContent value="attendance">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-6">
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
                  ) : (
                    <Button 
                      onClick={moveToEditStatus} 
                      className="bg-amber-600 hover:bg-amber-700"
                      disabled={isLoading || isSaving}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      再編集
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-7 gap-x-4 mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex justify-between items-center gap-2">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <CalendarDays className="h-4 w-4" />
                    {t("total-work-days")}:
                  </span>
                  <span className="font-medium">{summary.totalWorkDays}{t("days-suffix")}</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Briefcase className="h-4 w-4" />
                    {t("regular-work-days")}:
                  </span>
                  <span className="font-medium">{summary.regularWorkDays}{t("days-suffix")}</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <CalendarPlus className="h-4 w-4" />
                    {t("holiday-work-days")}:
                  </span>
                  <span className="font-medium">{summary.holidayWorkDays}{t("days-suffix")}</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <CalendarX className="h-4 w-4" />
                    {t("absence-days")}:
                  </span>
                  <span className="font-medium">{summary.absenceDays}{t("days-suffix")}</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Clock4 className="h-4 w-4" />
                    {t("total-work-time")}:
                  </span>
                  <span className="font-medium">{summary.totalWorkTime}{t("hours")}</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <ArrowLeftRight className="h-4 w-4" />
                    {t("late-early-hours")}:
                  </span>
                  <span className="font-medium">{summary.lateEarlyHours}{t("hours")}</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <CalendarCheck className="h-4 w-4" />
                    {t("paid-leave-days")}:
                  </span>
                  <span className="font-medium">{summary.paidLeaveDays}{t("days-suffix")}</span>
                </div>
              </div>

              <div className="border rounded-lg border-gray-300 shadow-sm">
                <div className="grid grid-cols-12 gap-0 p-2 bg-blue-50 dark:bg-gray-800 rounded-t-lg text-sm border-b border-gray-300">
                  <div className="col-span-1 text-gray-500 font-medium flex items-center gap-1 px-6">
                    <Calendar className="h-4 w-4" />
                    {t("date")}
                  </div>
                  <div className="col-span-1 text-gray-500 font-medium flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {t("start-time")}
                  </div>
                  <div className="col-span-1 text-gray-500 font-medium flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {t("end-time")}
                  </div>
                  <div className="col-span-1 text-gray-500 font-medium flex items-center gap-1">
                    <Timer className="h-4 w-4" />
                    {t("break-time")}
                  </div>
                  <div className="col-span-1 text-gray-500 font-medium flex items-center gap-1">
                    <CalendarClock className="h-4 w-4" />
                    {t("actual-time")}
                  </div>
                  <div className="col-span-2 text-gray-500 font-medium flex items-center gap-1">
                    <Briefcase className="h-4 w-4" />
                    {t("attendance-type")}
                  </div>
                  <div className="col-span-4 text-gray-500 font-medium flex items-center gap-1">
                    <Info className="h-4 w-4" />
                    {t("remarks")}
                  </div>
                  <div className="col-span-1 text-gray-500 font-medium flex items-center gap-1">
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
                            : isWeekend 
                              ? 'bg-gray-50 dark:bg-gray-800/50' 
                              : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                        }`}
                      >
                        <div className={`col-span-1 text-sm font-medium px-6 ${isEditable() ? 'py-1.5' : 'py-1'}`}>
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
              <div className="text-center text-muted-foreground">
                経費請求機能は準備中です
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