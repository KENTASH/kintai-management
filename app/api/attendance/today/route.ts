import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { format } from 'date-fns'

// Supabaseクライアントの初期化
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

// 今日の勤怠データを取得
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const today = format(new Date(), 'yyyy-MM-dd')

    if (!userId) {
      return NextResponse.json(
        { error: 'ユーザーIDは必須です' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('daily_attendances')
      .select('*')
      .eq('employee_id', userId)
      .eq('work_date', today)
      .single()

    if (error) {
      console.error('Supabaseエラー:', error)
      return NextResponse.json(
        { error: '勤怠データの取得に失敗しました' },
        { status: 500 }
      )
    }

    return NextResponse.json(data || null)
  } catch (error) {
    console.error('予期せぬエラー:', error)
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました' },
      { status: 500 }
    )
  }
}

// 今日の勤怠データを登録
export async function POST(request: Request) {
  try {
    const { userId, branch, employee_id } = await request.json()
    const now = new Date()
    const today = format(now, 'yyyy-MM-dd')
    const currentTime = format(now, 'HH:mm')

    if (!userId || !branch || !employee_id) {
      return NextResponse.json(
        { error: '必須パラメータが不足しています' },
        { status: 400 }
      )
    }

    // 既存の勤怠データを確認
    const { data: existingData, error: existingError } = await supabase
      .from('daily_attendances')
      .select('*')
      .eq('employee_id', employee_id)
      .eq('work_date', today)
      .single()

    if (existingError && existingError.code !== 'PGRST116') {
      console.error('既存データ確認エラー:', existingError)
      return NextResponse.json(
        { error: '勤怠データの確認に失敗しました' },
        { status: 500 }
      )
    }

    if (existingData) {
      // 既に出勤済みの場合はエラー
      if (existingData.check_in) {
        return NextResponse.json(
          { error: '本日は既に出勤済みです' },
          { status: 400 }
        )
      }
    }

    // 新規データを登録
    const { data, error } = await supabase
      .from('daily_attendances')
      .upsert({
        branch,
        employee_id,
        work_date: today,
        check_in: currentTime,
        created_by: userId,
        updated_by: userId
      })
      .select()
      .single()

    if (error) {
      console.error('Supabaseエラー:', error)
      return NextResponse.json(
        { error: '勤怠データの登録に失敗しました' },
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