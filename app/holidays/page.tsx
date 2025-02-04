"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CalendarCheck2, Search, Save, Plus, Trash2 } from "lucide-react"
import { useI18n } from "@/lib/i18n/context"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

// 年の選択肢を生成（現在年から前後2年）
const currentYear = new Date().getFullYear()
const years = Array.from({ length: 5 }, (_, i) => (currentYear - 2 + i).toString())

interface Holiday {
  id: string
  date: string
  remarks: string
}

export default function HolidaysPage() {
  const { t } = useI18n()
  const [selectedYear, setSelectedYear] = useState(currentYear.toString())
  const [holidays, setHolidays] = useState<Holiday[]>([
    {
      id: "1",
      date: "2024-01-02",
      remarks: "年始休暇",
    },
    {
      id: "2",
      date: "2024-01-03",
      remarks: "年始休暇",
    },
  ])
  const [editingHolidays, setEditingHolidays] = useState<Holiday[]>([])
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [holidayToDelete, setHolidayToDelete] = useState<Holiday | null>(null)

  const handleSearch = () => {
    console.log("Search for year:", selectedYear)
  }

  const handleAddRow = () => {
    setEditingHolidays([
      ...editingHolidays,
      { id: Date.now().toString(), date: "", remarks: "" }
    ])
  }

  const handleRemoveRow = (id: string) => {
    setEditingHolidays(editingHolidays.filter(holiday => holiday.id !== id))
  }

  const handleDeleteHoliday = (holiday: Holiday) => {
    setHolidayToDelete(holiday)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    if (holidayToDelete) {
      setHolidays(holidays.filter(holiday => holiday.id !== holidayToDelete.id))
      setDeleteDialogOpen(false)
      setHolidayToDelete(null)
    }
  }

  const handleInputChange = (id: string, field: keyof Holiday, value: string) => {
    setHolidays(holidays.map(holiday => {
      if (holiday.id === id) {
        return { ...holiday, [field]: value }
      }
      return holiday
    }))
    setEditingHolidays(editingHolidays.map(holiday => {
      if (holiday.id === id) {
        return { ...holiday, [field]: value }
      }
      return holiday
    }))
  }

  const handleSave = () => {
    console.log("Saving holidays:", [...holidays, ...editingHolidays])
    setHolidays([...holidays, ...editingHolidays])
    setEditingHolidays([])
  }

  const renderInputField = (holiday: Holiday, field: keyof Holiday) => {
    if (field === 'date') {
      return (
        <Input
          type="date"
          value={holiday[field]}
          onChange={(e) => handleInputChange(holiday.id, field, e.target.value)}
          className="h-9 w-full"
        />
      )
    }

    return (
      <Input
        value={holiday[field]}
        onChange={(e) => handleInputChange(holiday.id, field, e.target.value)}
        className="h-9 w-full"
        placeholder={t("enter-remarks")}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <CalendarCheck2 className="h-8 w-8 text-blue-600" />
          {t("holiday-settings")}
        </h1>
        <p className="text-muted-foreground">
          {t("holiday-settings-description")}
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex items-end gap-4 pb-4 border-b">
              <div>
                <label className="text-sm font-medium mb-2 block">{t("year")}</label>
                <Select
                  value={selectedYear}
                  onValueChange={setSelectedYear}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder={t("select-year")} />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((year) => (
                      <SelectItem key={year} value={year}>
                        {year}{t("year-suffix")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleSearch} className="bg-blue-600 hover:bg-blue-700">
                <Search className="h-4 w-4 mr-2" />
                {t("search")}
              </Button>
            </div>

            <div>
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-4">
                  <h3 className="text-lg font-medium">{t("holiday-list")}</h3>
                  <div className="space-x-2">
                    <Button onClick={handleAddRow} variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      {t("add-row")}
                    </Button>
                    <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
                      <Save className="h-4 w-4 mr-2" />
                      {t("save")}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead style={{ width: "200px" }}>{t("date")}</TableHead>
                      <TableHead>{t("remarks")}</TableHead>
                      <TableHead style={{ width: "80px" }}></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {holidays.map((holiday) => (
                      <TableRow key={holiday.id}>
                        <TableCell className="p-2">{renderInputField(holiday, 'date')}</TableCell>
                        <TableCell className="p-2">{renderInputField(holiday, 'remarks')}</TableCell>
                        <TableCell className="p-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteHoliday(holiday)}
                            className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}

                    {editingHolidays.map((holiday) => (
                      <TableRow key={holiday.id}>
                        <TableCell className="p-2">{renderInputField(holiday, 'date')}</TableCell>
                        <TableCell className="p-2">{renderInputField(holiday, 'remarks')}</TableCell>
                        <TableCell className="p-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveRow(holiday.id)}
                            className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("delete-holiday")}</AlertDialogTitle>
            <AlertDialogDescription>
              {holidayToDelete && (
                <>
                  {t("date")}: {holidayToDelete.date}<br />
                  {t("remarks")}: {holidayToDelete.remarks}<br />
                  {t("confirm-delete")}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}