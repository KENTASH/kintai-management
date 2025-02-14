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
      attendance_records: {
        Row: {
          id: string
          user_id: string
          date: string
          start_time: string | null
          end_time: string | null
          break_time: string | null
          type: string | null
          remarks: string | null
          late_early_hours: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          start_time?: string | null
          end_time?: string | null
          break_time?: string | null
          type?: string | null
          remarks?: string | null
          late_early_hours?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          start_time?: string | null
          end_time?: string | null
          break_time?: string | null
          type?: string | null
          remarks?: string | null
          late_early_hours?: number | null
          created_at?: string
          updated_at?: string
        }
      }
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
        Insert: {
          id?: string
          auth_id: string
          employee_id: string
          email: string
          last_name: string
          first_name: string
          last_name_en?: string | null
          first_name_en?: string | null
          branch: string
          avatar_url?: string | null
          is_active?: boolean
          theme?: string
          language?: string
          registration_status?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          auth_id?: string
          employee_id?: string
          email?: string
          last_name?: string
          first_name?: string
          last_name_en?: string | null
          first_name_en?: string | null
          branch?: string
          avatar_url?: string | null
          is_active?: boolean
          theme?: string
          language?: string
          registration_status?: '01' | '02' | '03' | '99' | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
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

export interface SupervisorInfo {
  leader: string | null;
  subleader: string | null;
  supervisor_type?: '01' | '02' | null; // オプショナルに変更
}

export interface Member {
  id: string;
  employee_id: string;
  email: string;
  last_name: string;
  first_name: string;
  last_name_en: string | null;
  first_name_en: string | null;
  branch: string;
  branch_name: string;
  is_active: boolean;
  registration_status: string;  // null を削除
  supervisor_info: SupervisorInfo;
  [key: string]: any;
} 