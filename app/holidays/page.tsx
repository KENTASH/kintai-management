"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Calendar } from "@/components/ui/calendar"
import { format } from "date-fns"
import { ja } from "date-fns/locale/ja"
import { Plus, Trash2, CalendarCheck2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { useRouter } from 'next/navigation'
import Head from 'next/head'

interface Holiday {
  id: string
  year: number
  date: string
  remarks: string
  created_at: string
  updated_at: string
}

export default function HolidaysPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState<string>("")
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())
  const [remarks, setRemarks] = useState<string>('')
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // 休日データの取得
  const fetchHolidays = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/holidays?year=${selectedYear}`)
      
      if (!response.ok) {
        const data = await response.json()
        toast({
          variant: "destructive",
          description: data.error || "休日データの取得に失敗しました",
        })
        return
      }
      
      const data = await response.json()
      setHolidays(data || [])
    } catch (error) {
      console.error('休日データの取得エラー:', error)
      toast({
        variant: "destructive",
        description: "システムエラーが発生しました。",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // 初期表示時と年が変更された時にデータを取得
  useEffect(() => {
    fetchHolidays()
  }, [selectedYear])

  // 表示する休日データをフィルタリング（月指定がある場合）
  const filteredHolidays = selectedMonth 
    ? holidays.filter(holiday => {
        const holidayDate = new Date(holiday.date)
        const month = holidayDate.getMonth() + 1 // JavaScriptの月は0始まり
        return month === parseInt(selectedMonth)
      })
    : holidays

  // 休日データの登録
  const handleSubmit = async () => {
    if (!selectedDate) {
      toast({
        variant: "destructive",
        title: "エラー",
        description: "日付を選択してください",
      })
      return
    }

    const formattedDate = format(selectedDate, 'yyyy-MM-dd')
    const selectedYearFromDate = selectedDate.getFullYear()
    
    // 既存データとの重複チェック
    const isDuplicate = holidays.some(holiday => 
      holiday.date === formattedDate && holiday.year === selectedYearFromDate
    )
    
    if (isDuplicate) {
      toast({
        variant: "destructive",
        title: "エラー",
        description: "同一日付を重複して登録することはできません。",
      })
      return
    }

    try {
      setIsLoading(true)
      const response = await fetch('/api/holidays', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          year: selectedYearFromDate,
          date: formattedDate,
          remarks: remarks || '', // 空の場合は空文字を送信
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 409) {
          toast({
            variant: "destructive",
            title: "エラー",
            description: "同一日付を重複して登録することはできません。",
          })
        } else {
          toast({
            variant: "destructive",
            title: "エラー",
            description: data.error || "休日データの登録に失敗しました",
          })
        }
        return
      }

      // フォームをリセット
      setSelectedDate(new Date())
      setRemarks('')
      
      // 成功メッセージを表示
      setTimeout(() => {
        toast({
          title: "成功",
          description: "休日データを登録しました",
        })
      }, 100)
      
      // データを再取得
      fetchHolidays()
    } catch (error) {
      console.error('休日データの登録エラー:', error)
      toast({
        variant: "destructive",
        title: "エラー",
        description: "システムエラーが発生しました。",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // 休日データの削除
  const handleDelete = async (id: string) => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/holidays?id=${id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        toast({
          variant: "destructive",
          title: "エラー",
          description: data.error || "休日データの削除に失敗しました",
        })
        return
      }

      // 成功メッセージを表示
      setTimeout(() => {
        toast({
          title: "成功",
          description: "休日データを削除しました",
        })
      }, 100)

      // データを再取得
      fetchHolidays()
    } catch (error) {
      console.error('休日データの削除エラー:', error)
      toast({
        variant: "destructive",
        title: "エラー",
        description: "システムエラーが発生しました。",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <Head>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <CalendarCheck2 className="h-8 w-8 text-blue-600" />
            休日マスタ設定
        </h1>
        <p className="text-muted-foreground">
            会社指定の休日を設定します。
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
            {/* 左右2カラムレイアウト（左側を狭く、右側を広く） */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* 左側：カレンダーと登録フォーム（1/3幅） */}
              <div className="space-y-6 max-w-[320px]">
              <div>
                  <Label>日付</Label>
                  <div className="w-full mt-1 flex justify-center">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      locale={ja}
                      className="rounded-md border mt-[21px]"
                    />
                  </div>
                </div>
                
                <div className="w-full">
                  <Label>備考</Label>
                  <Input
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="備考を入力"
                    className="mt-1 w-full"
                  />
                </div>
                
                <Button
                  onClick={handleSubmit}
                  disabled={isLoading || !selectedDate}
                  className="bg-blue-600 hover:bg-blue-700 w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  休日を追加
                </Button>
              </div>

              {/* 右側：休日一覧（2/3幅） */}
              <div className="md:col-span-2 space-y-2">
                <div className="flex justify-end items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="year">年</Label>
                    <Input
                      id="year"
                      type="number"
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                      className="w-24"
                    />
            </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="month">月</Label>
                    <select
                      id="month"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="w-24 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">全て</option>
                      {[...Array(12)].map((_, i) => (
                        <option key={i + 1} value={i + 1}>
                          {i + 1}月
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="border rounded-lg h-[calc(100%-40px)]">
                  <div className="grid grid-cols-4 gap-0 p-1.5 bg-gray-50 border-b text-sm font-medium">
                    <div className="col-span-1 px-2">日付</div>
                    <div className="col-span-2 px-2">備考</div>
                    <div className="col-span-1 px-2">操作</div>
                  </div>
                  <div className="divide-y divide-gray-100 overflow-y-auto max-h-[450px]">
                    {filteredHolidays.map((holiday) => (
                      <div key={holiday.id} className="grid grid-cols-4 gap-0 p-1.5 hover:bg-gray-50 text-sm">
                        <div className="col-span-1 px-2 flex items-center">
                          {format(new Date(holiday.date), 'yyyy/MM/dd(E)', { locale: ja })}
              </div>
                        <div className="col-span-2 px-2 flex items-center">{holiday.remarks}</div>
                        <div className="col-span-1 px-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(holiday.id)}
                            disabled={isLoading}
                            className="h-7 w-7"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>
    </>
  )
}