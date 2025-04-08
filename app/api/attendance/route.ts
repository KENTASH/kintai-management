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

// CORSヘッダーの設定
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

// 出退勤の記録を取得
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const branch = searchParams.get('branch')
    const employee_id = searchParams.get('employee_id')
    const work_date = searchParams.get('work_date')

    // バリデーション
    if (!branch || !employee_id || !work_date) {
      return NextResponse.json(
        { error: '支店コード、社員番号、日付は必須です' },
        { status: 400 }
      )
    }

    // 出退勤データの取得
    const { data, error } = await supabase
      .from('daily_attendances')
      .select('*')
      .eq('branch', branch)
      .eq('employee_id', employee_id)
      .eq('work_date', work_date)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Supabaseエラー:', error)
      return NextResponse.json(
        { error: '出退勤データの取得に失敗しました' },
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

// 出退勤の記録を登録・更新
export async function POST(request: Request) {
  try {
    const {
      branch,
      employee_id,
      work_date,
      check_in,
      check_out,
      working_hours,
      overtime_hours,
      created_by,
      updated_by
    } = await request.json()

    // バリデーション
    if (!branch || !employee_id || !work_date) {
      return NextResponse.json(
        { error: '支店コード、社員番号、日付は必須です' },
        { status: 400 }
      )
    }

    // 既存の記録を確認
    const { data: existingRecord } = await supabase
      .from('daily_attendances')
      .select('*')
      .eq('branch', branch)
      .eq('employee_id', employee_id)
      .eq('work_date', work_date)
      .single()

    let result
    if (existingRecord) {
      // 既存の記録を更新
      result = await supabase
        .from('daily_attendances')
        .update({
          check_in: check_in || existingRecord.check_in,
          check_out: check_out || existingRecord.check_out,
          working_hours: working_hours || existingRecord.working_hours,
          overtime_hours: overtime_hours || existingRecord.overtime_hours,
          updated_by
        })
        .eq('id', existingRecord.id)
        .select()
        .single()
    } else {
      // 新規記録を作成
      result = await supabase
        .from('daily_attendances')
        .insert({
          branch,
          employee_id,
          work_date,
          check_in,
          check_out,
          working_hours,
          overtime_hours,
          created_by,
          updated_by
        })
        .select()
        .single()
    }

    if (result.error) {
      console.error('Supabaseエラー:', result.error)
      return NextResponse.json(
        { error: '出退勤データの保存に失敗しました' },
        { status: 500 }
      )
    }

    return NextResponse.json(result.data)
  } catch (error) {
    console.error('予期せぬエラー:', error)
    return NextResponse.json(
      { error: '予期せぬエラーが発生しました' },
      { status: 500 }
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