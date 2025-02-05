"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Users, Search, Save, Plus, Trash2, UserPlus } from "lucide-react"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const departments = [
  "NISZ浜松", "NISZ名古屋", "NISZ大阪", "NIS東京",
  "GRS大阪", "GRS名古屋", "GRS東京", "NAL名古屋",
]

interface Member {
  id: string
  employeeId: string
  department: string
  lastNameJa: string
  firstNameJa: string
  lastNameEn: string
  firstNameEn: string
  email: string
  leader: string
  subLeader: string
  isLeader: boolean
  isAdmin: boolean
}

interface SearchCriteria {
  employeeId: string
  name: string
  department: string
}

interface LeaderSearchCriteria {
  employeeId: string
  name: string
  department: string
}

interface CurrentEditingMember {
  memberId: string
  field: 'leader' | 'subLeader'
}

export default function MembersPage() {
  const { t } = useI18n()
  const [searchCriteria, setSearchCriteria] = useState<SearchCriteria>({
    employeeId: "",
    name: "",
    department: "all",
  })
  
  const [members, setMembers] = useState<Member[]>([
    {
      id: "1",
      employeeId: "1001",
      department: "NISZ浜松",
      lastNameJa: "管理者",
      firstNameJa: "テスト",
      lastNameEn: "Kanrisha",
      firstNameEn: "Test",
      email: "test@example.com",
      leader: "",
      subLeader: "",
      isLeader: true,
      isAdmin: true,
    },
  ])

  const emptyMember: Member = {
    id: "",
    employeeId: "",
    department: "",
    lastNameJa: "",
    firstNameJa: "",
    lastNameEn: "",
    firstNameEn: "",
    email: "",
    leader: "",
    subLeader: "",
    isLeader: false,
    isAdmin: false,
  }

  const [editingMembers, setEditingMembers] = useState<Member[]>([])
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [memberToDelete, setMemberToDelete] = useState<Member | null>(null)
  const [leaderDialogOpen, setLeaderDialogOpen] = useState(false)
  const [leaderSearchCriteria, setLeaderSearchCriteria] = useState<LeaderSearchCriteria>({
    employeeId: "",
    name: "",
    department: "all",
  })
  const [currentEditingMember, setCurrentEditingMember] = useState<CurrentEditingMember | null>(null)

  const handleSearch = () => {
    console.log("Search with:", searchCriteria)
  }

  const handleAddRow = () => {
    setEditingMembers([...editingMembers, { ...emptyMember, id: Date.now().toString() }])
  }

  const handleRemoveRow = (id: string) => {
    setEditingMembers(editingMembers.filter(member => member.id !== id))
  }

  const handleDeleteMember = (member: Member) => {
    setMemberToDelete(member)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    if (memberToDelete) {
      setMembers(members.filter(member => member.id !== memberToDelete.id))
      setDeleteDialogOpen(false)
      setMemberToDelete(null)
    }
  }

  const handleInputChange = (id: string, field: keyof Member, value: string | boolean) => {
    setMembers(members.map(member => {
      if (member.id === id) {
        return { ...member, [field]: value }
      }
      return member
    }))
    setEditingMembers(editingMembers.map(member => {
      if (member.id === id) {
        return { ...member, [field]: value }
      }
      return member
    }))
  }

  const handleSave = () => {
    console.log("Saving members:", [...members, ...editingMembers])
    setMembers([...members, ...editingMembers])
    setEditingMembers([])
  }

  const handleLeaderSelect = (selectedMember: Member) => {
    if (currentEditingMember) {
      const { memberId, field } = currentEditingMember
      const fullName = `${selectedMember.lastNameJa} ${selectedMember.firstNameJa}`
      
      setMembers(members.map(member => {
        if (member.id === memberId) {
          return { ...member, [field]: fullName }
        }
        return member
      }))
      
      setEditingMembers(editingMembers.map(member => {
        if (member.id === memberId) {
          return { ...member, [field]: fullName }
        }
        return member
      }))
    }
    
    setLeaderDialogOpen(false)
    setLeaderSearchCriteria({ employeeId: "", name: "", department: "all" })
    setCurrentEditingMember(null)
  }

  const openLeaderDialog = (memberId: string, field: 'leader' | 'subLeader') => {
    setCurrentEditingMember({ memberId, field })
    setLeaderDialogOpen(true)
  }

  const renderInputField = (member: Member, field: keyof Member, isExisting: boolean = false) => {
    if (isExisting && field === 'employeeId') {
      return <div className="px-2 py-1">{member[field]}</div>
    }

    if (field === 'department') {
      return (
        <Select
          value={member[field]}
          onValueChange={(value) => handleInputChange(member.id, field, value)}
        >
          <SelectTrigger className="h-9 w-full">
            <SelectValue placeholder="選択" />
          </SelectTrigger>
          <SelectContent>
            {departments.map((dept) => (
              <SelectItem key={dept} value={dept}>{dept}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    }
    
    if (field === 'isLeader' || field === 'isAdmin') {
      return (
        <div className="flex justify-center">
          <Checkbox
            checked={member[field] as boolean}
            onCheckedChange={(checked) => handleInputChange(member.id, field, !!checked)}
          />
        </div>
      )
    }

    if (field === 'leader' || field === 'subLeader') {
      return (
        <div className="flex items-center gap-2">
          <Input
            value={member[field] as string}
            readOnly
            className="h-9 flex-1"
            placeholder={`${field === 'leader' ? '担当リーダー' : '担当サブリーダー'}を選択...`}
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => openLeaderDialog(member.id, field)}
            className="h-9 w-9 hover:bg-blue-50"
          >
            <UserPlus className="h-4 w-4 text-blue-600" />
          </Button>
        </div>
      )
    }

    return (
      <Input
        value={member[field] as string}
        onChange={(e) => handleInputChange(member.id, field, e.target.value)}
        className="h-9 w-full"
        type={field === 'email' ? 'email' : 'text'}
      />
    )
  }

  const filteredMembers = members.filter(member => {
    const matchesEmployeeId = member.employeeId.toLowerCase().includes(leaderSearchCriteria.employeeId.toLowerCase())
    const matchesName = `${member.lastNameJa}${member.firstNameJa}`.toLowerCase().includes(leaderSearchCriteria.name.toLowerCase())
    const matchesDepartment = leaderSearchCriteria.department === "all" || member.department === leaderSearchCriteria.department
    return matchesEmployeeId && matchesName && matchesDepartment
  })

  return (
    <div className="space-y-6 relative z-[1]">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Users className="h-8 w-8 text-blue-600" />
          {t("members-list")}
        </h1>
        <p className="text-muted-foreground">
          {t("member-management-description")}
        </p>
      </div>

      <Card className="relative z-[1]">
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex items-end gap-4 pb-4 border-b">
              <div>
                <label className="text-sm font-medium mb-2 block">{t("department")}</label>
                <Select
                  value={searchCriteria.department}
                  onValueChange={(value) => setSearchCriteria({ ...searchCriteria, department: value })}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder={t("select-department")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("select-all")}</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">{t("employee-id")}</label>
                <Input
                  value={searchCriteria.employeeId}
                  onChange={(e) => setSearchCriteria({ ...searchCriteria, employeeId: e.target.value })}
                  className="w-32"
                  placeholder={t("enter-employee-id")}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">{t("name")}</label>
                <Input
                  value={searchCriteria.name}
                  onChange={(e) => setSearchCriteria({ ...searchCriteria, name: e.target.value })}
                  className="w-48"
                  placeholder={t("enter-name")}
                />
              </div>
              <Button onClick={handleSearch} className="bg-blue-600 hover:bg-blue-700">
                <Search className="h-4 w-4 mr-2" />
                {t("search")}
              </Button>
            </div>

            <div>
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-4">
                  <h3 className="text-lg font-medium">{t("member-list")}</h3>
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

              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                  <div style={{ minWidth: "2000px" }} className="relative z-[1]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead style={{ width: "120px" }}>{t("employee-id")}</TableHead>
                          <TableHead style={{ width: "160px" }}>{t("department")}</TableHead>
                          <TableHead style={{ width: "120px" }}>{t("last-name-ja")}</TableHead>
                          <TableHead style={{ width: "120px" }}>{t("first-name-ja")}</TableHead>
                          <TableHead style={{ width: "120px" }}>{t("last-name-en")}</TableHead>
                          <TableHead style={{ width: "120px" }}>{t("first-name-en")}</TableHead>
                          <TableHead style={{ width: "300px" }}>{t("email")}</TableHead>
                          <TableHead style={{ width: "200px" }}>{t("leader")}</TableHead>
                          <TableHead style={{ width: "200px" }}>{t("sub-leader")}</TableHead>
                          <TableHead style={{ width: "120px" }} className="text-center">{t("leader-permission")}</TableHead>
                          <TableHead style={{ width: "120px" }} className="text-center">{t("admin-permission")}</TableHead>
                          <TableHead style={{ width: "80px" }}></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {members.map((member) => (
                          <TableRow key={member.id}>
                            <TableCell className="p-2">{renderInputField(member, 'employeeId', true)}</TableCell>
                            <TableCell className="p-2">{renderInputField(member, 'department')}</TableCell>
                            <TableCell className="p-2">{renderInputField(member, 'lastNameJa')}</TableCell>
                            <TableCell className="p-2">{renderInputField(member, 'firstNameJa')}</TableCell>
                            <TableCell className="p-2">{renderInputField(member, 'lastNameEn')}</TableCell>
                            <TableCell className="p-2">{renderInputField(member, 'firstNameEn')}</TableCell>
                            <TableCell className="p-2">{renderInputField(member, 'email')}</TableCell>
                            <TableCell className="p-2">{renderInputField(member, 'leader')}</TableCell>
                            <TableCell className="p-2">{renderInputField(member, 'subLeader')}</TableCell>
                            <TableCell className="p-2">{renderInputField(member, 'isLeader')}</TableCell>
                            <TableCell className="p-2">{renderInputField(member, 'isAdmin')}</TableCell>
                            <TableCell className="p-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteMember(member)}
                                className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}

                        {editingMembers.map((member) => (
                          <TableRow key={member.id}>
                            <TableCell className="p-2">{renderInputField(member, 'employeeId')}</TableCell>
                            <TableCell className="p-2">{renderInputField(member, 'department')}</TableCell>
                            <TableCell className="p-2">{renderInputField(member, 'lastNameJa')}</TableCell>
                            <TableCell className="p-2">{renderInputField(member, 'firstNameJa')}</TableCell>
                            <TableCell className="p-2">{renderInputField(member, 'lastNameEn')}</TableCell>
                            <TableCell className="p-2">{renderInputField(member, 'firstNameEn')}</TableCell>
                            <TableCell className="p-2">{renderInputField(member, 'email')}</TableCell>
                            <TableCell className="p-2">{renderInputField(member, 'leader')}</TableCell>
                            <TableCell className="p-2">{renderInputField(member, 'subLeader')}</TableCell>
                            <TableCell className="p-2">{renderInputField(member, 'isLeader')}</TableCell>
                            <TableCell className="p-2">{renderInputField(member, 'isAdmin')}</TableCell>
                            <TableCell className="p-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveRow(member.id)}
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
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("delete-member")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("confirm-delete-member")}
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

      <Dialog open={leaderDialogOpen} onOpenChange={setLeaderDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {currentEditingMember?.field === 'leader' ? t("select-leader") : t("select-sub-leader")}
            </DialogTitle>
            <DialogDescription>
              {t("select-member")}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">{t("department")}</label>
                <Select
                  value={leaderSearchCriteria.department}
                  onValueChange={(value) => setLeaderSearchCriteria({ ...leaderSearchCriteria, department: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("select-department")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("select-all")}</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">{t("employee-id")}</label>
                <Input
                  value={leaderSearchCriteria.employeeId}
                  onChange={(e) => setLeaderSearchCriteria({ ...leaderSearchCriteria, employeeId: e.target.value })}
                  placeholder={t("enter-employee-id")}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">{t("name")}</label>
                <Input
                  value={leaderSearchCriteria.name}
                  onChange={(e) => setLeaderSearchCriteria({ ...leaderSearchCriteria, name: e.target.value })}
                  placeholder={t("enter-name")}
                />
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">{t("employee-id")}</TableHead>
                    <TableHead className="w-48">{t("name")}</TableHead>
                    <TableHead className="w-40">{t("department")}</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMembers.length > 0 ? (
                    filteredMembers.map((member) => (
                      <TableRow key={member.id} className="hover:bg-blue-50">
                        <TableCell className="py-1">{member.employeeId}</TableCell>
                        <TableCell className="py-1">{member.lastNameJa} {member.firstNameJa}</TableCell>
                        <TableCell className="py-1">{member.department}</TableCell>
                        <TableCell className="py-1">
                          <Button
                            onClick={() => handleLeaderSelect(member)}
                            className="h-7 w-full bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            {t("select")}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-4 text-gray-500">
                        {t("no-members-found")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setLeaderDialogOpen(false)
              setLeaderSearchCriteria({ employeeId: "", name: "", department: "all" })
            }}>
              {t("cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}