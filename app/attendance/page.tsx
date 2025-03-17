"use client"

import { useState, useMemo, useEffect } from "react"
import React from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parse, differenceInMinutes } from "date-fns"
import { ja } from "date-fns/locale/ja"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Clock, Save, AlertCircle, CheckCircle2, Info, X } from "lucide-react"
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
  position?: 'top' | 'bottom'  // 表示位置
  alignment?: 'left' | 'center'  // 文字寄せ
  dismissible?: boolean  // 手動で消せるフラグ
}

export default function AttendancePage() {
  const { t } = useI18n()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [workplace, setWorkplace] = useState("")
  const [isLoading, setIsLoading] = useState(false)
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

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })

  // 勤務状況のサマリーを計算
  const summary = useMemo(() => {
    const entries = Object.entries(attendanceData)
    const workingDays = entries.filter(([_, data]) => data.actualTime && data.actualTime !== "00:00")
    const regularWorkDays = workingDays.filter(([_, data]) => 
      !["late", "early-leave", "absence"].includes(data.type || ""))
    const holidayWorkDays = workingDays.filter(([_, data]) => data.type === "holiday-work")
    const absenceDays = entries.filter(([_, data]) => data.type === "absence")
    const actualTimes = workingDays.map(([_, data]) => data.actualTime)
    const lateEarlyHours = entries.reduce((acc, [_, data]) => {
      const hours = parseFloat(data.lateEarlyHours || "0")
      return acc + (isNaN(hours) ? 0 : hours)
    }, 0)
    const paidLeaveDays = entries.reduce((acc, [_, data]) => {
      if (data.type === "full-leave") return acc + 1
      if (data.type === "half-leave") return acc + 0.5
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
          const breakTime = `${breakHours}:${breakMinutes.toString().padStart(2, '0')}`

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
            lateEarlyHours: detail.late_early_hours?.toString() || ''
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
      }
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
    fetchAttendanceData(parseInt(year), newDate.getMonth() + 1)
  }

  // 月選択時のハンドラー
  const handleMonthChange = (month: string) => {
    const newDate = new Date(currentDate)
    newDate.setMonth(parseInt(month) - 1)
    setCurrentDate(newDate)
    fetchAttendanceData(newDate.getFullYear(), parseInt(month))
  }

  // メッセージの自動消去
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    
    if (message && (message.type === 'success' || message.type === 'info')) {
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
    
    setMessage(newMessage);
  }

  // メッセージを閉じる処理
  const handleCloseMessage = () => {
    setMessageWithStability(null);
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

    // 入力データのバリデーションチェック
    Object.entries(attendanceData).forEach(([date, data]) => {
      const { startTime, endTime } = data;
      const dateDisplay = format(new Date(date), 'M/d');

      // 時刻形式のバリデーション（HH:MM形式かどうか）
      const timePattern = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/;
      
      // 開始時間のチェック
      if (startTime && !timePattern.test(startTime)) {
        validationErrors.push(`${dateDisplay}の開始時間「${startTime}」が正しい形式（HH:MM）ではありません。`);
      }
      
      // 終了時間のチェック
      if (endTime && !timePattern.test(endTime)) {
        validationErrors.push(`${dateDisplay}の終了時間「${endTime}」が正しい形式（HH:MM）ではありません。`);
      }
      
      // 開始時間と終了時間の逆転チェック
      if (startTime && endTime && timePattern.test(startTime) && timePattern.test(endTime)) {
        const start = parse(startTime, 'HH:mm', new Date());
        const end = parse(endTime, 'HH:mm', new Date());
        
        if (end < start) {
          validationErrors.push(`${dateDisplay}の終了時間（${endTime}）が開始時間（${startTime}）より前になっています。`);
        }
      }
    });

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
      setIsLoading(true);
      setMessageWithStability(null);

      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;

      console.log('勤怠データを保存します:', { 
        year, 
        month, 
        userId: userInfo.id,
        employeeId: userInfo.employee_id,
        branchCode: branchInfo.code
      });

      // 1. 勤怠ヘッダーを作成または更新
      const { data: existingHeader, error: fetchError } = await supabase
        .from('attendance_headers')
        .select('id')
        .eq('user_id', userInfo.id)
        .eq('year', year)
        .eq('month', month)
        .maybeSingle();

      if (fetchError) {
        console.error('既存ヘッダー取得エラー:', fetchError);
        throw new Error('勤怠ヘッダーの取得に失敗しました');
      }

      // サマリーデータを計算
      const headerData = {
        user_id: userInfo.id,
        employee_id: userInfo.employee_id,
        branch: branchInfo.code,  // branch_code を使用
        year,
        month,
        workplace,
        status: '00', // ドラフト保存
        total_working_days: summary.totalWorkDays,
        holiday_working_days: summary.holidayWorkDays,
        absence_days: summary.absenceDays,
        total_working_hours: parseFloat(summary.totalWorkTime),
        late_early_hours: parseFloat(summary.lateEarlyHours),
        paid_leave_days: summary.paidLeaveDays,
        updated_at: new Date().toISOString(),
        updated_by: userInfo.id
      };

      console.log('保存するヘッダーデータ:', headerData);

      let headerId: string | undefined;
      if (existingHeader) {
        console.log('既存ヘッダーを更新します:', existingHeader.id);
        // 既存のヘッダーを更新
        const { error: updateError } = await supabase
          .from('attendance_headers')
          .update(headerData)
          .eq('id', existingHeader.id);

        if (updateError) {
          console.error('ヘッダー更新エラー:', updateError);
          throw new Error('勤怠ヘッダーの更新に失敗しました');
        }
        headerId = existingHeader.id;
      } else {
        console.log('新規ヘッダーを作成します');
        // 新規ヘッダーを作成
        const { data: newHeader, error: insertError } = await supabase
          .from('attendance_headers')
          .insert({
            ...headerData,
            created_at: new Date().toISOString(),
            created_by: userInfo.id
          })
          .select('id')
          .single();

        if (insertError) {
          console.error('ヘッダー作成エラー:', insertError);
          throw new Error(`勤怠ヘッダーの作成に失敗しました: ${insertError.message}`);
        }
        
        if (!newHeader || !newHeader.id) {
          console.error('ヘッダー作成後のIDが取得できませんでした');
          throw new Error('勤怠ヘッダーの作成に失敗しました: IDが取得できません');
        }
        
        headerId = newHeader.id;
      }

      console.log('ヘッダーの保存に成功しました:', headerId);

      // 2. 既存の勤怠詳細を削除（一旦全削除して再作成）
      if (!headerId) {
        console.error('ヘッダーIDが不明なため、詳細データを保存できません');
        throw new Error('勤怠ヘッダーIDが取得できないため、詳細を保存できません');
      }
      
      const { error: deleteError } = await supabase
        .from('attendance_details')
        .delete()
        .eq('header_id', headerId);

      if (deleteError) {
        console.error('既存詳細削除エラー:', deleteError);
        throw new Error('既存の勤怠詳細の削除に失敗しました');
      }

      // 3. 勤怠詳細を作成
      const detailsData = Object.entries(attendanceData)
        .filter(([_, data]) => 
          // 入力されているデータのみを対象とする
          data.startTime || data.endTime || data.type !== 'none' || data.remarks
        )
        .map(([date, data]) => {
          // 勤務形態コードをマッピング
          let workTypeCode = '01'; // デフォルトは通常勤務
          switch (data.type) {
            case 'holiday-work': workTypeCode = '02'; break;
            case 'paid-leave': workTypeCode = '03'; break;
            case 'am-leave': workTypeCode = '04'; break;
            case 'pm-leave': workTypeCode = '05'; break;
            case 'special-leave': workTypeCode = '06'; break;
            case 'compensatory-leave': workTypeCode = '07'; break;
            case 'compensatory-leave-planned': workTypeCode = '08'; break;
            case 'absence': workTypeCode = '09'; break;
            case 'late': workTypeCode = '10'; break;
            case 'early-leave': workTypeCode = '11'; break;
            case 'delay': workTypeCode = '12'; break;
            case 'shift': workTypeCode = '13'; break;
            case 'business-holiday': workTypeCode = '14'; break;
          }

          // 実労働時間を計算
          let actualWorkingHours = 0;
          if (data.actualTime) {
            const [hours, minutes] = data.actualTime.split(':').map(Number);
            actualWorkingHours = hours + (minutes / 60);
          }

          // 休憩時間を分単位に変換
          let breakTimeMinutes = 0;
          if (data.breakTime) {
            const [hours, minutes] = data.breakTime.split(':').map(Number);
            breakTimeMinutes = (hours * 60) + minutes;
          }

          // 遅刻・早退時間は入力がある場合のみ数値に変換
          const lateEarlyHours = data.lateEarlyHours ? parseFloat(data.lateEarlyHours) : null;

          return {
            header_id: headerId,
            date,
            start_time: data.startTime || null,
            end_time: data.endTime || null,
            break_time: breakTimeMinutes,
            actual_working_hours: actualWorkingHours,
            work_type_code: workTypeCode,
            late_early_hours: lateEarlyHours,
            remarks: data.remarks || '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            created_by: userInfo.id,
            updated_by: userInfo.id
          };
        });

      console.log(`保存する詳細データ: ${detailsData.length}件`);

      if (detailsData.length > 0) {
        const { error: insertDetailsError } = await supabase
          .from('attendance_details')
          .insert(detailsData);

        if (insertDetailsError) {
          console.error('詳細データ保存エラー:', insertDetailsError);
          throw new Error('勤怠詳細の保存に失敗しました');
        }
      }

      console.log('詳細データの保存に成功しました');
      setMessageWithStability({ 
        type: 'success', 
        text: '勤怠データを保存しました',
        position: 'bottom'
      });
      
      // 保存後にデータを再取得
      await fetchAttendanceData(year, month);
    } catch (error) {
      console.error('保存処理でエラーが発生しました:', error);
      setMessageWithStability({ 
        type: 'error', 
        text: error instanceof Error ? error.message : '勤怠データの保存に失敗しました',
        persistent: true,
        position: 'top'
      });
    } finally {
      setIsLoading(false);
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

    // エラーとワーニングは上部に表示
    if (message.type === 'error')
      return (
        <div className="relative mb-4 pointer-events-auto w-1/2">
          <AnimatePresence>
            {message && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2 }}
                className={`
                  flex items-center justify-between
                  rounded-lg border p-4 
                  shadow-lg
                  ${styles[message.type]}
                `}
              >
                <div className="flex items-start gap-2">
                  <div className="mt-1">
                    {icons[message.type]}
                  </div>
                  <span className="text-sm font-medium whitespace-pre-line">{formattedMessage}</span>
                </div>
                <button
                  onClick={handleCloseMessage}
                  className="p-1 hover:bg-gray-100 rounded-full"
                >
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )

    // 正常メッセージは下部に表示
    return (
      <div className="fixed bottom-8 left-0 right-0 z-[100] flex justify-center pointer-events-none">
        <AnimatePresence>
          {message && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.2 }}
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
                    <Input
                      value={workplace}
                      onChange={(e) => setWorkplace(e.target.value)}
                      className="w-64"
                      placeholder={t("enter-workplace")}
                    />
                  </div>
                </div>

                <Button 
                  onClick={handleSave} 
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={isLoading}
                >
                  {isLoading ? (
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
              </div>

              <div className="grid grid-cols-7 gap-x-4 mb-6">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{t("total-work-days")}:</span>
                  <span className="font-medium">{summary.totalWorkDays}{t("days-suffix")}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{t("regular-work-days")}:</span>
                  <span className="font-medium">{summary.regularWorkDays}{t("days-suffix")}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{t("holiday-work-days")}:</span>
                  <span className="font-medium">{summary.holidayWorkDays}{t("days-suffix")}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{t("absence-days")}:</span>
                  <span className="font-medium">{summary.absenceDays}{t("days-suffix")}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{t("total-work-time")}:</span>
                  <span className="font-medium">{summary.totalWorkTime}{t("hours")}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{t("late-early-hours")}:</span>
                  <span className="font-medium">{summary.lateEarlyHours}{t("hours")}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{t("paid-leave-days")}:</span>
                  <span className="font-medium">{summary.paidLeaveDays}{t("days-suffix")}</span>
                </div>
              </div>

              <div className="border rounded-lg border-gray-300 shadow-sm">
                <div className="grid grid-cols-12 gap-2 p-2 bg-white dark:bg-gray-800 rounded-t-lg text-sm border-b border-gray-300">
                  <div className="col-span-1 text-gray-500 font-medium">{t("date")}</div>
                  <div className="col-span-1 text-gray-500 font-medium">{t("start-time")}</div>
                  <div className="col-span-1 text-gray-500 font-medium">{t("end-time")}</div>
                  <div className="col-span-1 text-gray-500 font-medium">{t("break-time")}</div>
                  <div className="col-span-1 text-gray-500 font-medium">{t("actual-time")}</div>
                  <div className="col-span-2 text-gray-500 font-medium">{t("attendance-type")}</div>
                  <div className="col-span-4 text-gray-500 font-medium">{t("remarks")}</div>
                  <div className="col-span-1 text-gray-500 font-medium">{t("late-early-hours")}</div>
                </div>

                <div className="divide-y divide-gray-300">
                  {days.map((day) => {
                    const dateKey = format(day, 'yyyy-MM-dd')
                    const dayOfWeek = format(day, 'E', { locale: ja })
                    const isWeekend = [0, 6].includes(day.getDay())
                    const isHoliday = attendanceData[dateKey]?.type === 'holiday-work' || 
                                      attendanceData[dateKey]?.type === 'paid-leave' || 
                                      attendanceData[dateKey]?.type === 'special-leave' ||
                                      attendanceData[dateKey]?.type === 'compensatory-leave'

                    return (
                      <div
                        key={dateKey}
                        className={`grid grid-cols-12 gap-2 p-2 items-center ${
                          isWeekend 
                            ? 'bg-gray-200 dark:bg-gray-700' 
                            : isHoliday 
                              ? 'bg-gray-100 dark:bg-gray-800'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                        }`}
                      >
                        <div className="col-span-1 text-sm font-medium">
                          {format(day, 'M/d')}({dayOfWeek})
                        </div>
                        <div className="col-span-1">
                          <Input
                            type="text"
                            inputMode="numeric"
                            placeholder="HH:MM"
                            value={attendanceData[dateKey]?.startTime || ""}
                            onChange={(e) => handleTimeChange(day, 'startTime', e.target.value)}
                            onBlur={() => handleTimeBlur(day)}
                            className="h-8 text-center placeholder:text-gray-300 border-[#d1d5db] border-opacity-85"
                          />
                        </div>
                        <div className="col-span-1">
                          <Input
                            type="text"
                            inputMode="numeric"
                            placeholder="HH:MM"
                            value={attendanceData[dateKey]?.endTime || ""}
                            onChange={(e) => handleTimeChange(day, 'endTime', e.target.value)}
                            onBlur={() => handleTimeBlur(day)}
                            className="h-8 text-center placeholder:text-gray-300 border-[#d1d5db] border-opacity-85"
                          />
                        </div>
                        <div className="col-span-1">
                          <Input
                            type="text"
                            inputMode="numeric"
                            placeholder="HH:MM"
                            value={attendanceData[dateKey]?.breakTime || ""}
                            onChange={(e) => handleTimeChange(day, 'breakTime', e.target.value)}
                            onBlur={() => handleTimeBlur(day)}
                            className="h-8 text-center placeholder:text-gray-300 border-[#d1d5db] border-opacity-85"
                          />
                        </div>
                        <div className="col-span-1">
                          <div className="h-8 flex items-center justify-center font-medium">
                            {attendanceData[dateKey]?.actualTime || ""}
                          </div>
                        </div>
                        <div className="col-span-2">
                          <Select
                            onValueChange={(value) => handleTimeChange(day, 'type', value)}
                            value={attendanceData[dateKey]?.type || "none"}
                          >
                            <SelectTrigger className="h-8 border-[#d1d5db] border-opacity-85">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none" className="h-8"></SelectItem>
                              <SelectItem value="holiday-work" className="h-8">休出</SelectItem>
                              <SelectItem value="paid-leave" className="h-8">有休</SelectItem>
                              <SelectItem value="am-leave" className="h-8">前休</SelectItem>
                              <SelectItem value="pm-leave" className="h-8">後休</SelectItem>
                              <SelectItem value="special-leave" className="h-8">特休</SelectItem>
                              <SelectItem value="compensatory-leave" className="h-8">振休</SelectItem>
                              <SelectItem value="compensatory-leave-planned" className="h-8">振予</SelectItem>
                              <SelectItem value="absence" className="h-8">欠勤</SelectItem>
                              <SelectItem value="late" className="h-8">遅刻</SelectItem>
                              <SelectItem value="early-leave" className="h-8">早退</SelectItem>
                              <SelectItem value="delay" className="h-8">遅延</SelectItem>
                              <SelectItem value="shift" className="h-8">シフト</SelectItem>
                              <SelectItem value="business-holiday" className="h-8">休業</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-4">
                          <Input
                            type="text"
                            value={attendanceData[dateKey]?.remarks || ""}
                            onChange={(e) => handleTimeChange(day, 'remarks', e.target.value)}
                            className="h-8 placeholder:text-gray-300 border-[#d1d5db] border-opacity-85"
                            placeholder={t("remarks-placeholder")}
                          />
                        </div>
                        <div className="col-span-1">
                          <Input
                            type="text"
                            inputMode="numeric"
                            placeholder="0.0"
                            value={attendanceData[dateKey]?.lateEarlyHours || ""}
                            onChange={(e) => handleTimeChange(day, 'lateEarlyHours', e.target.value)}
                            className="h-8 text-center placeholder:text-gray-300 border-[#d1d5db] border-opacity-85"
                          />
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