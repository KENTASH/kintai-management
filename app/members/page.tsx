"use client"

import { useState, useEffect } from "react"
import { createClient, PostgrestError } from '@supabase/supabase-js'
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Users, Search, Save, Plus, Trash2, UserPlus, Mail, Ban, AlertCircle, CheckCircle2, Info, X } from "lucide-react"
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
import { createClient as newClient } from '@/lib/supabaseClient'
import { Database } from "@/types/supabase"

interface Member {
  id: string
  employee_id: string
  email: string
  last_name: string
  first_name: string
  last_name_en: string | null
  first_name_en: string | null
  branch: string
  branch_name: string
  is_active: boolean
  registration_status: string | null
  supervisor_info: {
    leader: string | null
    subleader: string | null
  }
  roles: {
    is_leader: boolean
    is_admin: boolean
  }
  [key: string]: any  // インデックスシグネチャを追加
}

interface Supervisor {
  supervisor_type_id: number
  supervisor: {
    last_name: string
    first_name: string
  }
}

interface Role {
  role_type_id: number
}

interface SearchCriteria {
  employeeId: string
  name: string
  branch: string  // departmentをbranchに変更
}

interface LeaderSearchCriteria {
  employeeId: string
  name: string
  department: string
}

interface CurrentEditingMember {
  memberId: string
  field: 'leader' | 'subleader'
}

// BranchMaster型の定義を修正
interface BranchMaster {
  code: string
  name_jp: string
  name_en: string
  created_at: string | null
  updated_at: string | null
  created_by: string | null
  updated_by: string | null
}

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

// バリデーション用の型定義
interface ValidationError {
  field: string
  message: string
}

// メッセージの型を拡張
interface Message {
  type: 'success' | 'error' | 'info'
  text: string
  persistent?: boolean  // フェードアウトしないフラグ
  position?: 'top' | 'bottom'  // 表示位置
  alignment?: 'left' | 'center'  // 文字寄せ
  dismissible?: boolean  // 手動で消せるフラグ
}

// ステータスマップの型を修正
type StatusMapType = {
  [key: string]: {
    ja: string;
    en: string;
  }
}

const statusMap: StatusMapType = {
  '00': { ja: '未登録', en: 'Unregistered' },
  '01': { ja: '仮登録済み', en: 'Temporary Registered' },
  '02': { ja: '招待済み', en: 'Invited' },
  '03': { ja: '認証済み', en: 'Authenticated' },
  '99': { ja: '廃止済み', en: 'Deactivated' }
}

// UserDataの型定義を追加
interface UserData {
  id: string
  employee_id: string
  email: string
  last_name: string
  first_name: string
  last_name_en: string | null
  first_name_en: string | null
  branch: string
  is_active: boolean
  registration_status: string | null
  branch_master: Array<{
    name_jp: string
    name_en: string
  }>
}

