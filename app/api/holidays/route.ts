import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Supabaseクライアントの初期化（サービスロールキーを使用）
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
)

export async function POST(request: Request) {
  try {
    const { year, date, remarks } = await request.json()

    // バリデーション - yearとdateのみ必須
    if (!year || !date) {
      return NextResponse.json(
        { error: '年と日付は必須項目です' },
        { status: 400 }
      )
    }

    // 休日データの登録
    const { data, error } = await supabase
      .from('holiday_master')
      .insert([
        {
          year: parseInt(year),
          date,
          remarks: remarks || '' // 空の場合は空文字として保存
        }
      ])
      .select()
      .single()

    if (error) {
      console.error('Supabaseエラー:', error)
      if (error.code === '23505') {
        return NextResponse.json(
          { error: '同一日付を重複して登録することはできません。' },
          { status: 409 }
        )
      }
      return NextResponse.json(
        { error: '休日データの登録に失敗しました' },
        { status: 500 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('予期せぬエラー:', error)
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました' },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year')

    if (!year) {
      return NextResponse.json(
        { error: '年の指定が必要です' },
        { status: 400 }
      )
    }

    // 休日データの取得
    const { data, error } = await supabase
      .from('holiday_master')
      .select('*')
      .eq('year', parseInt(year))
      .order('date', { ascending: true })

    if (error) {
      console.error('Supabaseエラー:', error)
      return NextResponse.json(
        { error: '休日データの取得に失敗しました' },
        { status: 500 }
      )
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('予期せぬエラー:', error)
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'IDが必要です' },
        { status: 400 }
      )
    }

    // 休日データの削除
    const { error } = await supabase
      .from('holiday_master')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Supabaseエラー:', error)
      return NextResponse.json(
        { error: '休日データの削除に失敗しました' },
        { status: 500 }
      )
    }

    return NextResponse.json({ message: '削除が完了しました' })
  } catch (error) {
    console.error('予期せぬエラー:', error)
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました' },
      { status: 500 }
    )
  }
} 