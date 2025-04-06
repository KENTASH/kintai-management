'use client'

import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface MonthlyReportModalProps {
  isOpen: boolean
  onClose: () => void
  monthlyChartData: Array<{
    day: number
    date: string
    actualHours: number
  }>
  selectedMonth: Date
  totalHours: number
  overtimeHours: number
  onPreviousMonth: () => void
  onNextMonth: () => void
}

export function MonthlyReportModal({
  isOpen,
  onClose,
  monthlyChartData,
  selectedMonth,
  totalHours,
  overtimeHours,
  onPreviousMonth,
  onNextMonth
}: MonthlyReportModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[80vh] p-6 overflow-auto">
        <DialogHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-6 w-6 text-blue-600" />
              <DialogTitle className="text-2xl">月間レポート</DialogTitle>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                onClick={onPreviousMonth}
                className="h-8 w-8"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="font-medium text-lg">
                {format(selectedMonth, 'yyyy年M月')}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={onNextMonth}
                className="h-8 w-8"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="text-base text-blue-700 mb-2">勤務日数</div>
              <div className="text-2xl font-bold">{monthlyChartData.filter(day => day.actualHours > 0).length} 日</div>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="text-base text-green-700 mb-2">総勤務時間</div>
              <div className="text-2xl font-bold">{totalHours.toFixed(1)} 時間</div>
            </div>
            <div className="p-4 bg-red-50 rounded-lg">
              <div className="text-base text-red-700 mb-2">残業時間</div>
              <div className="text-2xl font-bold">{overtimeHours.toFixed(1)} 時間</div>
            </div>
          </div>
          
          {/* 勤務時間グラフ */}
          <div className="bg-gray-50 p-4 rounded-lg" style={{ height: '450px' }}>
            {monthlyChartData.some(day => day.actualHours > 0) ? (
              <div className="relative h-full">
                {/* 凡例 */}
                <div className="absolute right-0 top-0 flex items-center gap-4 text-sm z-10">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-blue-500"></div>
                    <span>通常勤務</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-500"></div>
                    <span>残業時間</span>
                  </div>
                </div>

                {/* Y軸ラベル */}
                <div className="absolute left-0 top-8 bottom-28 flex flex-col justify-between text-sm text-gray-500">
                  <div>12時間</div>
                  <div>10時間</div>
                  <div>8時間</div>
                  <div>6時間</div>
                  <div>4時間</div>
                  <div>2時間</div>
                  <div>0時間</div>
                </div>

                {/* グラフエリア */}
                <div className="absolute left-16 right-4 top-8 bottom-28 border-l border-b border-gray-300">
                  {/* Y軸の目盛り線 */}
                  {Array.from({ length: 6 }, (_, i) => (
                    <div
                      key={i}
                      className="absolute left-0 right-0 h-px bg-gray-200"
                      style={{
                        bottom: `${((i + 1) * 2 / 12) * 100}%`,
                      }}
                    />
                  ))}

                  {/* グラフ本体 */}
                  <div className="absolute inset-0 flex items-end justify-between px-2">
                    {monthlyChartData.map((day, index) => (
                      <div 
                        key={index} 
                        className="relative flex-1 flex flex-col items-center justify-end h-full"
                        style={{ minWidth: '8px', maxWidth: '24px' }}
                      >
                        {/* 勤務時間バー */}
                        {day.actualHours > 0 && (
                          <div 
                            className="w-[70%] flex flex-col justify-end relative"
                            style={{ 
                              height: `${Math.min((day.actualHours / 12) * 100, 100)}%`,
                            }}
                            title={`${day.day}日: ${day.actualHours}時間`}
                          >
                            {/* 基本の青色バー（8時間まで） */}
                            <div
                              className="w-full bg-blue-500 absolute bottom-0"
                              style={{
                                height: `${Math.min((Math.min(day.actualHours, 8) / day.actualHours) * 100, 100)}%`,
                                borderRadius: day.actualHours <= 8 ? '4px 4px 0 0' : '0'
                              }}
                            />
                            {/* 超過分の赤色バー（8時間超過分） */}
                            {day.actualHours > 8 && (
                              <div
                                className="w-full bg-red-500 absolute top-0 rounded-t"
                                style={{
                                  height: `${((day.actualHours - 8) / day.actualHours) * 100}%`
                                }}
                              />
                            )}
                          </div>
                        )}

                        {/* X軸ラベル */}
                        <div className="absolute text-xs text-gray-500 top-full mt-2 flex flex-col items-center">
                          <span>{day.day}</span>
                          <span>{format(new Date(day.date), 'E', { locale: ja })}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-lg text-gray-500">データが存在しません</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
} 