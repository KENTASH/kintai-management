import { createClient } from '@supabase/supabase-js';

export type Database = {
  public: {
    Tables: {
      attendance_headers: {
        Row: {
          id: string;
          user_id: string;
          year: number;
          month: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          year: number;
          month: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          year?: number;
          month?: number;
          updated_at?: string;
        };
      };
      expense_headers: {
        Row: {
          id: string;
          attendance_header_id: string | null;
          created_at: string;
          updated_at: string;
          created_by: string;
          updated_by: string;
        };
        Insert: {
          id?: string;
          attendance_header_id?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by: string;
          updated_by: string;
        };
        Update: {
          id?: string;
          attendance_header_id?: string | null;
          updated_at?: string;
          updated_by?: string;
        };
      };
      expense_details: {
        Row: {
          id: string;
          header_id: string;
          category: 'commute' | 'business';
          date: string;
          transportation: string;
          from_location: string;
          to_location: string;
          expense_type: string;
          round_trip_type: string;
          amount: number;
          remarks: string | null;
          created_at: string;
          updated_at: string;
          created_by: string;
          updated_by: string;
        };
        Insert: {
          id?: string;
          header_id: string;
          category: 'commute' | 'business';
          date: string;
          transportation: string;
          from_location: string;
          to_location: string;
          expense_type: string;
          round_trip_type: string;
          amount: number;
          remarks?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by: string;
          updated_by: string;
        };
        Update: {
          id?: string;
          header_id?: string;
          category?: 'commute' | 'business';
          date?: string;
          transportation?: string;
          from_location?: string;
          to_location?: string;
          expense_type?: string;
          round_trip_type?: string;
          amount?: number;
          remarks?: string | null;
          updated_at?: string;
          updated_by?: string;
        };
      };
      expense_receipts: {
        Row: {
          id: string;
          header_id: string;
          file_name: string;
          file_path: string;
          remarks: string | null;
          uploaded_at: string;
          created_at: string;
          updated_at: string;
          created_by: string;
          updated_by: string;
        };
        Insert: {
          id?: string;
          header_id: string;
          file_name: string;
          file_path: string;
          remarks?: string | null;
          uploaded_at?: string;
          created_at?: string;
          updated_at?: string;
          created_by: string;
          updated_by: string;
        };
        Update: {
          id?: string;
          header_id?: string;
          file_name?: string;
          file_path?: string;
          remarks?: string | null;
          uploaded_at?: string;
          updated_at?: string;
          updated_by?: string;
        };
      };
    };
  };
  storage: {
    Buckets: {
      'expense-evidences': {
        Row: {
          id: string;
          name: string;
        };
      };
    };
  };
};

// Supabaseクライアントの初期化
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// ストレージ関連のヘルパー関数
export const uploadFile = async (
  file: File,
  userId: string,
  year: string,
  month: string
) => {
  try {
    // ファイル名の衝突を避けるためにタイムスタンプを追加
    const timestamp = Date.now();
    const filePath = `${userId}/${year}/${month}/${timestamp}_${file.name}`;
    
    const { data, error } = await supabase.storage
      .from('expense-evidences')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });
    
    if (error) throw error;
    
    // ファイルの公開URLを取得
    const { data: urlData } = supabase.storage
      .from('expense-evidences')
      .getPublicUrl(filePath);
    
    return {
      path: filePath,
      url: urlData.publicUrl,
      fileName: file.name
    };
  } catch (error) {
    console.error('ファイルアップロードエラー:', error);
    throw error;
  }
};

export const deleteFile = async (filePath: string) => {
  try {
    const { error } = await supabase.storage
      .from('expense-evidences')
      .remove([filePath]);
    
    if (error) throw error;
    
    return { success: true };
  } catch (error) {
    console.error('ファイル削除エラー:', error);
    throw error;
  }
}; 