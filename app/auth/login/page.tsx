"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/context";
import { LogIn, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/components/ui/use-toast";
import type { ChangeEvent, FormEvent } from "react";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log("🚀 ログインページがマウントされました");
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      console.log("🛠 認証処理開始...");
      const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        throw signInError;
      }

      console.log("✅ 認証成功、ユーザー情報を取得します");

      // 1. まずユーザー情報を取得
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select(`
          id,
          employee_id,
          last_name,
          first_name,
          last_name_en,
          first_name_en,
          email,
          branch,
          is_active,
          user_roles (
            user_role_id
          )
        `)
        .eq('auth_id', authData.user?.id)
        .single();

      if (userError) {
        console.error("❌ ユーザー情報の取得に失敗:", userError);
        throw new Error("ユーザー情報の取得に失敗しました");
      }

      console.log("✅ ユーザー情報取得成功:", userData);

      // 2. 支店情報を取得
      const { data: branchData, error: branchError } = await supabase
        .from('branch_master')
        .select('code, name_jp, name_en')
        .eq('code', userData.branch)
        .single();

      if (branchError) {
        console.error("❌ 支店情報の取得に失敗:", branchError);
        throw new Error("支店情報の取得に失敗しました");
      }

      console.log("✅ 支店情報取得成功:", branchData);

      // 3. セッションの更新
      const { data: sessionData, error: sessionError } = await supabase.auth.refreshSession();
      if (sessionError) {
        throw sessionError;
      }

      if (!sessionData.session) {
        throw new Error("セッションの取得に失敗しました");
      }

      // 4. ユーザープロファイルを作成
      const userProfile = {
        id: userData.id,
        employee_id: userData.employee_id,
        last_name: userData.last_name,
        first_name: userData.first_name,
        last_name_en: userData.last_name_en,
        first_name_en: userData.first_name_en,
        branch_code: branchData.code,
        branch_name_jp: branchData.name_jp,
        branch_name_en: branchData.name_en,
        avatar_url: null,
        roles: {
          is_leader: userData.user_roles?.some(role => role.user_role_id === 'leader') || false,
          is_admin: userData.user_roles?.some(role => role.user_role_id === 'admin') || false
        }
      };

      // 5. セッションストレージに保存
      sessionStorage.setItem('userProfile', JSON.stringify(userProfile));
      console.log("✅ ユーザー情報をセッションストレージに保存:", userProfile);

      // 6. Cookieにトークンを保存
      document.cookie = `sb-access-token=${sessionData.session.access_token}; path=/; max-age=3600; SameSite=Lax`;

      toast({
        title: "ログイン成功",
        description: "ダッシュボードに移動します",
      });

      // 7. 少し待機してからリダイレクト
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log("🚀 ダッシュボードへリダイレクト開始");
      window.location.href = "/dashboard";

    } catch (error) {
      console.error("❌ Login error:", error);
      setError("メールアドレスかパスワードが間違っています。");
      toast({
        title: "エラー",
        description: "ログインに失敗しました",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("🔄 Auth state changed:", event, session);
      // onAuthStateChangeでのリダイレクトは削除（handleSubmitで処理）
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8F9FE]">
      <div className="flex items-center gap-1 mb-8">
        <Image
          src="/logo.png"
          alt=""
          width={22}
          height={22}
          className="object-contain"
          priority
        />
        <span className="text-[#2c4187] text-[19px] font-bold">勤怠管理システム</span>
      </div>
      <Card className="w-[400px] rounded-lg shadow-[0_4px_14px_rgba(0,0,0,0.1)]">
        <CardHeader className="bg-gradient-to-b from-[#EEF2FF] to-[#F8FAFF] rounded-t-lg border-b pb-4">
          <CardTitle className="text-lg font-medium text-[#2c4187]">ログイン</CardTitle>
          <CardDescription className="text-sm text-[#666666] mt-1">
            メールアドレスとパスワードを入力してログインしてください。
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 bg-white rounded-b-lg">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <div className="text-sm font-medium text-[#1a1a1a] mb-1">メールアドレス</div>
              <Input 
                type="email" 
                placeholder={t("email-placeholder")} 
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-md border-[#e5e7eb] focus:border-blue-500 focus:ring-blue-500 placeholder:text-[#9ca3af]"
                autoComplete="username"
              />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium text-[#1a1a1a] mb-1">パスワード</div>
              <div className="relative">
                <Input 
                  type={showPassword ? "text" : "password"} 
                  placeholder={t("password-placeholder")} 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)}
                  className="rounded-md border-[#e5e7eb] focus:border-blue-500 focus:ring-blue-500 placeholder:text-[#9ca3af]" 
                  autoComplete="current-password"
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)} 
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#666666]"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {error && <div className="text-sm text-red-500">{error}</div>}
            <Button 
              type="submit" 
              className="w-full bg-[#2563eb] hover:bg-[#1d4ed8] rounded-md py-2.5 text-[15px] font-medium" 
              disabled={isLoading}
            >
              {isLoading ? "ログイン中..." : "ログイン"}
            </Button>
          </form>
        </CardContent>
      </Card>
      <div className="mt-8 text-sm text-[#666666]">
        © NISZ HAMAMATSU 2025
      </div>
    </div>
  );
}
