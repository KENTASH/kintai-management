"use client"

import { useState, useEffect } from "react"
import { createClient } from '@supabase/supabase-js'
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Users, Search, Save, Plus, Trash2, UserPlus, Mail, Ban, AlertCircle, CheckCircle2, Info } from "lucide-react"
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
import { useToast } from "@/components/ui/use-toast"
import { AnimatePresence, motion } from "framer-motion"

const departments = [
  "NISZ浜松", "NISZ名古屋", "NISZ大阪", "NAL東京",
  "GRS大阪", "GRS名古屋", "GRS東京", "NAL名古屋",
]

interface Member {
  id: string
  employee_id: string
  department: string
  last_name: string
  first_name: string
  last_name_en: string
  first_name_en: string
  email: string
  leader_id: string | null
  sub_leader_id: string | null
  is_leader: boolean
  is_admin: boolean
  registration_status: string
  is_active: boolean
  leader_name?: string
  sub_leader_name?: string
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

// Supabaseクライアントの初期化
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ステータスの定義
const STATUS_MAP = {
  '01': '仮登録',
  '02': '招待済み',
  '03': '認証済み',
  '99': '無効化'
} as const;

// 英語のステータス
const STATUS_MAP_EN = {
  '01': 'Temporary',
  '02': 'Invited',
  '03': 'Authenticated',
  '99': 'Disabled'
} as const;

export default function MembersPage() {
  const { t } = useI18n()
  const { toast } = useToast()
  const [searchCriteria, setSearchCriteria] = useState<SearchCriteria>({
    employeeId: "",
    name: "",
    department: "all",
  })
  
  const [members, setMembers] = useState<Member[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{
    type: 'success' | 'error' | 'info'
    text: string
  } | null>(null)

  const emptyMember: Member = {
    id: "",
    employee_id: "",
    department: "",
    last_name: "",
    first_name: "",
    last_name_en: "",
    first_name_en: "",
    email: "",
    leader_id: null,
    sub_leader_id: null,
    is_leader: false,
    is_admin: false,
    registration_status: "01",
    is_active: true,
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

  // メッセージの自動消去
  useEffect(() => {
    if (message && (message.type === 'success' || message.type === 'info')) {
      const timer = setTimeout(() => {
        setMessage(null)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [message])

  // fetchMembers関数を検索処理として定義
  const fetchMembers = async (criteria?: SearchCriteria) => {
    setIsLoading(true)
    try {
      let query = supabase
        .from('users')
        .select(`
          *,
          user_roles!left (
            role_type_id
          ),
          user_supervisors!left (
            supervisor_id,
            supervisor_type_id,
            supervisor:users!inner (
              last_name,
              first_name
            )
          )
        `)
        .eq('is_active', true)

      // 検索条件の適用
      if (criteria) {
        if (criteria.department && criteria.department !== 'all') {
          query = query.eq('department', criteria.department)
        }

        if (criteria.employeeId) {
          query = query.ilike('employee_id', `%${criteria.employeeId}%`)
        }

        if (criteria.name) {
          query = query.or(
            `last_name.ilike.%${criteria.name}%,` +
            `first_name.ilike.%${criteria.name}%,` +
            `last_name_en.ilike.%${criteria.name}%,` +
            `first_name_en.ilike.%${criteria.name}%`
          )
        }
      }

      query = query.order('employee_id')

      const { data, error } = await query

      if (error) throw error

      // データの整形
      const formattedData = data?.map(member => {
        const leaderInfo = member.user_supervisors?.find(s => s.supervisor_type_id === 1)
        const subLeaderInfo = member.user_supervisors?.find(s => s.supervisor_type_id === 2)

        return {
          ...member,
          leader_name: leaderInfo?.supervisor 
            ? `${leaderInfo.supervisor.last_name} ${leaderInfo.supervisor.first_name}`
            : '',
          sub_leader_name: subLeaderInfo?.supervisor
            ? `${subLeaderInfo.supervisor.last_name} ${subLeaderInfo.supervisor.first_name}`
            : '',
          is_leader: member.user_roles?.some(r => r.role_type_id === 1) || false,
          is_admin: member.user_roles?.some(r => r.role_type_id === 2) || false
        }
      }) || []

      setMembers(formattedData)

      // 検索結果に応じたメッセージを設定
      if (criteria) {  // 検索ボタンからの呼び出し時のみメッセージを表示
        if (!formattedData || formattedData.length === 0) {
          setMessage({
            type: 'info',
            text: '検索条件に該当するデータはありません。'
          })
        } else {
          setMessage({
            type: 'success',
            text: '検索処理が完了しました。'
          })
        }
      }

    } catch (error) {
      console.error('Error fetching members:', error)
      setMessage({
        type: 'error',
        text: '異常が発生しました。システム管理者に問い合わせてください。'
      })
    } finally {
      setIsLoading(false)
    }
  }

  // 新規メンバーの追加
  const handleAddMember = async (member: Omit<Member, 'id'>) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .insert([{
          ...member,
          registration_status: '01',
          is_active: true
        }])
        .select()

      if (error) throw error
      
      toast({
        title: "成功",
        description: "メンバーを追加しました",
      })
      
      fetchMembers()
    } catch (error) {
      console.error('Error adding member:', error)
      toast({
        title: "エラー",
        description: "メンバーの追加に失敗しました",
        variant: "destructive",
      })
    }
  }

  // メンバーの招待
  const handleInviteMember = async (member: Member) => {
    try {
      // Supabaseの管理者招待APIを呼び出し
      const { data, error } = await supabase.auth.admin.inviteUserByEmail(member.email)
      if (error) throw error

      // 登録ステータスを更新
      const { error: updateError } = await supabase
        .from('users')
        .update({ registration_status: '02' })
        .eq('id', member.id)

      if (updateError) throw updateError

      toast({
        title: "成功",
        description: "招待メールを送信しました",
      })

      fetchMembers()
    } catch (error) {
      console.error('Error inviting member:', error)
      toast({
        title: "エラー",
        description: "招待メールの送信に失敗しました",
        variant: "destructive",
      })
    }
  }

  // メンバーの無効化
  const handleDeactivateMember = async (member: Member) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({
          registration_status: '99',
          is_active: false
        })
        .eq('id', member.id)

      if (error) throw error

      toast({
        title: "成功",
        description: "メンバーを無効化しました",
      })

      fetchMembers()
    } catch (error) {
      console.error('Error deactivating member:', error)
      toast({
        title: "エラー",
        description: "メンバーの無効化に失敗しました",
        variant: "destructive",
      })
    }
  }

  useEffect(() => {
    // 初期表示時の処理が必要な場合はここに記述
  }, [])

  // 検索ボタンのクリックハンドラー
  const handleSearch = () => {
    fetchMembers(searchCriteria)
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
      const fullName = `${selectedMember.last_name} ${selectedMember.first_name}`
      
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
    if (isExisting && field === 'employee_id') {
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
    
    if (field === 'is_leader' || field === 'is_admin') {
      return (
        <div className="flex justify-center">
          <Checkbox
            checked={member[field] as boolean}
            onCheckedChange={(checked) => handleInputChange(member.id, field, !!checked)}
          />
        </div>
      )
    }

    if (field === 'leader_id' || field === 'sub_leader_id') {
      return (
        <div className="flex items-center gap-2">
          <Input
            value={member[field] as string}
            readOnly
            className="h-9 flex-1"
            placeholder={`${field === 'leader_id' ? '担当リーダー' : '担当サブリーダー'}を選択...`}
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => openLeaderDialog(member.id, field === 'leader_id' ? 'leader' : 'subLeader')}
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
    const matchesEmployeeId = member.employee_id.toLowerCase().includes(leaderSearchCriteria.employeeId.toLowerCase())
    const matchesName = `${member.last_name}${member.first_name}`.toLowerCase().includes(leaderSearchCriteria.name.toLowerCase())
    const matchesDepartment = leaderSearchCriteria.department === "all" || member.department === leaderSearchCriteria.department
    return matchesEmployeeId && matchesName && matchesDepartment
  })

  // 無効化の確認ダイアログ
  const handleDisable = async (member: Member) => {
    const confirmed = window.confirm("対象のユーザーを無効化します。よろしいですか？")
    if (confirmed) {
      try {
        const { error } = await supabase
          .from('users')
          .update({ is_active: false, registration_status: '99' })
          .eq('id', member.id)

        if (error) throw error

        toast({
          title: "成功",
          description: "ユーザーを無効化しました",
        })
        fetchMembers()
      } catch (error) {
        console.error('Error disabling user:', error)
        toast({
          title: "エラー",
          description: "ユーザーの無効化に失敗しました",
          variant: "destructive",
        })
      }
    }
  }

  // 招待の確認ダイアログ
  const handleInvite = async (member: Member) => {
    const confirmed = window.confirm(
      "未認証のユーザーへ認証案内メールを通知します。メールアドレスが間違っていないか確認の上、問題なければOKを押してください。"
    )
    if (confirmed) {
      await handleInviteMember(member)
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
              <span className="text-sm font-medium">{message.text}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  // 既存のコードの中で、テーブルヘッダー部分を修正
  const tableHeaders = [
    { id: 'employee_id', label: t('employee-id') },
    { id: 'department', label: t('department') },
    { id: 'name', label: t('name') },
    { id: 'name_en', label: t('name-en') },
    { id: 'email', label: t('email') },
    { id: 'leader', label: '担当リーダー' },
    { id: 'sub_leader', label: '担当サブリーダー' },
    { id: 'leader_auth', label: t('leader-permission') },
    { id: 'admin_auth', label: t('admin-permission') },
    { id: 'status', label: 'ステータス' },
    { id: 'actions', label: '操作' }
  ]

  // ステータス表示の変換関数を修正
  const getStatusText = (status: string): string => {
    const statusMap: { [key: string]: string } = {
      '01': '仮登録',
      '02': '招待済み',
      '03': '認証済み',
      '99': '無効化'
    }
    return statusMap[status] || status
  }

  // Disable ボタンの表示を修正
  const renderActionButtons = (member: Member) => {
    return (
      <div className="flex gap-2">
        {member.registration_status === '01' && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleInvite(member)}
          >
            <Mail className="mr-2 h-4 w-4" />
            招待
          </Button>
        )}
        <Button
          onClick={() => handleDisable(member)}
          size="sm"
          className="w-[100px] bg-red-600 hover:bg-red-700 text-white"
        >
          <Ban className="mr-2 h-4 w-4" />
          無効化
        </Button>
      </div>
    )
  }

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

      <MessageAlert />

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
                          <TableHead style={{ width: "120px" }}>{t("last-name")}</TableHead>
                          <TableHead style={{ width: "120px" }}>{t("first-name")}</TableHead>
                          <TableHead style={{ width: "120px" }}>{t("last-name-en")}</TableHead>
                          <TableHead style={{ width: "120px" }}>{t("first-name-en")}</TableHead>
                          <TableHead style={{ width: "300px" }}>{t("email")}</TableHead>
                          <TableHead style={{ width: "200px" }}>担当リーダー</TableHead>
                          <TableHead style={{ width: "200px" }}>担当サブリーダー</TableHead>
                          <TableHead style={{ width: "120px" }} className="text-center">{t("leader-permission")}</TableHead>
                          <TableHead style={{ width: "120px" }} className="text-center">{t("admin-permission")}</TableHead>
                          <TableHead style={{ width: "120px" }}>ステータス</TableHead>
                          <TableHead style={{ width: "120px" }}>操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {members.map((member) => (
                          <TableRow key={member.id}>
                            <TableCell className="p-2">{renderInputField(member, 'employee_id', true)}</TableCell>
                            <TableCell className="p-2">{renderInputField(member, 'department')}</TableCell>
                            <TableCell className="p-2">{renderInputField(member, 'last_name')}</TableCell>
                            <TableCell className="p-2">{renderInputField(member, 'first_name')}</TableCell>
                            <TableCell className="p-2">{renderInputField(member, 'last_name_en')}</TableCell>
                            <TableCell className="p-2">{renderInputField(member, 'first_name_en')}</TableCell>
                            <TableCell className="p-2">{renderInputField(member, 'email')}</TableCell>
                            <TableCell className="p-2">{renderInputField(member, 'leader_id')}</TableCell>
                            <TableCell className="p-2">{renderInputField(member, 'sub_leader_id')}</TableCell>
                            <TableCell className="p-2">{renderInputField(member, 'is_leader')}</TableCell>
                            <TableCell className="p-2">{renderInputField(member, 'is_admin')}</TableCell>
                            <TableCell className="p-2">{getStatusText(member.registration_status)}</TableCell>
                            <TableCell className="p-2">
                              {renderActionButtons(member)}
                            </TableCell>
                          </TableRow>
                        ))}

                        {editingMembers.map((member) => (
                          <TableRow key={member.id}>
                            <TableCell className="p-2">{renderInputField(member, 'employee_id')}</TableCell>
                            <TableCell className="p-2">{renderInputField(member, 'department')}</TableCell>
                            <TableCell className="p-2">{renderInputField(member, 'last_name')}</TableCell>
                            <TableCell className="p-2">{renderInputField(member, 'first_name')}</TableCell>
                            <TableCell className="p-2">{renderInputField(member, 'last_name_en')}</TableCell>
                            <TableCell className="p-2">{renderInputField(member, 'first_name_en')}</TableCell>
                            <TableCell className="p-2">{renderInputField(member, 'email')}</TableCell>
                            <TableCell className="p-2">{renderInputField(member, 'leader_id')}</TableCell>
                            <TableCell className="p-2">{renderInputField(member, 'sub_leader_id')}</TableCell>
                            <TableCell className="p-2">{renderInputField(member, 'is_leader')}</TableCell>
                            <TableCell className="p-2">{renderInputField(member, 'is_admin')}</TableCell>
                            <TableCell className="p-2">{member.registration_status}</TableCell>
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
              {currentEditingMember?.field === 'leader_id' ? t("select-leader") : t("select-sub-leader")}
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
                        <TableCell className="py-1">{member.employee_id}</TableCell>
                        <TableCell className="py-1">{member.last_name} {member.first_name}</TableCell>
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