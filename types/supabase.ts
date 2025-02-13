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
      branch_master: {
        Row: {
          code: string
          name_jp: string
          name_en: string
          created_at: string | null
          updated_at: string | null
          created_by: string | null
          updated_by: string | null
        }
      }
      users: {
        Row: {
          id: string
          auth_id: string
          employee_id: string
          email: string
          last_name: string
          first_name: string
          last_name_en: string | null
          first_name_en: string | null
          branch: string
          avatar_url: string | null
          is_active: boolean
          theme: string
          language: string
          registration_status: string | null
          created_at: string
          updated_at: string
          created_by: string | null
          updated_by: string | null
        }
      }
      user_supervisors: {
        Row: {
          user_id: string
          supervisor_type: string
          pic_user_id: string | null
          created_at: string
          updated_at: string
          created_by: string | null
          updated_by: string | null
        }
      }
      user_roles: {
        Row: {
          user_id: string
          user_role_id: string
          created_at: string
          updated_at: string
          created_by: string | null
          updated_by: string | null
        }
      }
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