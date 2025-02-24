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
import type { SupervisorInfo } from '@/types/supabase'

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
  field: keyof MemberFormData;
  message: string;
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

// UserDataの型定義を修正
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
  registration_status: string  // null を削除
  branch_master: Array<{
    name_jp: string
    name_en: string
  }>
}

// nullセーフな文字列変換のヘルパー関数を修正
const safeString = (value: string | null | undefined, defaultValue = ""): string => value ?? defaultValue;

// データベースの型定義を拡張
type RawUser = Database['public']['Tables']['users']['Row']

// branch_masterを含むユーザー型を定義
type UserWithBranch = RawUser & {
  branch_master?: Array<{
    name_jp: string;
    name_en: string;
  } | null>;
  user_supervisors?: Array<{
    supervisor_type: string;
    pic_user_id: string;
    pic_user: {
      id: string;
      employee_id: string;
      last_name: string;
      first_name: string;
    } | null;
  }>;
  user_roles?: Array<{
    user_role_id: string;
  }>;
}

// Member型を修正
type Member = {
  id: string;
  employee_id: string;
  email: string;
  last_name: string;
  first_name: string;
  last_name_en: string | null;
  first_name_en: string | null;
  branch: string;
  branch_name: string;
  registration_status: string;
  is_active: boolean;
  supervisor_info: {
    leader: null | {
      id: string;
      employee_id: string;
      name: string;
    };
    subleader: null | {
      id: string;
      employee_id: string;
      name: string;
    };
    supervisor_type?: string;
  };
  roles: {
    is_leader: boolean;
    is_admin: boolean;
  };
  [key: string]: any;
}

// フィールド型を定義
type MemberField = keyof Member | 'leader' | 'subleader' | 'is_leader' | 'is_admin';

// フォーマット済みメンバー型を定義
type FormattedMember = RawUser & {
  branch_name: string;
  supervisor_info: {
    leader: null;
    subleader: null;
  };
  roles: {
    is_leader: boolean;
    is_admin: boolean;
  };
}

