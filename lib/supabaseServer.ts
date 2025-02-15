import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/supabase'

export const supabase = createServerClient<Database>(
	process.env.NEXT_PUBLIC_SUPABASE_URL!,
	process.env.SUPABASE_SERVICE_ROLE_KEY!,
	{
		cookies: {
			get(name: string) {
				return cookies().get(name)?.value || null
			},
			set(name: string, value: string, options: CookieOptions) {
				cookies().set({ name, value, ...options })
			},
			remove(name: string, options: CookieOptions) {
				cookies().set({ name, value: '', ...options, expires: new Date(0) })
			}
		}
	}
)