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
    const employee_id = searchParams.get('employee_id')
    const today = format(new Date(), 'yyyy-MM-dd')

    console.log('GETリクエスト受信:', { employee_id, today })

    if (!employee_id) {
      return NextResponse.json(
        { error: '従業員IDは必須です' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('daily_attendances')
      .select('*')
      .eq('employee_id', employee_id)
      .eq('work_date', today)
      .single()

    console.log('Supabaseクエリ結果:', { data, error })

    if (error) {
      if (error.code === 'PGRST116') {
        // レコードが見つからない場合はnullを返す
        return NextResponse.json(null)
      }
      console.error('Supabaseエラー:', error)
      return NextResponse.json(
        { error: `勤怠データの取得に失敗しました: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json(data || null)
  } catch (error) {
    console.error('予期せぬエラー:', error)
    return NextResponse.json(
      { error: `予期せぬエラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}` },
      { status: 500 }
    )
  }
}

// 今日の勤怠データを登録
export async function POST(request: Request) {
  try {
    const body = await request.json()
    console.log('リクエストボディ:', body)
    const { branch, employee_id } = body
    const now = new Date()
    const today = format(now, 'yyyy-MM-dd')
    const currentTime = format(now, 'HH:mm')

    // 必須パラメータの検証
    if (!branch) {
      return NextResponse.json(
        { error: '支店コードは必須です' },
        { status: 400 }
      )
    }

    if (!employee_id) {
      return NextResponse.json(
        { error: '従業員IDは必須です' },
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

    console.log('既存データ確認結果:', { existingData, existingError })

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
        console.log('既に出勤済み:', existingData)
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
        created_at: now,
        updated_at: now
      })
      .select()
      .single()

    console.log('データ登録結果:', { data, error })

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
      { error: `予期せぬエラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}` },
      { status: 500 }
    )
  }
} 