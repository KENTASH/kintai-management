import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req: request, res })
  
  try {
    // セッションの取得と有効性チェック
    const {
      data: { session },
      error
    } = await supabase.auth.getSession()

    // セッションエラーまたは無効な場合
    if (error || !session?.user || !session?.expires_at) {
      // 認証関連のストレージをクリア
      res.cookies.delete('sb-access-token')
      res.cookies.delete('sb-refresh-token')

      // 現在のパスが認証画面でない場合はログイン画面へリダイレクト
      const isAuthPath = ['/', '/auth/callback', '/auth/set-password'].includes(request.nextUrl.pathname)
      if (!isAuthPath) {
        return NextResponse.redirect(new URL('/', request.url))
      }
      return res
    }

    // セッションの有効期限をチェック
    const expiresAt = new Date(session.expires_at * 1000)
    if (expiresAt < new Date()) {
      // セッションが期限切れの場合、ストレージをクリアしてログイン画面へ
      res.cookies.delete('sb-access-token')
      res.cookies.delete('sb-refresh-token')
      return NextResponse.redirect(new URL('/', request.url))
    }

    // 以下、既存の認証済みユーザーの処理
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('registration_status')
      .eq('auth_id', session.user.id)
      .maybeSingle()

    if (userError) {
      console.error('Error fetching user data:', userError)
      throw userError
    }

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
    // エラーが発生した場合は安全のためログイン画面へ
    return NextResponse.redirect(new URL('/', request.url))
  }
}

// ミドルウェアを適用するパスを指定
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
} 