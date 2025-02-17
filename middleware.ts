import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 認証が不要なルート
  const publicRoutes = ["/auth/login", "/auth/set-password"];

  // Supabase のセッション情報をクッキーから取得
  const token = request.cookies.get("sb-access-token");

  console.log("🔍 Middleware 認証チェック:", token);

  if (!token && !publicRoutes.includes(pathname)) {
    console.log("🔐 未認証のため /auth/login にリダイレクト");
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  return NextResponse.next();
}

// middleware の適用対象を設定
export const config = {
  matcher: ["/dashboard/:path*", "/settings/:path*", "/members/:path*", "/approve-attendance/:path*", "/overtime/:path*"]
};
