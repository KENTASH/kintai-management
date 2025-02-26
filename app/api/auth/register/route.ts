import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { 
      email,
      employee_id,
      last_name,
      first_name,
      last_name_en,
      first_name_en,
      branch,
      created_by,
      updated_by
    } = body

    // トランザクション開始
    const { error: beginError } = await supabase.rpc('begin_transaction')
    if (beginError) {
      console.error('Transaction begin error:', beginError)
      return NextResponse.json(
        { error: 'トランザクションの開始に失敗しました。システム管理者に連絡してください。' },
        { status: 500 }
      )
    }

    try {
      // 1. auth.usersテーブルへの登録
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: email,
        email_confirm: false,
        app_metadata: { role: 'user' },
        user_metadata: { registration_status: 'pending' }
      })

      if (authError) {
        console.error('Auth user creation error:', authError)
        throw new Error('認証ユーザーの作成に失敗しました。メールアドレスが既に使用されているか、無効な形式です。')
      }

      // 2. public.usersテーブルへの登録
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert({
          employee_id,
          last_name,
          first_name,
          last_name_en,
          first_name_en,
          email,
          branch,
          registration_status: '01',
          is_active: true,
          auth_id: authUser.user.id,
          created_by,
          updated_by
        })
        .select()
        .single()

      if (insertError) {
        console.error('User data insertion error:', insertError)
        throw new Error('ユーザー情報の登録に失敗しました。社員番号が重複しているか、必須項目が不足しています。')
      }

      // トランザクションのコミット
      const { error: commitError } = await supabase.rpc('commit_transaction')
      if (commitError) {
        console.error('Transaction commit error:', commitError)
        throw new Error('トランザクションのコミットに失敗しました。システム管理者に連絡してください。')
      }

      return NextResponse.json({ 
        user: authUser.user,
        dbUser: newUser
      })

    } catch (error) {
      // エラー発生時はロールバック
      const { error: rollbackError } = await supabase.rpc('rollback_transaction')
      if (rollbackError) {
        console.error('Rollback error:', rollbackError)
        return NextResponse.json(
          { error: 'トランザクションのロールバックに失敗しました。データの整合性が損なわれている可能性があります。システム管理者に連絡してください。' },
          { status: 500 }
        )
      }
      
      // エラーメッセージを返す
      return NextResponse.json(
        { error: error instanceof Error ? error.message : '予期せぬエラーが発生しました。システム管理者に連絡してください。' },
        { status: 400 }
      )
    }

  } catch (error) {
    console.error('Server error:', error)
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました。システム管理者に連絡してください。' },
      { status: 500 }
    )
  }
} 