"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { Session } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabaseClient"

// ユーザープロフィール型を定義
interface UserProfile {
  id: string
  auth_id: string
  employee_id: string
  email: string
  last_name: string
  first_name: string
  last_name_en: string | null
  first_name_en: string | null
  branch: string
  branch_name: string
  branch_name_jp: string
  branch_name_en: string
  is_active: boolean
  avatar_url: string | null
  roles: {
    is_leader: boolean
    is_admin: boolean
  }
}

// ユーザーロールの型を定義
interface UserRole {
  user_role_id: string;
}

// ユーザーデータの型を定義
interface UserData {
  id: string;
  auth_id: string;
  employee_id: string;
  email: string;
  last_name: string;
  first_name: string;
  last_name_en: string | null;
  first_name_en: string | null;
  branch: string;
  branch_master: Array<{
    name_jp: string;
    name_en: string;
  }>;
  is_active: boolean;
  user_roles: UserRole[];
}

interface AuthContextType {
  session: Session | null
  loading: boolean
  userProfile: UserProfile | null
  setUserProfile: (profile: UserProfile | null) => void
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  loading: true,
  userProfile: null,
  setUserProfile: () => {}
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)

  // ユーザープロフィールを取得する関数
  const fetchUserProfile = async (userId: string) => {
    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select(`
          *,
          user_roles (
            user_role_id
          )
        `)
        .eq('auth_id', userId)
        .single()

      if (userError) throw userError

      // 支店情報を取得
      const { data: branchData, error: branchError } = await supabase
        .from('branch_master')
        .select('code, name_jp, name_en')
        .eq('code', userData.branch)
        .single()

      if (branchError) throw branchError

      const profile: UserProfile = {
        id: userData.id,
        auth_id: userData.auth_id,
        employee_id: userData.employee_id,
        email: userData.email,
        last_name: userData.last_name,
        first_name: userData.first_name,
        last_name_en: userData.last_name_en,
        first_name_en: userData.first_name_en,
        branch: branchData.code,
        branch_name: branchData.name_jp,
        branch_name_jp: branchData.name_jp,
        branch_name_en: branchData.name_en,
        is_active: userData.is_active,
        avatar_url: userData.avatar_url,
        roles: {
          is_leader: userData.user_roles?.some((role: UserRole) => role.user_role_id === 'leader') || false,
          is_admin: userData.user_roles?.some((role: UserRole) => role.user_role_id === 'admin') || false,
        }
      }

      // セッションストレージに保存
      sessionStorage.setItem('userProfile', JSON.stringify(profile))
      setUserProfile(profile)
    } catch (error) {
      console.error('Error fetching user profile:', error)
    }
  }

  useEffect(() => {
    // 初期セッションチェック
    const initializeAuth = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession()
        setSession(initialSession)
        
        if (initialSession?.user?.id) {
          await fetchUserProfile(initialSession.user.id)
        }
      } catch (error) {
        console.error('Error initializing auth:', error)
      } finally {
        setLoading(false)
      }
    }

    initializeAuth()

    // 認証状態の変更を監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      console.log('Auth state changed:', _event, newSession)
      setSession(newSession)

      if (newSession?.user?.id) {
        await fetchUserProfile(newSession.user.id)
      } else {
        setUserProfile(null)
        sessionStorage.removeItem('userProfile')
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, []) // 依存配列は空のまま

  return (
    <AuthContext.Provider value={{ session, loading, userProfile, setUserProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
} 