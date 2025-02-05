import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // ルートパス（ログイン画面）へのアクセスはそのまま通す
  if (request.nextUrl.pathname === '/') {
    // すでに認証済みの場合はダッシュボードへリダイレクト
    const isAuthenticated = request.cookies.get('auth')
    if (isAuthenticated) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return NextResponse.next()
  }

  // 認証済みかどうかの判定
  const isAuthenticated = request.cookies.get('auth')

  // 認証されていない場合は、ログインページにリダイレクト
  if (!isAuthenticated) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
} 