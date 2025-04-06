'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

interface CheckInModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (time: string) => void
}

export function CheckInModal({ isOpen, onClose, onConfirm }: CheckInModalProps) {
  const [currentTime, setCurrentTime] = useState<string>('')

  useEffect(() => {
    if (isOpen) {
      const now = new Date()
      setCurrentTime(format(now, 'HH:mm', { locale: ja }))
    }
  }, [isOpen])

  const handleConfirm = () => {
    onConfirm(currentTime)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px] p-0">
        <div className="relative">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="p-6">
            <DialogHeader>
              <DialogTitle>出勤確認</DialogTitle>
              <DialogDescription>
                以下の時間で出勤を記録します。よろしいですか？
              </DialogDescription>
            </DialogHeader>
            <div className="bg-blue-50 py-4 my-6 text-center">
              <span className="text-2xl font-bold text-blue-700">
                {currentTime}
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1 bg-white text-gray-700 hover:bg-gray-100 border border-gray-300"
              >
                キャンセル
              </Button>
              <Button
                onClick={handleConfirm}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                記録する
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
} 