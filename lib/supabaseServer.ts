import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/supabase'

export const supabase = createServerClient<Database>(
	process.env.NEXT_PUBLIC_SUPABASE_URL!,
	process.env.SUPABASE_SERVICE_ROLE_KEY!,
	{
		cookies: {
			get: async (name: string) => {
				const cookieStore = await cookies()
				return cookieStore.get(name)?.value || null
			},
			set: async (name: string, value: string, options?: CookieOptions) => {
				const cookieStore = await cookies()
				cookieStore.set({ 
					name, 
					value, 
					...options 
				})
			},
			remove: async (name: string, options?: CookieOptions) => {
				const cookieStore = await cookies()
				cookieStore.set({ 
					name, 
					value: '', 
					...options, 
					expires: new Date(0) 
				})
			}
		}
	}
)