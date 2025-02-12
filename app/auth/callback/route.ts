import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    const supabase = createRouteHandlerClient({ cookies })
    
    // セッションの交換と設定
    const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (error) {
      return NextResponse.redirect(new URL(`/?error=${error.message}`, requestUrl.origin))
    }

    if (session) {
      const { data: profile } = await supabase
        .from('users')
        .select('registration_status')
        .eq('auth_id', session.user.id)
        .single()

      if (profile?.registration_status === '01') {
        return NextResponse.redirect(new URL('/set-password', requestUrl.origin))
      }

      return NextResponse.redirect(new URL('/dashboard', requestUrl.origin))
    }
  }

  return NextResponse.redirect(new URL('/', requestUrl.origin))
} 