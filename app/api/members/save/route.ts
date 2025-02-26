import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { Member } from '@/types/member'

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

// CORSヘッダーの設定
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function POST(req: Request) {
  try {
    const { changedMembers, newMembers } = await req.json()

    // リクエストデータのログ
    console.log('Request data:', { changedMembers, newMembers })

    // データの検証
    if (!Array.isArray(changedMembers) && !Array.isArray(newMembers)) {
      console.error('Invalid data format:', { changedMembers, newMembers })
      return new NextResponse(
        JSON.stringify({ 
          error: '無効なデータ形式です。',
          details: 'changedMembersとnewMembersは配列である必要があります。'
        }),
        { 
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      )
    }

    // 更新処理の実行
    const { data, error } = await supabase.rpc('manage_members_transaction', {
      changed_members: changedMembers,
      new_members: newMembers
    })

    if (error) {
      console.error('Transaction error:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      })
      return new NextResponse(
        JSON.stringify({ 
          error: 'データの保存に失敗しました。',
          details: error.message,
          hint: error.hint,
          code: error.code,
          data: {
            changedMembers,
            newMembers
          }
        }),
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      )
    }

    console.log('Transaction success:', data)
    return new NextResponse(
      JSON.stringify({ 
        success: true,
        data,
        message: 'メンバー情報が正常に更新されました。'
      }),
      { 
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    )

  } catch (error) {
    console.error('API error:', {
      error,
      message: error instanceof Error ? error.message : '不明なエラー',
      stack: error instanceof Error ? error.stack : undefined
    })
    return new NextResponse(
      JSON.stringify({ 
        error: 'サーバーエラーが発生しました。',
        details: error instanceof Error ? error.message : '不明なエラー'
      }),
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    )
  }
}

// OPTIONSリクエストのハンドラー
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders
  })
} 