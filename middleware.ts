import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 認証が不要なパブリックルート
  const publicRoutes = ["/auth/login", "/auth/set-password"];
  
  // 静的アセットは除外
  if (
    pathname.startsWith("/_next") || 
    pathname.startsWith("/static") ||
    pathname.startsWith("/api")
  ) {
    return NextResponse.next();
  }

  // Supabase のセッション情報をクッキーから取得
  const token = request.cookies.get("sb-access-token");

  console.log("🔍 Middleware 認証チェック - パス:", pathname);

  // パブリックルート以外のすべてのルートで認証を要求
  if (!publicRoutes.includes(pathname)) {
    if (!token) {
      console.log("🔐 未認証のため /auth/login にリダイレクト");
      return NextResponse.redirect(new URL("/auth/login", request.url));
    }
  } else if (pathname === "/auth/login" && token) {
    // ログイン済みユーザーがログインページにアクセスした場合はダッシュボードへ
    console.log("👤 認証済みユーザーをダッシュボードへリダイレクト");
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

// すべてのルートに対してミドルウェアを適用（除外設定も含む）
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * 1. /_next/static (static files)
     * 2. /_next/image (image optimization files)
     * 3. /favicon.ico (favicon file)
     * 4. /public files
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
