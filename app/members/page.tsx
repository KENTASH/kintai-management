"use client"

import { useState, useEffect } from "react"
import React from 'react'
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
  details?: any  // エラーの詳細情報
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
  const [errorFields, setErrorFields] = useState<{[key: string]: Set<string>}>({}) // エラーフィールドを管理

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

      // 社員番号の昇順でソート
      const sortedUsers = formattedUsers.sort((a, b) => 
        a.employee_id.localeCompare(b.employee_id)
      );

      setMembers(sortedUsers || [])
      setOriginalMembers(sortedUsers || [])

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
    // 新しい行を追加し、社員番号でソート
    const newEditingMembers = [...editingMembers, { ...emptyMember, id: Date.now().toString() }];
    
    // 既存のメンバーと新規追加行を社員番号でソート
    const sortedMembers = newEditingMembers.sort((a, b) => 
      a.employee_id.localeCompare(b.employee_id)
    );
    
    setEditingMembers(sortedMembers);
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
    // 編集中のメンバーの場合
    if (editingMembers.some(m => m.id === id)) {
      setEditingMembers(prev => {
        return prev.map(member => {
          if (member.id !== id) return member

          if (field === 'is_leader' || field === 'is_admin') {
            return {
              ...member,
              roles: {
                ...member.roles,
                [field]: value as boolean
              }
            }
          }

          if (field === 'leader' || field === 'subleader') {
            return {
              ...member,
              supervisor_info: {
                ...member.supervisor_info,
                [field]: value
              }
            }
          }
          return { ...member, [field]: value }
        })
      })
      return
    }

    // 既存メンバーの場合
    setMembers(prev => {
      return prev.map(member => {
        if (member.id !== id) return member

        if (field === 'is_leader' || field === 'is_admin') {
          return {
            ...member,
            roles: {
              ...member.roles,
              [field]: value as boolean
            }
          }
        }

        if (field === 'leader' || field === 'subleader') {
          return {
            ...member,
            supervisor_info: {
              ...member.supervisor_info,
              [field]: value
            }
          }
        }
        return { ...member, [field]: value }
      })
    })
  }

  // バリデーション関数の修正
  const validateMember = (member: MemberFormData): ValidationError[] => {
    const errors: ValidationError[] = [];
    
    // 社員番号は必須、数字のみ
    if (!member.employee_id || typeof member.employee_id !== 'string' || !member.employee_id.trim()) {
      errors.push({ field: 'employee_id', message: '社員番号は必須です' });
    } else if (!/^\d+$/.test(member.employee_id)) {
      errors.push({ field: 'employee_id', message: '社員番号は数字のみで入力してください' });
    }
    
    // 所属は必須
    if (!member.branch || typeof member.branch !== 'string' || !member.branch.trim()) {
      errors.push({ field: 'branch', message: '所属は必須です' });
    }
    
    // 姓は必須、日本語文字のみ
    if (!member.last_name || typeof member.last_name !== 'string' || !member.last_name.trim()) {
      errors.push({ field: 'last_name', message: '姓は必須です' });
    } else if (!/^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\s]+$/.test(member.last_name)) {
      errors.push({ field: 'last_name', message: '姓は日本語で入力してください' });
    }
    
    // 名は必須、日本語文字のみ
    if (!member.first_name || typeof member.first_name !== 'string' || !member.first_name.trim()) {
      errors.push({ field: 'first_name', message: '名は必須です' });
    } else if (!/^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\s]+$/.test(member.first_name)) {
      errors.push({ field: 'first_name', message: '名は日本語で入力してください' });
    }
    
    // 姓（英語）は必須、半角文字のみ
    if (!member.last_name_en || typeof member.last_name_en !== 'string' || !member.last_name_en.trim()) {
      errors.push({ field: 'last_name_en', message: '姓（英語）は必須です' });
    } else if (!/^[a-zA-Z\s]+$/.test(member.last_name_en)) {
      errors.push({ field: 'last_name_en', message: '姓（英語）は半角英字で入力してください' });
    }
    
    // 名（英語）は必須、半角文字のみ
    if (!member.first_name_en || typeof member.first_name_en !== 'string' || !member.first_name_en.trim()) {
      errors.push({ field: 'first_name_en', message: '名（英語）は必須です' });
    } else if (!/^[a-zA-Z\s]+$/.test(member.first_name_en)) {
      errors.push({ field: 'first_name_en', message: '名（英語）は半角英字で入力してください' });
    }

    // メールアドレスは必須、メールアドレス形式
    if (!member.email || typeof member.email !== 'string' || !member.email.trim()) {
      errors.push({ field: 'email', message: 'メールアドレスは必須です' });
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(member.email)) {
      errors.push({ field: 'email', message: 'メールアドレスの形式が正しくありません' });
    }

    return errors;
  };

  // 保存処理の修正
  const handleSave = async () => {
    console.log('handleSave started');
    setIsLoading(true)
    const supabase = newClient()
    
    // エラーフィールドをリセット
    setErrorFields({})
    
    try {
      console.log('Getting user info...');
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      console.log('User info result:', { user, error: userError });

      if (userError) throw userError
      if (!user) throw new Error('ユーザー情報が取得できません')

      console.log('Current state:', {
        members,
        originalMembers,
        editingMembers
      });

      // 1. 変更検知
      const changedMembers = members.filter(current => {
        const original = originalMembers.find(orig => orig.id === current.id)
        if (!original) return false

        const hasChanged = (
          current.last_name !== original.last_name ||
          current.first_name !== original.first_name ||
          current.last_name_en !== original.last_name_en ||
          current.first_name_en !== original.first_name_en ||
          current.email !== original.email ||
          current.branch !== original.branch ||
          current.roles.is_leader !== original.roles.is_leader ||
          current.roles.is_admin !== original.roles.is_admin ||
          JSON.stringify(current.supervisor_info) !== JSON.stringify(original.supervisor_info)
        );

        console.log('Change detection for member:', {
          id: current.id,
          hasChanged,
          current,
          original
        });

        return hasChanged;
      }).map(member => ({
        ...member,
        updated_by: user.id
      }))

      // 2. 新規メンバーの準備
      const newMembers = editingMembers.map(member => {
        // idを除外し、必要なフィールドを追加
        const { id, ...memberWithoutId } = member;
        return {
          ...memberWithoutId,
          branch: member.branch || 'default',  // branchが未設定の場合のデフォルト値
          registration_status: '01',  // 仮登録済み
          is_active: true,
          created_by: user.id,
          updated_by: user.id,
          roles: {
            is_leader: member.roles?.is_leader || false,
            is_admin: member.roles?.is_admin || false
          },
          supervisor_info: {
            leader: member.supervisor_info?.leader || null,
            subleader: member.supervisor_info?.subleader || null
          }
        }
      })

      console.log('Prepared data:', {
        changedMembersCount: changedMembers.length,
        newMembersCount: newMembers.length,
        changedMembers,
        newMembers
      });

      // データの検証
      if (changedMembers.length === 0 && newMembers.length === 0) {
        console.log('No data to update');
        setMessage({
          type: 'info',
          text: t('no-data-to-update'),
          persistent: true,
          dismissible: true
        })
        setIsLoading(false)
        return
      }
      
      // バリデーションチェック
      let hasValidationError = false;
      const errorMessages: string[] = [];
      
      // 変更メンバーのバリデーション
      for (const member of changedMembers) {
        const memberData: MemberFormData = {
          id: member.id,
          employee_id: member.employee_id,
          branch: member.branch,
          last_name: member.last_name,
          first_name: member.first_name,
          last_name_en: member.last_name_en,
          first_name_en: member.first_name_en,
          email: member.email
        };
        
        const errors = validateMember(memberData);
        if (errors.length > 0) {
          hasValidationError = true;
          
          // エラーフィールドを設定
          setErrorFields(prev => {
            const newErrorFields = { ...prev };
            if (!newErrorFields[member.id]) {
              newErrorFields[member.id] = new Set();
            }
            
            errors.forEach(error => {
              newErrorFields[member.id].add(error.field);
              // エラーメッセージを追加（重複を避けるため）
              if (!errorMessages.includes(error.message)) {
                errorMessages.push(error.message);
              }
            });
            
            return newErrorFields;
          });
        }
      }
      
      // 新規メンバーのバリデーション
      for (let i = 0; i < editingMembers.length; i++) {
        const member = editingMembers[i];
        const memberData: MemberFormData = {
          employee_id: member.employee_id,
          branch: member.branch,
          last_name: member.last_name,
          first_name: member.first_name,
          last_name_en: member.last_name_en,
          first_name_en: member.first_name_en,
          email: member.email
        };
        
        const errors = validateMember(memberData);
        if (errors.length > 0) {
          hasValidationError = true;
          
          // エラーフィールドを設定
          setErrorFields(prev => {
            const newErrorFields = { ...prev };
            const tempId = `new-${i}`;
            if (!newErrorFields[tempId]) {
              newErrorFields[tempId] = new Set();
            }
            
            errors.forEach(error => {
              newErrorFields[tempId].add(error.field);
              // エラーメッセージを追加（重複を避けるため）
              if (!errorMessages.includes(error.message)) {
                errorMessages.push(error.message);
              }
            });
            
            return newErrorFields;
          });
        }
      }
      
      // バリデーションエラーがある場合は処理を中断
      if (hasValidationError) {
        // 複数のエラーメッセージを結合して表示
        const errorMessage = errorMessages.join('\n');
        throw new Error(errorMessage);
      }

      // メールアドレスの重複チェック
      // 1. 新規メンバー同士の重複チェック
      const newMemberEmails = newMembers.map(member => member.email);
      const duplicateNewEmails = newMemberEmails.filter((email, index) => 
        email && newMemberEmails.indexOf(email) !== index
      );
      
      if (duplicateNewEmails.length > 0) {
        throw new Error(`入力されたメールアドレス（${duplicateNewEmails[0]}）はすでに使用されているため登録することはできません。`);
      }
      
      // 社員番号と所属の組み合わせの重複チェック（新規メンバー）
      if (newMembers.length > 0) {
        for (let i = 0; i < newMembers.length; i++) {
          const newMember = newMembers[i];
          if (!newMember.employee_id || !newMember.branch) continue;
          
          const { data: existingUsers, error: checkError } = await supabase
            .from('users')
            .select('id, employee_id, branch, registration_status')
            .eq('employee_id', newMember.employee_id)
            .eq('branch', newMember.branch)
            .eq('is_active', true)
            .neq('registration_status', '99'); // 廃止済みではないレコードを検索
            
          if (checkError) throw checkError;
          
          if (existingUsers && existingUsers.length > 0) {
            // エラーフィールドを設定
            setErrorFields(prev => {
              const newErrorFields = { ...prev };
              // 新規メンバーの場合、インデックスを使用した一時的なIDを生成
              const tempId = `new-${i}`;
              if (!newErrorFields[tempId]) {
                newErrorFields[tempId] = new Set();
              }
              newErrorFields[tempId].add('employee_id');
              newErrorFields[tempId].add('branch');
              return newErrorFields;
            });
            throw new Error(`すでに同じ所属で同じ社員番号の有効なユーザーが存在しています。`);
          }
        }
      }
      
      // 2. 新規メンバーと既存メンバーの重複チェック
      if (newMembers.length > 0) {
        const emailsToCheck = newMembers.map(member => member.email).filter(Boolean);
        
        if (emailsToCheck.length > 0) {
          const { data: existingUsers, error: checkError } = await supabase
            .from('users')
            .select('email')
            .in('email', emailsToCheck);
            
          if (checkError) throw checkError;
          
          if (existingUsers && existingUsers.length > 0) {
            throw new Error(`入力されたメールアドレス（${existingUsers[0].email}）はすでに使用されているため登録することはできません。`);
          }
        }
      }
      
      // 3. 変更メンバーのメールアドレス重複チェック
      if (changedMembers.length > 0) {
        for (const member of changedMembers) {
          if (!member.email) continue;
          
          const { data: existingUsers, error: checkError } = await supabase
            .from('users')
            .select('email')
            .eq('email', member.email)
            .neq('id', member.id);
            
          if (checkError) throw checkError;
          
          if (existingUsers && existingUsers.length > 0) {
            // エラーフィールドを設定
            setErrorFields(prev => {
              const newErrorFields = { ...prev };
              if (!newErrorFields[member.id]) {
                newErrorFields[member.id] = new Set();
              }
              newErrorFields[member.id].add('email');
              return newErrorFields;
            });
            throw new Error(`入力されたメールアドレス（${member.email}）はすでに使用されているため登録することはできません。`);
          }
          
          // 社員番号と所属の組み合わせの重複チェック（更新メンバー）
          if (member.employee_id && member.branch) {
            const { data: existingEmployees, error: employeeCheckError } = await supabase
              .from('users')
              .select('id, employee_id, branch, registration_status')
              .eq('employee_id', member.employee_id)
              .eq('branch', member.branch)
              .eq('is_active', true)
              .neq('registration_status', '99') // 廃止済みではないレコードを検索
              .neq('id', member.id); // 自分自身は除外
              
            if (employeeCheckError) throw employeeCheckError;
            
            if (existingEmployees && existingEmployees.length > 0) {
              // エラーフィールドを設定
              setErrorFields(prev => {
                const newErrorFields = { ...prev };
                if (!newErrorFields[member.id]) {
                  newErrorFields[member.id] = new Set();
                }
                newErrorFields[member.id].add('employee_id');
                newErrorFields[member.id].add('branch');
                return newErrorFields;
              });
              throw new Error(`すでに同じ所属で同じ社員番号の有効なユーザーが存在しています。`);
            }
          }
        }
      }

      // 3. API呼び出し
      console.log('Sending request to API...');
      const response = await fetch('/api/members/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          changedMembers,
          newMembers
        })
      })

      const result = await response.json()
      console.log('API Response:', {
        status: response.status,
        ok: response.ok,
        result
      });

      if (!response.ok) {
        console.error('API Error Details:', {
          status: response.status,
          statusText: response.statusText,
          result: result
        })
        throw new Error(result.error || 'データの保存に失敗しました')
      }

      // 4. 成功時の処理
      console.log('Save successful, cleaning up...');
      setEditingMembers([])
      
      // 5. 検索条件をリセットして再検索（メッセージを表示せずに）
      setHasSearched(false)
      await handleSearch(false)
      
      // 保存成功メッセージを表示（検索後に表示することで重複を防ぐ）
      setMessage({
        type: 'success',
        text: result.message || t('update-success'),
        persistent: false
      })

    } catch (error) {
      console.error('Error in save process:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : t('update-error'),
        details: error instanceof Error ? error.cause : undefined,
        dismissible: true,
        persistent: true
      })
    } finally {
      console.log('handleSave completed');
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
    // エラー状態の判定
    let memberId = member.id;
    
    // 新規メンバーの場合、editingMembersの中でのインデックスを使用して一時的なIDを生成
    if (!memberId && editingMembers.length > 0) {
      const index = editingMembers.findIndex(m => 
        m.employee_id === member.employee_id && 
        m.last_name === member.last_name && 
        m.first_name === member.first_name
      );
      if (index !== -1) {
        memberId = `new-${index}`;
      }
    }
    
    const hasError = memberId ? errorFields[memberId]?.has(field as string) : false;
    const errorStyle = hasError ? 'border-red-500 bg-red-50' : '';
    
    if (field === 'employee_id') {
      // 既存レコード（members配列に含まれるレコード）の場合はラベル表示
      const isExistingMember = members.some(m => m.id === member.id);
      return isExistingMember ? (
        <div className={`px-2 py-1.5 text-sm ${hasError ? 'bg-red-50 border border-red-500 rounded' : ''}`}>
          {member.employee_id}
        </div>
      ) : (
        <Input
          value={member.employee_id || ''}
          onChange={(e) => handleInputChange(member.id, 'employee_id', e.target.value)}
          className={`w-full h-9 ${errorStyle}`}
        />
      )
    }

    if (field === 'email') {
      // 既存レコード（members配列に含まれるレコード）の場合はラベル表示
      const isExistingMember = members.some(m => m.id === member.id);
      return isExistingMember ? (
        <div className={`px-2 py-1.5 text-sm ${hasError ? 'bg-red-50 border border-red-500 rounded' : ''}`}>
          {member.email}
        </div>
      ) : (
        <Input
          value={member.email || ''}
          onChange={(e) => handleInputChange(member.id, 'email', e.target.value)}
          className={`w-full h-9 ${errorStyle}`}
          type="email"
        />
      )
    }

    if (field === 'branch') {
      return (
        <Select
          value={member[field] || ''}
          onValueChange={(value) => handleInputChange(member.id, field, value)}
        >
          <SelectTrigger className={`h-9 w-full ${errorStyle}`}>
            <SelectValue placeholder={t("select-branch")} />
          </SelectTrigger>
          <SelectContent>
            {branches
              .filter(branch => branch.code !== 'all')  // "全て"を除外
              .map((branch) => (
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
        <div 
          onClick={() => openLeaderDialog(member.id, field)}
          className="h-9 px-3 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground cursor-pointer flex items-center justify-between text-sm relative"
        >
          {supervisorInfo ? (
            <>
              <span className="truncate pr-6">{supervisorInfo.name}</span>
              <span 
                onClick={(e) => {
                  e.stopPropagation()
                  handleClearSupervisor(member.id, field)
                }}
                className="absolute right-2 hover:bg-red-50 rounded-full p-1 cursor-pointer"
              >
                <X className="h-4 w-4 text-red-600" />
              </span>
            </>
          ) : (
            <span className="text-blue-600 hover:underline">選択してください</span>
          )}
        </div>
      )
    }

    return (
      <Input
        value={member[field] || ''}
        onChange={(e) => handleInputChange(member.id, field, e.target.value)}
        className={`h-9 w-full ${errorStyle}`}
        type="text"
      />
    )
  }

  const filteredMembers = members.filter(member => {
    // 社員番号の一致確認
    const matchesEmployeeId = member.employee_id.toLowerCase().includes(leaderSearchCriteria.employeeId.toLowerCase())
    
    // 名前の一致確認
    const matchesName = `${member.last_name}${member.first_name}`.toLowerCase().includes(leaderSearchCriteria.name.toLowerCase())
    
    // 部署の一致確認 - 'all'が選択されている場合はすべての部署を含む
    const matchesDepartment = leaderSearchCriteria.department === "all" || member.branch === leaderSearchCriteria.department
    
    // すべての条件に一致するメンバーを返す
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

    // 改行を含むメッセージを処理
    const formattedMessage = message.text.split('\n').map((line, index) => (
      <React.Fragment key={index}>
        {line}
        {index < message.text.split('\n').length - 1 && <br />}
      </React.Fragment>
    ));

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
                <div className="flex items-start gap-2">
                  <div className="mt-1">
                    {icons[message.type]}
                  </div>
                  <span className="text-sm font-medium whitespace-pre-line">{formattedMessage}</span>
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
              <span className="text-sm font-medium whitespace-pre-line">{formattedMessage}</span>
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

      // 社員番号の昇順でソート
      const sortedUsers = formattedUsers.sort((a, b) => 
        a.employee_id.localeCompare(b.employee_id)
      );

      setMembers(sortedUsers || [])
      setOriginalMembers(sortedUsers || [])
      
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
                          <TableHead className="w-[10%]">担当リーダー</TableHead>
                          <TableHead className="w-[10%]">担当サブリーダー</TableHead>
                          <TableHead className="w-[6%]">{t("leader-permission")}</TableHead>
                          <TableHead className="w-[6%]">{t("admin-permission")}</TableHead>
                          <TableHead className="w-[9%]">ステータス</TableHead>
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