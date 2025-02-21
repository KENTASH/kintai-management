import { createClient as createClientOriginal } from '@supabase/supabase-js'
import { Database } from '@/types/supabase'

let supabaseInstance: ReturnType<typeof createClientOriginal<Database>> | null = null

export const createClient = () => {
  if (supabaseInstance) return supabaseInstance

  supabaseInstance = createClientOriginal<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true
      }
    }
  )

  return supabaseInstance
}

export const supabase = createClient()