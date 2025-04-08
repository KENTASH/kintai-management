import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { format } from 'date-fns'

// Supabaseクライアントの初期化
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

export async function POST(request: Request) {
  try {
    const { userId, branch, employee_id } = await request.json()

    // バリデーション
    if (!userId || !branch || !employee_id) {
      return NextResponse.json(
        { error: '必要なパラメータが不足しています' },
        { status: 400 }
      )
    }

    const now = new Date()
    const today = format(now, 'yyyy-MM-dd')
    const currentTime = format(now, 'HH:mm:ss')

    // 既存の出勤記録を確認
    const { data: existingRecord, error: fetchError } = await supabase
      .from('daily_attendances')
      .select('*')
      .eq('branch', branch)
      .eq('employee_id', employee_id)
      .eq('work_date', today)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('出勤記録の確認中にエラーが発生しました:', fetchError)
      return NextResponse.json(
        { error: '出勤記録の確認中にエラーが発生しました' },
        { status: 500 }
      )
    }

    let result

    if (existingRecord) {
      // 既存の記録を更新
      const { data, error: updateError } = await supabase
        .from('daily_attendances')
        .update({
          check_in: currentTime,
          updated_at: now.toISOString(),
          updated_by: userId
        })
        .eq('id', existingRecord.id)
        .select()
        .single()

      if (updateError) {
        console.error('出勤時刻の更新に失敗しました:', updateError)
        return NextResponse.json(
          { error: '出勤時刻の更新に失敗しました' },
          { status: 500 }
        )
      }

      result = data
    } else {
      // 新規記録を作成
      const { data, error: insertError } = await supabase
        .from('daily_attendances')
        .insert({
          branch,
          employee_id,
          work_date: today,
          check_in: currentTime,
          created_by: userId,
          updated_by: userId
        })
        .select()
        .single()

      if (insertError) {
        console.error('出勤記録の作成に失敗しました:', insertError)
        return NextResponse.json(
          { error: '出勤記録の作成に失敗しました' },
          { status: 500 }
        )
      }

      result = data
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('出勤処理中にエラーが発生しました:', error)
    return NextResponse.json(
      { error: '出勤処理中にエラーが発生しました' },
      { status: 500 }
    )
  }
} 