export default function MembersPage() {
  const { t, language } = useI18n()
  const { toast } = useToast()
  const [searchCriteria, setSearchCriteria] = useState<SearchCriteria>({
    employeeId: "",
    name: "",
    branch: "all"  // departmentをbranchに変更
  })
  
  const [members, setMembers] = useState<Member[]>([])
  const [originalMembers, setOriginalMembers] = useState<Member[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<Message | null>(null)
  const [branches, setBranches] = useState<BranchMaster[]>([])
  const [hasSearched, setHasSearched] = useState(false)  // 検索実行フラグを追加

  const emptyMember: Member = {
    id: "",
    employee_id: "",
    branch: "",
    branch_name: "",
    last_name: "",
    first_name: "",
    last_name_en: null,
    first_name_en: null,
    email: "",
    registration_status: "01",
    is_active: true,
    supervisor_info: {
      leader: null,
      subleader: null
    },
    roles: {
      is_leader: false,
      is_admin: false
    }
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

  // 所属マスタの取得
  useEffect(() => {
    const initializeBranches = async () => {
      const supabase = newClient()
      try {
        const { data: branchData } = await supabase
          .from('branch_master')
          .select('*') as { data: BranchMaster[] }

        const formattedBranches: BranchMaster[] = [
          {
            code: 'all',
            name_jp: '全て',
            name_en: 'All',
            created_at: null,
            updated_at: null,
            created_by: null,
            updated_by: null
          },
          ...branchData
        ]

        setBranches(formattedBranches)
      } catch (error) {
        console.error('Error fetching branches:', error)
        toast({
          title: "エラー",
          description: "所属情報の取得に失敗しました",
          variant: "destructive",
        })
      }
    }

    initializeBranches()
  }, [])

  // 初期化処理の実装
  const initializeMembers = async () => {
    setIsLoading(true)
    try {
      // ブランチ情報のみを取得
      const { data: branchData, error: branchError } = await newClient()
        .from('branch_master')
        .select('*')
        .order('code')

      if (branchError) throw branchError
      setBranches(branchData)

    } catch (error) {
      console.error('Error initializing:', error)
      toast({
        title: "エラー",
        description: "初期化に失敗しました",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // 検索処理の実装
  const handleSearch = async () => {
    setIsLoading(true)
    const supabase = newClient()

    try {
      let query = supabase
        .from('users')
        .select(`
          id,
          employee_id,
          email,
          last_name,
          first_name,
          last_name_en,
          first_name_en,
          branch,
          is_active,
          registration_status,
          branch_master!inner (
            name_jp,
            name_en
          )
        `)
        .eq('is_active', true)

      if (searchCriteria.branch && searchCriteria.branch !== 'all') {
        query.eq('branch', searchCriteria.branch)
      }
      if (searchCriteria.employeeId) {
        query.ilike('employee_id', `%${searchCriteria.employeeId}%`)
      }
      if (searchCriteria.name) {
        query.or(`last_name.ilike.%${searchCriteria.name}%,first_name.ilike.%${searchCriteria.name}%`)
      }

      const { data: users, error: usersError } = await query

      if (usersError) throw usersError

      const formattedUsers = users?.map(user => ({
        ...user,
        branch_name: user.branch_master?.[0]?.name_jp || '',
        supervisor_info: {
          leader: null,
          subleader: null
        },
        roles: {
          is_leader: false,
          is_admin: false
        }
      })) as Member[]

      setMembers(formattedUsers || [])
      setOriginalMembers(formattedUsers || [])
      setHasSearched(true)

      // メッセージ表示の処理を修正
      if (formattedUsers.length === 0) {
        setMessage({
          type: 'info',
          text: '該当するメンバーが見つかりませんでした'
        })
      } else {
        setMessage({
          type: 'success',
          text: `${formattedUsers.length}件のメンバーが見つかりました`
        })
      }

    } catch (error) {
      console.error('Error searching members:', error)
      setMessage({
        type: 'error',
        text: 'メンバー情報の検索に失敗しました'
      })
    } finally {
      setIsLoading(false)
    }
  }

  // クリアボタンのハンドラを修正 - シンプルに検索条件のリセットのみを行う
  const handleClearSearch = () => {
    setSearchCriteria({
      employeeId: '',
      name: '',
      branch: 'all'
    })
  }

  // ステータスラベルの取得
  const getStatusLabel = (status: string | null, lang: string): string => {
    if (!status) return ''
    return statusMap[status]?.[lang as keyof typeof statusMap[string]] || status
  }

  // 新規メンバーの追加
  const handleAddMember = async (member: Omit<Member, 'id'>) => {
    try {
      const { data, error } = await newClient()
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
      const { data, error } = await newClient().auth.admin.inviteUserByEmail(member.email)
      if (error) throw error

      // 登録ステータスを更新
      const { error: updateError } = await newClient()
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
      const { error } = await newClient()
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

  // supabaseクライアントの初期化
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // handleSave関数の完全な書き直し
  const handleSave = async () => {
    setIsLoading(true)
    
    try {
      // バリデーション処理
      const validationErrors = editingMembers.map(member => {
        const errors: string[] = [];
        
        // システム必須項目のチェック
        if (!member.employee_id) {
          errors.push('社員番号は必須です');
        }
        
        // 業務必須項目のチェック
        const requiredFields = [
          { field: 'branch', label: '部署' },
          { field: 'last_name', label: '姓' },
          { field: 'first_name', label: '名' },
          { field: 'last_name_en', label: '姓(英語)' },
          { field: 'first_name_en', label: '名(英語)' },
          { field: 'email', label: 'メールアドレス' }
        ];

        requiredFields.forEach(({ field, label }) => {
          if (!member[field as keyof typeof member]) {
            errors.push(`${label}は必須です`);
          }
        });

        return { member, errors };
      });

      const hasErrors = validationErrors.some(v => v.errors.length > 0);
      if (hasErrors) {
        const errorMessages = validationErrors
          .filter(v => v.errors.length > 0)
          .map(v => `${v.member.employee_id || '新規'}: ${v.errors.join(', ')}`)
          .join('\n');
        
        toast({
          title: "入力内容に不備があります",
          description: errorMessages,
          variant: "destructive",
        });
        return;
      }

      // 既存メンバーと新規メンバーの分離
      const existingMembers = editingMembers.filter(member => member.id);
      const newMembers = editingMembers.filter(member => !member.id);

      // 1. 既存メンバーの更新処理
      for (const member of existingMembers) {
        // ユーザー基本情報の更新
        const { error: updateError } = await supabase
          .from('users')
          .update({
            branch: member.branch,
            last_name: member.last_name,
            first_name: member.first_name,
            last_name_en: member.last_name_en,
            first_name_en: member.first_name_en,
            email: member.email
          })
          .eq('id', member.id)

        if (updateError) throw updateError;

        // リーダー情報の更新または削除
        if (member.supervisor_info?.leader !== undefined) {
          const { error: leaderError } = await supabase
            .from('user_supervisors')
            .upsert({
              user_id: member.id,
              pic_user_id: member.supervisor_info.leader,
              supervisor_type: '01'
            }, {
              onConflict: 'user_id,supervisor_type'
            })
          if (leaderError) throw leaderError;
        }

        // サブリーダー情報の更新または削除
        if (member.supervisor_info?.subleader !== undefined) {
          const { error: subleaderError } = await supabase
            .from('user_supervisors')
            .upsert({
              user_id: member.id,
              pic_user_id: member.supervisor_info.subleader,
              supervisor_type: '02'
            }, {
              onConflict: 'user_id,supervisor_type'
            })
          if (subleaderError) throw subleaderError;
        }

        // ロール情報の更新
        if (member.supervisor_info?.leader_role !== undefined) {
          if (member.supervisor_info.leader_role) {
            const { error: roleError } = await supabase
              .from('user_roles')
              .upsert({
                user_id: member.id,
                user_role_id: 'leader'
              })
            if (roleError) throw roleError;
          } else {
            const { error: deleteError } = await supabase
              .from('user_roles')
              .delete()
              .match({ user_id: member.id, user_role_id: 'leader' })
            if (deleteError) throw deleteError;
          }
        }

        // 管理者ロールの更新
        if (member.supervisor_info?.admin_role !== undefined) {
          if (member.supervisor_info.admin_role) {
            const { error: roleError } = await supabase
              .from('user_roles')
              .upsert({
                user_id: member.id,
                user_role_id: 'admin'
              })
            if (roleError) throw roleError;
          } else {
            const { error: deleteError } = await supabase
              .from('user_roles')
              .delete()
              .match({ user_id: member.id, user_role_id: 'admin' })
            if (deleteError) throw deleteError;
          }
        }
      }

      // 2. 新規メンバーの登録処理
      for (const member of newMembers) {
        // auth.usersへの登録
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
          email: member.email,
          email_confirm: true
        })

        if (authError) throw authError;

        // public.usersへの登録
        const { data: newUser, error: insertError } = await supabase
          .from('users')
          .insert({
            auth_id: authUser.user.id,
            employee_id: member.employee_id,
            branch: member.branch,
            last_name: member.last_name,
            first_name: member.first_name,
            last_name_en: member.last_name_en,
            first_name_en: member.first_name_en,
            email: member.email,
            registration_status: '01'
          })
          .select('id')
          .single()

        if (insertError || !newUser) throw insertError;

        // 関連情報の登録
        if (member.supervisor_info?.leader) {
          const { error: leaderError } = await supabase
            .from('user_supervisors')
            .insert({
              user_id: newUser.id,
              pic_user_id: member.supervisor_info.leader,
              supervisor_type: '01'
            })
          if (leaderError) throw leaderError;
        }

        if (member.supervisor_info?.subleader) {
          const { error: subleaderError } = await supabase
            .from('user_supervisors')
            .insert({
              user_id: newUser.id,
              pic_user_id: member.supervisor_info.subleader,
              supervisor_type: '02'
            })
          if (subleaderError) throw subleaderError;
        }

        if (member.supervisor_info?.leader_role) {
          const { error: roleError } = await supabase
            .from('user_roles')
            .insert({
              user_id: newUser.id,
              user_role_id: 'leader'
            })
          if (roleError) throw roleError;
        }

        if (member.supervisor_info?.admin_role) {
          const { error: roleError } = await supabase
            .from('user_roles')
            .insert({
              user_id: newUser.id,
              user_role_id: 'admin'
            })
          if (roleError) throw roleError;
        }
      }

      toast({
        title: "成功",
        description: "保存が完了しました。",
      });

      // データを再取得して状態をリセット
      await fetchMembers();
      setEditingMembers([]);

    } catch (error) {
      console.error('Error saving members:', error);
      toast({
        title: "エラー",
        description: "想定外のエラーが発生しました。",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // バリデーション関数
  const validateMembers = (members: Member[]): ValidationError[] => {
    const errors: ValidationError[] = []

    members.forEach(member => {
      if (!member.employee_id) {
        errors.push({ field: 'employee_id', message: '社員番号は必須です。' })
      }
      if (!member.branch) {
        errors.push({ field: 'branch', message: '部署は必須です。' })
      }
      if (!member.last_name || !member.first_name) {
        errors.push({ field: 'name', message: '氏名は必須です。' })
      }
      if (!member.last_name_en || !member.first_name_en) {
        errors.push({ field: 'name_en', message: '氏名（英語）は必須です。' })
      }
      if (!member.email) {
        errors.push({ field: 'email', message: 'メールアドレスは必須です。' })
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(member.email)) {
        errors.push({ field: 'email', message: 'メールアドレスの形式が正しくありません。' })
      }
    })

    return errors
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

  const openLeaderDialog = (memberId: string, field: 'leader' | 'subleader') => {
    setCurrentEditingMember({ memberId, field })
    setLeaderDialogOpen(true)
  }

  const renderInputField = (member: Member, field: keyof Member, isExisting: boolean = false) => {
    if (isExisting && field === 'employee_id') {
      return <div className="px-2 py-1">{member[field] || ''}</div>
    }

    if (field === 'branch') {
      return (
        <Select
          value={member[field] || ''}
          onValueChange={(value) => handleInputChange(member.id, field, value)}
        >
          <SelectTrigger className="h-9 w-full">
            <SelectValue placeholder={t("select-branch")} />
          </SelectTrigger>
          <SelectContent>
            {branches.map((branch) => (
              <SelectItem key={branch.code} value={branch.code}>
                {language === 'ja' ? branch.name_jp : branch.name_en}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    }
    
    if (field === 'is_leader' || field === 'is_admin') {
      return (
        <div className="flex justify-center">
          <Checkbox
            checked={!!member[field]}
            onCheckedChange={(checked) => handleInputChange(member.id, field, !!checked)}
          />
        </div>
      )
    }

    if (field === 'leader' || field === 'subleader') {
      return (
        <div className="flex items-center gap-2">
          <Input
            value={member[field] || ''}
            readOnly
            className="h-9 flex-1"
            placeholder={`${field === 'leader' ? '担当リーダー' : '担当サブリーダー'}を選択...`}
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => openLeaderDialog(member.id, field === 'leader' ? 'leader' : 'subleader')}
            className="h-9 w-9 hover:bg-blue-50"
          >
            <UserPlus className="h-4 w-4 text-blue-600" />
          </Button>
        </div>
      )
    }

    return (
      <Input
        value={member[field] || ''}
        onChange={(e) => handleInputChange(member.id, field, e.target.value)}
        className="h-9 w-full"
        type={field === 'email' ? 'email' : 'text'}
      />
    )
  }

  const filteredMembers = members.filter(member => {
    const matchesEmployeeId = member.employee_id.toLowerCase().includes(leaderSearchCriteria.employeeId.toLowerCase())
    const matchesName = `${member.last_name}${member.first_name}`.toLowerCase().includes(leaderSearchCriteria.name.toLowerCase())
    const matchesDepartment = leaderSearchCriteria.department === "all" || member.branch === leaderSearchCriteria.department
    return matchesEmployeeId && matchesName && matchesDepartment
  })

  // 無効化の確認ダイアログ
  const handleDisable = async (member: Member) => {
    const confirmed = window.confirm("対象のユーザーを無効化します。よろしいですか？")
    if (confirmed) {
      try {
        const { error } = await newClient()
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

    // エラーとワーニングは上部に表示
    if (message.type === 'error') {
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
                <div className="flex items-center gap-2">
                  {icons[message.type]}
                  <span className="text-sm font-medium whitespace-pre-line">{message.text}</span>
                </div>
                {message.dismissible && (
                  <button
                    onClick={() => setMessage(null)}
                    className="p-1 hover:bg-gray-100 rounded-full"
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
              <span className="text-sm font-medium whitespace-pre-line">{message.text}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  // テーブルヘッダーの定義を修正
  const tableHeaders = [
    { id: 'employee_id', label: t('employee-id') },
    { id: 'branch', label: t('department') },
    { id: 'last_name', label: t('last-name') },
    { id: 'first_name', label: t('first-name') },
    { id: 'last_name_en', label: t('last-name-en') },
    { id: 'first_name_en', label: t('first-name-en') },
    { id: 'email', label: t('email') },
    { id: 'leader', label: t('leader') },
    { id: 'subleader', label: t('sub-leader') },
    { id: 'leader_auth', label: t('leader-permission') },
    { id: 'admin_auth', label: t('admin-permission') },
    { id: 'status', label: t('member-status') },
    { id: 'actions', label: t('member-actions') }
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

  // fetchMembers 関数の追加
  const fetchMembers = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await newClient()
        .from('users')
        .select('*')
        .order('employee_id')

      if (error) throw error
      setMembers(data || [])

    } catch (error) {
      console.error('Error fetching members:', error)
      toast({
        title: "エラー",
        description: "メンバー情報の取得に失敗しました",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // フィールド比較の修正
  const isSpecialField = (field: string): boolean => {
    return ['leader', 'subleader', 'is_leader', 'is_admin'].includes(field)
  }

  // 値の取得を修正
  const getValue = (member: Member, field: string): any => {
    if (field === 'leader' || field === 'subleader') {
      return member.supervisor_info[field]
    }
    if (field === 'is_leader' || field === 'is_admin') {
      return member.roles[field]
    }
    return member[field]
  }

  // スーパーバイザー更新関数
  const updateSupervisor = async (
    memberId: string,
    supervisorId: string,
    type: 'leader' | 'subleader'
  ) => {
    const supabase = newClient()
    const { error } = await supabase
      .from('user_supervisors')
      .upsert({
        user_id: memberId,
        pic_user_id: supervisorId,
        supervisor_type: type === 'leader' ? '01' : '02'
      })
    if (error) throw error
  }

  // スーパーバイザー削除関数
  const removeSupervisor = async (
    memberId: string,
    type: 'leader' | 'subleader'
  ) => {
    const typeId = type === 'leader' ? 1 : 2
    const supabase = newClient()
    const { error } = await supabase
      .from('user_supervisors')
      .delete()
      .match({ user_id: memberId, supervisor_type_id: typeId })
    if (error) throw error
  }

  // handleSupervisorUpdate の修正
  const handleSupervisorUpdate = async (
    memberId: string,
    supervisorId: string | null,
    type: 'leader' | 'subleader'
  ) => {
    try {
      if (!supervisorId) {
        return
      }
      await updateSupervisor(memberId, supervisorId, type)
      // ... 残りの処理
    } catch (error) {
      console.error('Error updating supervisor:', error)
      toast({
        title: "エラー",
        description: "スーパーバイザーの更新に失敗しました",
        variant: "destructive",
      })
    }
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
                  value={searchCriteria.branch}
                  onValueChange={(value) => 
                    setSearchCriteria({ ...searchCriteria, branch: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("select-branch")} />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((branch) => (
                      <SelectItem key={branch.code} value={branch.code}>
                        {language === 'ja' ? branch.name_jp : branch.name_en}
                      </SelectItem>
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
              <div className="flex items-end gap-4">
                <Button
                  onClick={handleSearch}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                <Search className="h-4 w-4 mr-2" />
                  検索
                </Button>
                <Button
                  onClick={handleClearSearch}
                  variant="outline"
                >
                  <X className="h-4 w-4 mr-2" />
                  クリア
              </Button>
              </div>
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
                            <TableCell className="p-2">{renderInputField(member, 'branch')}</TableCell>
                            <TableCell className="p-2">{renderInputField(member, 'last_name')}</TableCell>
                            <TableCell className="p-2">{renderInputField(member, 'first_name')}</TableCell>
                            <TableCell className="p-2">{renderInputField(member, 'last_name_en')}</TableCell>
                            <TableCell className="p-2">{renderInputField(member, 'first_name_en')}</TableCell>
                            <TableCell className="p-2">{renderInputField(member, 'email')}</TableCell>
                            <TableCell className="p-2">{renderInputField(member, 'leader')}</TableCell>
                            <TableCell className="p-2">{renderInputField(member, 'subleader')}</TableCell>
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
                            <TableCell className="p-2">{renderInputField(member, 'branch')}</TableCell>
                            <TableCell className="p-2">{renderInputField(member, 'last_name')}</TableCell>
                            <TableCell className="p-2">{renderInputField(member, 'first_name')}</TableCell>
                            <TableCell className="p-2">{renderInputField(member, 'last_name_en')}</TableCell>
                            <TableCell className="p-2">{renderInputField(member, 'first_name_en')}</TableCell>
                            <TableCell className="p-2">{renderInputField(member, 'email')}</TableCell>
                            <TableCell className="p-2">{renderInputField(member, 'leader')}</TableCell>
                            <TableCell className="p-2">{renderInputField(member, 'subleader')}</TableCell>
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
                    {branches.map((dept) => (
                      <SelectItem key={dept.code} value={dept.code}>
                        {language === 'ja' ? dept.name_jp : dept.name_en}
                      </SelectItem>
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
                        <TableCell className="py-1">{member.branch}</TableCell>
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