// 型定義の修正
interface MemberFormData {
  id?: string;
  employee_id: string;
  branch: string;
  last_name: string;
  first_name: string;
  last_name_en: string | null;
  first_name_en: string | null;
  email: string;
  leader_role?: boolean;
  admin_role?: boolean;
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
    id: '',
    employee_id: '',
    email: '',
    last_name: '',
    first_name: '',
    last_name_en: null,
    first_name_en: null,
    branch: '',
    branch_name: '',
    registration_status: '00',  // 初期値を '00' (未登録) に変更
    is_active: true,
    supervisor_info: {
      leader: null,
      subleader: null,
      supervisor_type: '01'
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
    let timer: NodeJS.Timeout | null = null;
    
    if (message && (message.type === 'success' || message.type === 'info')) {
      // 新しいタイマーをセットする前に既存のタイマーをクリア
      if (timer) clearTimeout(timer);
      
      timer = setTimeout(() => {
        setMessage(null)
      }, 3000)
    }
    
    return () => {
      if (timer) clearTimeout(timer)
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
  const handleSearch = async (showMessage: boolean = true) => {
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
          ),
          user_supervisors!user_supervisors_user_id_fkey (
            supervisor_type,
            pic_user_id,
            pic_user:users!user_supervisors_pic_user_id_fkey (
              id,
              employee_id,
              last_name,
              first_name
            )
          ),
          user_roles!left (
            user_role_id
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

      if (usersError) {
        console.error('Error searching members:', usersError)
        setMessage({
          type: 'error',
          text: 'メンバー情報の検索に失敗しました',
          dismissible: true,
          persistent: true
        })
        return
      }

      const formattedUsers = ((users as unknown) as UserWithBranch[])?.map(user => {
        // スーパーバイザー情報の整理
        const leader = user.user_supervisors?.find(s => s.supervisor_type === 'leader')?.pic_user
        const subleader = user.user_supervisors?.find(s => s.supervisor_type === 'subleader')?.pic_user

        // ロール情報の整理
        const roles = user.user_roles || []
        const is_leader = roles.some(r => r.user_role_id === 'leader')
        const is_admin = roles.some(r => r.user_role_id === 'admin')

        return {
          id: user.id,
          employee_id: user.employee_id,
          email: user.email,
          last_name: user.last_name,
          first_name: user.first_name,
          last_name_en: user.last_name_en,
          first_name_en: user.first_name_en,
          branch: user.branch,
          branch_name: user.branch_master?.[0]?.name_jp || '',
          registration_status: user.registration_status || '01',
          is_active: user.is_active,
          supervisor_info: {
            leader: leader ? {
              id: leader.id,
              employee_id: leader.employee_id,
              name: `${leader.last_name} ${leader.first_name}`
            } : null,
            subleader: subleader ? {
              id: subleader.id,
              employee_id: subleader.employee_id,
              name: `${subleader.last_name} ${subleader.first_name}`
            } : null
          },
          roles: {
            is_leader,
            is_admin
          }
        }
      }) as Member[]

      setMembers(formattedUsers || [])
      setOriginalMembers(formattedUsers || [])

      // 検索時のメッセージ表示を条件付きに変更
      if (showMessage && !hasSearched) {
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
        setHasSearched(true)
      }

    } catch (error) {
      console.error('Error searching members:', error)
      if (showMessage) {
        setMessage({
          type: 'error',
          text: 'メンバー情報の検索に失敗しました',
          dismissible: true,
          persistent: true
        })
      }
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

  const handleInputChange = (id: string, field: MemberField, value: string | boolean) => {
    setMembers(members.map(member => {
      if (member.id === id) {
        if (field === 'is_leader' || field === 'is_admin') {
          return {
            ...member,
            roles: {
              ...member.roles,
              [field]: value
            }
          }
        }
        return { ...member, [field]: value }
      }
      return member
    }))
    
    setEditingMembers(editingMembers.map(member => {
      if (member.id === id) {
        if (field === 'is_leader' || field === 'is_admin') {
          return {
            ...member,
            roles: {
              ...member.roles,
              [field]: value
            }
          }
        }
        return { ...member, [field]: value }
      }
      return member
    }))
  }

  // バリデーション関数の修正
  const validateMember = (member: MemberFormData): ValidationError[] => {
    const errors: ValidationError[] = [];
        
        // システム必須項目のチェック
    if (!member.employee_id || typeof member.employee_id !== 'string' || !member.employee_id.trim()) {
      errors.push({ field: 'employee_id', message: '社員番号は必須です' });
        }
        
        // 業務必須項目のチェック
    const requiredFields: { field: keyof MemberFormData; label: string }[] = [
          { field: 'branch', label: '部署' },
          { field: 'last_name', label: '姓' },
          { field: 'first_name', label: '名' },
          { field: 'email', label: 'メールアドレス' }
        ];

        requiredFields.forEach(({ field, label }) => {
      const value = member[field];
      if (!value || typeof value !== 'string' || !value.trim()) {
        errors.push({ field, message: `${label}は必須です` });
      }
    });

    // メールアドレスの形式チェック
    if (member.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(member.email)) {
      errors.push({ field: 'email', message: 'メールアドレスの形式が正しくありません' });
    }

    return errors;
  };

  // 保存処理の修正
  const handleSave = async () => {
    setIsLoading(true)
    const supabase = newClient()
    
    try {
      // 現在のユーザーIDを取得
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError) throw userError
      if (!user) throw new Error('ユーザー情報が取得できません')

      // 1. 変更検知の改善
      const changedMembers = members.filter(current => {
        const original = originalMembers.find(orig => orig.id === current.id)
        if (!original) return false

        return (
          current.last_name !== original.last_name ||
          current.first_name !== original.first_name ||
          current.last_name_en !== original.last_name_en ||
          current.first_name_en !== original.first_name_en ||
          current.email !== original.email ||
          current.branch !== original.branch ||
          current.roles.is_leader !== original.roles.is_leader ||
          current.roles.is_admin !== original.roles.is_admin ||
          JSON.stringify(current.supervisor_info) !== JSON.stringify(original.supervisor_info)
        )
      })

      if (changedMembers.length === 0 && editingMembers.length === 0) {
        setMessage({
          type: 'info',
          text: t('no-data-to-update'),
          persistent: true,
          dismissible: true
        })
        setIsLoading(false)
        return
      }

      // 2. 既存メンバーの更新
      for (const member of changedMembers) {
        // 2-1. ユーザー基本情報の更新
        const { error: updateError } = await supabase
          .from('users')
          .update({
            last_name: member.last_name,
            first_name: member.first_name,
            last_name_en: member.last_name_en,
            first_name_en: member.first_name_en,
            email: member.email,
            branch: member.branch
          })
          .eq('id', member.id)

        if (updateError) throw updateError

        // 2-2. 担当リーダー・サブリーダーの更新
        // まず既存の関連レコードを削除
        const { error: deleteSupError } = await supabase
          .from('user_supervisors')
          .delete()
          .eq('user_id', member.id)

        if (deleteSupError) throw deleteSupError

        // 新しい関連レコードを追加
        const supervisorsToInsert = []
        
        if (member.supervisor_info.leader) {
          supervisorsToInsert.push({
            user_id: member.id,
            supervisor_type: 'leader',
            pic_user_id: member.supervisor_info.leader.id,
            created_by: user.id,
            updated_by: user.id
          })
        }
        
        if (member.supervisor_info.subleader) {
          supervisorsToInsert.push({
            user_id: member.id,
            supervisor_type: 'subleader',
            pic_user_id: member.supervisor_info.subleader.id,
            created_by: user.id,
            updated_by: user.id
          })
        }

        if (supervisorsToInsert.length > 0) {
          const { error: insertSupError } = await supabase
            .from('user_supervisors')
            .insert(supervisorsToInsert)

          if (insertSupError) throw insertSupError
        }

        // 2-3. リーダー権限の更新
        if (!member.roles.is_leader) {
          // リーダー権限を削除
          const { error: deleteLeaderError } = await supabase
            .from('user_roles')
            .delete()
            .eq('user_id', member.id)
            .eq('user_role_id', 'leader')

          if (deleteLeaderError) throw deleteLeaderError
        } else {
          // リーダー権限を追加
          const { error: insertLeaderError } = await supabase
            .from('user_roles')
            .upsert({
              user_id: member.id,
              user_role_id: 'leader',
              created_by: user.id,
              updated_by: user.id
            }, {
              onConflict: 'user_id,user_role_id'
            })

          if (insertLeaderError) throw insertLeaderError
        }

        // 2-4. 管理者権限の更新
        if (!member.roles.is_admin) {
          // 管理者権限を削除
          const { error: deleteAdminError } = await supabase
            .from('user_roles')
            .delete()
            .eq('user_id', member.id)
            .eq('user_role_id', 'admin')

          if (deleteAdminError) throw deleteAdminError
        } else {
          // 管理者権限を追加
          const { error: insertAdminError } = await supabase
            .from('user_roles')
            .upsert({
              user_id: member.id,
              user_role_id: 'admin',
              created_by: user.id,
              updated_by: user.id
            }, {
              onConflict: 'user_id,user_role_id'
            })

          if (insertAdminError) throw insertAdminError
        }
      }

      // 3. 新規メンバーの追加
      for (const member of editingMembers) {
        // 3-1. ユーザー基本情報の追加
        const { data: newUser, error: insertError } = await supabase
          .from('users')
          .insert({
            employee_id: member.employee_id,
            last_name: member.last_name,
            first_name: member.first_name,
            last_name_en: member.last_name_en,
            first_name_en: member.first_name_en,
            email: member.email,
            branch: member.branch,
            registration_status: '01',
            is_active: true
          })
          .select()
          .single()

        if (insertError) throw insertError

        // 3-2. 担当リーダー・サブリーダーの追加
        const supervisorsToInsert = []
        
        if (member.supervisor_info.leader) {
          supervisorsToInsert.push({
            user_id: newUser.id,
            supervisor_type: 'leader',
            pic_user_id: member.supervisor_info.leader.id,
            created_by: user.id,
            updated_by: user.id
          })
        }
        
        if (member.supervisor_info.subleader) {
          supervisorsToInsert.push({
            user_id: newUser.id,
            supervisor_type: 'subleader',
            pic_user_id: member.supervisor_info.subleader.id,
            created_by: user.id,
            updated_by: user.id
          })
        }

        if (supervisorsToInsert.length > 0) {
          const { error: insertSupError } = await supabase
            .from('user_supervisors')
            .insert(supervisorsToInsert)

          if (insertSupError) throw insertSupError
        }

        // 3-3. 権限情報の追加
        const rolesToInsert = []
        if (member.roles.is_leader) {
          rolesToInsert.push({
            user_id: newUser.id,
            user_role_id: 'leader',
            created_by: user.id,
            updated_by: user.id
          })
        }
        if (member.roles.is_admin) {
          rolesToInsert.push({
            user_id: newUser.id,
            user_role_id: 'admin',
            created_by: user.id,
            updated_by: user.id
          })
        }

        if (rolesToInsert.length > 0) {
          const { error: rolesError } = await supabase
            .from('user_roles')
            .insert(rolesToInsert)

          if (rolesError) throw rolesError
        }
      }

      // 4. 画面の更新（メッセージ表示前に実行）
      setEditingMembers([])
      setHasSearched(false)
      await handleSearch(false)  // メッセージ表示を無効化

      // 5. 成功メッセージの表示（最後に実行）
      setMessage({
        type: 'success',
        text: t('update-success'),
        persistent: false
      })

    } catch (error) {
      console.error('Error in save process:', error)
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : t('update-error'),
        dismissible: true,
        persistent: true
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleLeaderSelect = (selectedMember: Member) => {
    if (currentEditingMember) {
      const { memberId, field } = currentEditingMember
      
      setMembers(members.map(member => {
        if (member.id === memberId) {
          return {
            ...member,
            supervisor_info: {
              ...member.supervisor_info,
              [field]: {
                id: selectedMember.id,
                employee_id: selectedMember.employee_id,
                name: `${selectedMember.last_name} ${selectedMember.first_name}`
              }
            }
          }
        }
        return member
      }))
      
      setEditingMembers(editingMembers.map(member => {
        if (member.id === memberId) {
          return {
            ...member,
            supervisor_info: {
              ...member.supervisor_info,
              [field]: {
                id: selectedMember.id,
                employee_id: selectedMember.employee_id,
                name: `${selectedMember.last_name} ${selectedMember.first_name}`
              }
            }
          }
        }
        return member
      }))
    }
    
    setLeaderDialogOpen(false)
    setLeaderSearchCriteria({ employeeId: "", name: "", department: "" })
    setCurrentEditingMember(null)
  }

  const openLeaderDialog = (memberId: string, field: 'leader' | 'subleader') => {
    setCurrentEditingMember({ memberId, field })
    setLeaderDialogOpen(true)
  }

  const renderInputField = (member: Member, field: MemberField) => {
    if (field === 'employee_id') {
      // 既存レコード（members配列に含まれるレコード）の場合はラベル表示
      const isExistingMember = members.some(m => m.id === member.id);
      return isExistingMember ? (
        <div className="px-2 py-1.5 text-sm">
          {member.employee_id}
        </div>
      ) : (
        <Input
          value={member.employee_id || ''}
          onChange={(e) => handleInputChange(member.id, 'employee_id', e.target.value)}
          className="w-full h-9"
        />
      )
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
            checked={member.roles[field]}
            onCheckedChange={(checked) => {
              const value = checked === true
              handleInputChange(member.id, field, value)
            }}
          />
        </div>
      )
    }

    if (field === 'leader' || field === 'subleader') {
      const supervisorInfo = member.supervisor_info[field]
      return (
        <div className="flex items-center gap-2">
          <div 
            onClick={() => openLeaderDialog(member.id, field)}
            className="flex-1 h-9 px-3 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground cursor-pointer flex items-center text-sm whitespace-nowrap overflow-hidden"
          >
            {supervisorInfo ? (
              <span className="truncate">{supervisorInfo.name}</span>
            ) : (
              <span className="text-blue-600 hover:underline">選択してください</span>
            )}
          </div>
          {supervisorInfo && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={(e) => {
                e.stopPropagation()
                handleClearSupervisor(member.id, field)
              }}
              className="h-9 w-9 hover:bg-red-50 flex-shrink-0"
            >
              <X className="h-4 w-4 text-red-600" />
            </Button>
          )}
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
                  <button
                    onClick={() => setMessage(null)}
                    className="p-1 hover:bg-gray-100 rounded-full"
                  >
                    <X className="h-4 w-4" />
                  </button>
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
      '00': '未登録',
      '01': '仮登録済み',
      '02': '招待済み',
      '03': '認証済み',
      '99': '廃止済み'
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

  // メンバー一覧を取得する関数を修正
  const fetchMembers = async () => {
    try {
      const { data: users, error: usersError } = await newClient()
        .from('users')
        .select(`
          *,
          branch_master (
            name_jp,
            name_en
          )
        `)

      if (usersError) throw usersError

      const formattedUsers = (users as UserWithBranch[])?.map(user => ({
        id: user.id,
        employee_id: user.employee_id,
        email: user.email,
        last_name: user.last_name,
        first_name: user.first_name,
        last_name_en: user.last_name_en,
        first_name_en: user.first_name_en,
        branch: user.branch,
        branch_name: user.branch_master?.[0]?.name_jp || '',
        registration_status: user.registration_status || '01',
        is_active: user.is_active,
        supervisor_info: {
          leader: null,
          subleader: null,
          supervisor_type: '01'  // デフォルト値を設定
        },
        roles: {
          is_leader: false,
          is_admin: false
        }
      })) as Member[]

      setMembers(formattedUsers || [])
      setOriginalMembers(formattedUsers || [])
      
    } catch (error) {
      console.error('Error fetching members:', error)
      toast({
        title: "エラー",
        description: "メンバー一覧の取得に失敗しました",
        variant: "destructive",
      })
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

  // スーパーバイザー情報をクリアする関数
  const handleClearSupervisor = (memberId: string, field: 'leader' | 'subleader') => {
    setMembers(members.map(member => {
      if (member.id === memberId) {
        return {
          ...member,
          supervisor_info: {
            ...member.supervisor_info,
            [field]: null
          }
        }
      }
      return member
    }))
    
    setEditingMembers(editingMembers.map(member => {
      if (member.id === memberId) {
        return {
          ...member,
          supervisor_info: {
            ...member.supervisor_info,
            [field]: null
          }
        }
      }
      return member
    }))
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
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 pb-4 border-b">
              <div className="w-full sm:w-auto">
                <label className="text-sm font-medium mb-2 block">所属</label>
                <Select
                  value={searchCriteria.branch}
                  onValueChange={(value) => 
                    setSearchCriteria({ ...searchCriteria, branch: value })
                  }
                >
                  <SelectTrigger className="w-full sm:w-[200px]">
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
              <div className="w-full sm:w-auto">
                <label className="text-sm font-medium mb-2 block">{t("employee-id")}</label>
                <Input
                  value={searchCriteria.employeeId}
                  onChange={(e) => setSearchCriteria({ ...searchCriteria, employeeId: e.target.value })}
                  className="w-full sm:w-[150px]"
                  placeholder={t("enter-employee-id")}
                />
              </div>
              <div className="w-full sm:w-auto">
                <label className="text-sm font-medium mb-2 block">{t("name")}</label>
                <Input
                  value={searchCriteria.name}
                  onChange={(e) => setSearchCriteria({ ...searchCriteria, name: e.target.value })}
                  className="w-full sm:w-[200px]"
                  placeholder={t("enter-name")}
                />
              </div>
              <div className="flex gap-2 w-full sm:w-auto mt-4 sm:mt-0">
                <Button
                  onClick={(e) => handleSearch(true)}
                  className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white"
                >
                <Search className="h-4 w-4 mr-2" />
                  検索
                </Button>
                <Button
                  onClick={handleClearSearch}
                  variant="outline"
                  className="flex-1 sm:flex-none"
                >
                  <X className="h-4 w-4 mr-2" />
                  クリア
              </Button>
              </div>
            </div>

            <div>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                  <h3 className="text-lg font-medium">{t("member-list")}</h3>
                <div className="flex gap-2 w-full sm:w-auto">
                  <Button onClick={handleAddRow} variant="outline" className="flex-1 sm:flex-none">
                      <Plus className="h-4 w-4 mr-2" />
                      {t("add-row")}
                    </Button>
                  <Button onClick={handleSave} className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700">
                      <Save className="h-4 w-4 mr-2" />
                      {t("save")}
                    </Button>
                </div>
              </div>

              <div className="border rounded-lg">
                <div className="w-full overflow-x-auto">
                  <div className="min-w-[1200px] lg:min-w-full">
                    <Table>
                      <TableHeader>
                        <TableRow className="[&>th]:px-0 [&>th]:text-center">
                          <TableHead className="w-[6%]">{t("employee-id")}</TableHead>
                          <TableHead className="w-[10%]">所属</TableHead>
                          <TableHead className="w-[7%]">{t("last-name")}</TableHead>
                          <TableHead className="w-[7%]">{t("first-name")}</TableHead>
                          <TableHead className="w-[7%]">{t("last-name-en")}</TableHead>
                          <TableHead className="w-[7%]">{t("first-name-en")}</TableHead>
                          <TableHead className="w-[11%]">{t("email")}</TableHead>
                          <TableHead className="w-[12%]">担当リーダー</TableHead>
                          <TableHead className="w-[12%]">担当サブリーダー</TableHead>
                          <TableHead className="w-[6%]">{t("leader-permission")}</TableHead>
                          <TableHead className="w-[6%]">{t("admin-permission")}</TableHead>
                          <TableHead className="w-[5%]">ステータス</TableHead>
                          <TableHead className="w-[4%]">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="[&>tr>td]:px-1">
                        {members.map((member) => (
                          <TableRow key={member.id}>
                            <TableCell className="py-1">{renderInputField(member, 'employee_id')}</TableCell>
                            <TableCell className="py-1">{renderInputField(member, 'branch')}</TableCell>
                            <TableCell className="py-1">{renderInputField(member, 'last_name')}</TableCell>
                            <TableCell className="py-1">{renderInputField(member, 'first_name')}</TableCell>
                            <TableCell className="py-1">{renderInputField(member, 'last_name_en')}</TableCell>
                            <TableCell className="py-1">{renderInputField(member, 'first_name_en')}</TableCell>
                            <TableCell className="py-1">{renderInputField(member, 'email')}</TableCell>
                            <TableCell className="py-1">{renderInputField(member, 'leader')}</TableCell>
                            <TableCell className="py-1">{renderInputField(member, 'subleader')}</TableCell>
                            <TableCell className="py-1">{renderInputField(member, 'is_leader')}</TableCell>
                            <TableCell className="py-1">{renderInputField(member, 'is_admin')}</TableCell>
                            <TableCell className="py-1">{getStatusText(member.registration_status)}</TableCell>
                            <TableCell className="py-1">
                              {renderActionButtons(member)}
                            </TableCell>
                          </TableRow>
                        ))}

                        {editingMembers.map((member) => (
                          <TableRow key={member.id}>
                            <TableCell className="py-1">{renderInputField(member, 'employee_id')}</TableCell>
                            <TableCell className="py-1">{renderInputField(member, 'branch')}</TableCell>
                            <TableCell className="py-1">{renderInputField(member, 'last_name')}</TableCell>
                            <TableCell className="py-1">{renderInputField(member, 'first_name')}</TableCell>
                            <TableCell className="py-1">{renderInputField(member, 'last_name_en')}</TableCell>
                            <TableCell className="py-1">{renderInputField(member, 'first_name_en')}</TableCell>
                            <TableCell className="py-1">{renderInputField(member, 'email')}</TableCell>
                            <TableCell className="py-1">{renderInputField(member, 'leader')}</TableCell>
                            <TableCell className="py-1">{renderInputField(member, 'subleader')}</TableCell>
                            <TableCell className="py-1">{renderInputField(member, 'is_leader')}</TableCell>
                            <TableCell className="py-1">{renderInputField(member, 'is_admin')}</TableCell>
                            <TableCell className="py-1">{getStatusText('00')}</TableCell>
                            <TableCell className="py-1">
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
        <DialogContent className="w-[95vw] max-w-[600px] h-[90vh] sm:h-auto">
          <DialogHeader>
            <DialogTitle>
              {currentEditingMember?.field === 'leader' ? t("select-leader") : t("select-sub-leader")}
            </DialogTitle>
            <DialogDescription>
              {t("select-member")}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">所属</label>
                <Select
                  value={leaderSearchCriteria.department}
                  onValueChange={(value) => setLeaderSearchCriteria({ ...leaderSearchCriteria, department: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="所属を選択" />
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

            <div className="border rounded-lg overflow-hidden max-h-[calc(90vh-300px)] sm:max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">{t("employee-id")}</TableHead>
                    <TableHead className="w-48">{t("name")}</TableHead>
                    <TableHead className="w-40">所属</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMembers.length > 0 ? (
                    filteredMembers.map((member) => {
                      const branchName = branches.find(b => b.code === member.branch)
                      return (
                      <TableRow key={member.id} className="hover:bg-blue-50">
                        <TableCell className="py-1">{member.employee_id}</TableCell>
                        <TableCell className="py-1">{member.last_name} {member.first_name}</TableCell>
                          <TableCell className="py-1">
                            {branchName ? (language === 'ja' ? branchName.name_jp : branchName.name_en) : ''}
                          </TableCell>
                        <TableCell className="py-1">
                          <Button
                            onClick={() => handleLeaderSelect(member)}
                            className="h-7 w-full bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            {t("select")}
                          </Button>
                        </TableCell>
                      </TableRow>
                      )
                    })
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
              setLeaderSearchCriteria({ employeeId: "", name: "", department: "" })
            }} className="w-full sm:w-auto">
              {t("cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}