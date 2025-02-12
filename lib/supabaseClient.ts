import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from '@/types/supabase'

// クライアントコンポーネント専用のクライアント
export const createClient = () => {
  return createClientComponentClient<Database>({
    options: {
      auth: {
        storage: window?.sessionStorage,  // localStorage から sessionStorage に変更
        persistSession: true,
        autoRefreshToken: true,
      },
      global: {
        headers: {
          'Accept': 'application/json',
        },
      },
    },
  })
} 