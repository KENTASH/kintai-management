export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          auth_id: string
          employee_id: string
          email: string
          last_name: string
          first_name: string
          last_name_en: string
          first_name_en: string
          branch: string
          avatar_url: string | null
          registration_status: string
          is_active: boolean
          language: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
          branch_master?: {
            name_jp: string
            name_en: string
          } | null
        }
        Insert: {
          id?: string
          auth_id: string
          employee_id: string
          email: string
          last_name: string
          first_name: string
          last_name_en: string
          first_name_en: string
          branch: string
          avatar_url?: string | null
          registration_status?: string
          is_active?: boolean
          language?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          auth_id?: string
          employee_id?: string
          email?: string
          last_name?: string
          first_name?: string
          last_name_en?: string
          first_name_en?: string
          branch?: string
          avatar_url?: string | null
          registration_status?: string
          is_active?: boolean
          language?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
      }
      branch_master: {
        Row: {
          code: string
          name_jp: string
          name_en: string
          is_active: boolean
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          code: string
          name_jp: string
          name_en: string
          is_active: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          code?: string
          name_jp?: string
          name_en?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
      }
      // 他のテーブルの型定義もここに追加
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
} 