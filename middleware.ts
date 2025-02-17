import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 認証が不要なルートのリスト
  const publicRoutes = ["/auth/login", "/auth/set-password"];

  // Cookie から `sb-access-token` を取得
  const cookies = request.headers.get("cookie") || "";
  const accessToken = cookies.split("; ").find(row => row.startsWith("sb-access-token="))?.split("=")[1];

  console.log("🔍 Middleware 認証チェック:", accessToken ? "トークンあり" : "なし");

  if (!accessToken && !publicRoutes.includes(pathname)) {
    console.log("🔐 未認証のため /auth/login にリダイレクト");
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/settings/:path*", "/members/:path*", "/approve-attendance/:path*", "/overtime/:path*"]
};
