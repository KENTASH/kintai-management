"use client"

import { useState, useMemo } from "react"
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parse, differenceInMinutes } from "date-fns"
import { ja } from "date-fns/locale"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Clock, Save } from "lucide-react"
import { useI18n } from "@/lib/i18n/context"

// ダミーユーザーデータ
const dummyUser = {
  employeeId: "1001",
  department: "NISZ浜松",
  name: "管理者 テスト",
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

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours.toString().padStart(3, '0')}:${minutes.toString().padStart(2, '0')}`
}

export default function AttendancePage() {
  const { t } = useI18n()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [workplace, setWorkplace] = useState("")
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

  const handleYearChange = (year: string) => {
    setCurrentDate(new Date(parseInt(year), currentDate.getMonth()))
  }

  const handleMonthChange = (month: string) => {
    setCurrentDate(new Date(currentDate.getFullYear(), parseInt(month) - 1))
  }

  const handleTimeChange = (date: Date, field: string, value: string) => {
    const dateKey = format(date, 'yyyy-MM-dd')
    setAttendanceData(prev => {
      const newData = {
        ...prev,
        [dateKey]: {
          ...prev[dateKey],
          [field]: field === 'startTime' || field === 'endTime' || field === 'breakTime' 
            ? formatTimeString(value) 
            : value
        }
      }

      if ((field === 'startTime' || field === 'endTime' || field === 'breakTime') && 
          newData[dateKey]?.startTime?.includes(':') && 
          newData[dateKey]?.endTime?.includes(':') &&
          newData[dateKey]?.breakTime?.includes(':')) {
        newData[dateKey].actualTime = calculateActualTime(
          newData[dateKey].startTime,
          newData[dateKey].endTime,
          newData[dateKey].breakTime
        )
      }

      return newData
    })
  }

  const handleSave = () => {
    console.log('Saving attendance data:', attendanceData)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Clock className="h-8 w-8 text-blue-600" />
          勤怠入力・経費請求
        </h1>
        <p className="text-muted-foreground">
          日々の勤怠情報と経費を登録します
        </p>
      </div>

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
                      <div className="font-medium">{dummyUser.employeeId}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">{t("department")}</div>
                      <div className="font-medium">{dummyUser.department}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">{t("name")}</div>
                      <div className="font-medium">{dummyUser.name}</div>
                    </div>
                    <Input
                      value={workplace}
                      onChange={(e) => setWorkplace(e.target.value)}
                      className="w-64"
                      placeholder={t("enter-workplace")}
                    />
                  </div>
                </div>

                <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
                  <Save className="h-4 w-4 mr-2" />
                  {t("save")}
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
                  <span className="font-medium">{summary.totalWorkTime}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{t("late-early-days")}:</span>
                  <span className="font-medium">{summary.lateEarlyHours}{t("hours")}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{t("paid-leave-days")}:</span>
                  <span className="font-medium">{summary.paidLeaveDays}{t("days-suffix")}</span>
                </div>
              </div>

              <div className="border rounded-lg">
                <div className="grid grid-cols-28 gap-2 p-2 bg-gray-100 dark:bg-gray-800 rounded-t-lg font-medium text-sm">
                  <div className="col-span-2">{t("date")}</div>
                  <div className="col-span-3">{t("start-time")}</div>
                  <div className="col-span-3">{t("end-time")}</div>
                  <div className="col-span-3">{t("break-time")}</div>
                  <div className="col-span-3">{t("actual-time")}</div>
                  <div className="col-span-4">{t("attendance-type")}</div>
                  <div className="col-span-8">{t("remarks")}</div>
                  <div className="col-span-2">{t("late-early-hours")}</div>
                </div>

                <div className="divide-y">
                  {days.map((day) => {
                    const dateKey = format(day, 'yyyy-MM-dd')
                    const dayOfWeek = format(day, 'E', { locale: ja })
                    const isWeekend = [0, 6].includes(day.getDay())

                    return (
                      <div
                        key={dateKey}
                        className={`grid grid-cols-28 gap-2 p-2 items-center ${
                          isWeekend ? 'bg-gray-50 dark:bg-gray-900' : ''
                        }`}
                      >
                        <div className="col-span-2 text-sm">
                          {format(day, 'M/d')}({dayOfWeek})
                        </div>
                        <div className="col-span-3">
                          <Input
                            type="text"
                            inputMode="numeric"
                            placeholder="HH:MM"
                            value={attendanceData[dateKey]?.startTime || ""}
                            onChange={(e) => handleTimeChange(day, 'startTime', e.target.value)}
                            className="h-8 text-center"
                          />
                        </div>
                        <div className="col-span-3">
                          <Input
                            type="text"
                            inputMode="numeric"
                            placeholder="HH:MM"
                            value={attendanceData[dateKey]?.endTime || ""}
                            onChange={(e) => handleTimeChange(day, 'endTime', e.target.value)}
                            className="h-8 text-center"
                          />
                        </div>
                        <div className="col-span-3">
                          <Input
                            type="text"
                            inputMode="numeric"
                            placeholder="HH:MM"
                            value={attendanceData[dateKey]?.breakTime || ""}
                            onChange={(e) => handleTimeChange(day, 'breakTime', e.target.value)}
                            className="h-8 text-center"
                          />
                        </div>
                        <div className="col-span-3">
                          <Input
                            type="text"
                            value={attendanceData[dateKey]?.actualTime || ""}
                            disabled
                            className="h-8 bg-gray-50 dark:bg-gray-800 text-center"
                          />
                        </div>
                        <div className="col-span-4">
                          <Select
                            onValueChange={(value) => handleTimeChange(day, 'type', value)}
                            value={attendanceData[dateKey]?.type || "none"}
                          >
                            <SelectTrigger className="h-8">
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
                        <div className="col-span-8">
                          <Input
                            type="text"
                            value={attendanceData[dateKey]?.remarks || ""}
                            onChange={(e) => handleTimeChange(day, 'remarks', e.target.value)}
                            className="h-8"
                            placeholder={t("remarks-placeholder")}
                          />
                        </div>
                        <div className="col-span-2">
                          <Input
                            type="text"
                            inputMode="numeric"
                            placeholder="0.0"
                            value={attendanceData[dateKey]?.lateEarlyHours || ""}
                            onChange={(e) => handleTimeChange(day, 'lateEarlyHours', e.target.value)}
                            className="h-8 text-center"
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