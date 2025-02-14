import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const res = NextResponse.next()
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          res.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          res.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  try {
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      const isAuthPath = ['/', '/auth/callback', '/auth/set-password'].includes(request.nextUrl.pathname)
      if (!isAuthPath) {
        return NextResponse.redirect(new URL('/', request.url))
      }
      return res
    }

    // 以下、既存の認証済みユーザーの処理
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('registration_status')
      .eq('auth_id', session.user.id)
      .maybeSingle()

    if (userError) throw userError

    // 初回パスワード設定が必要な場合
    if (userData?.registration_status === '01' && 
        request.nextUrl.pathname !== '/auth/set-password') {
      return NextResponse.redirect(new URL('/auth/set-password', request.url))
    }

    // ログイン済みユーザーがログインページにアクセスした場合
    if (request.nextUrl.pathname === '/') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    return res
  } catch (error) {
    console.error('Middleware error:', error)
    return NextResponse.redirect(new URL('/', request.url))
  }
}

// ミドルウェアを適用するパスを指定
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
} 