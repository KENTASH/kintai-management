import { supabase, uploadFile, deleteFile } from "@/lib/supabase";
import { v4 as uuidv4 } from 'uuid';

// 経費データの型定義
export interface CommuteExpense {
  id?: string;
  date: string;
  transportation: string;
  from: string;
  to: string;
  expenseType: string;
  roundTripType: string;
  amount: number;
  remarks?: string;
}

export interface BusinessExpense {
  id?: string;
  date: string;
  transportation: string;
  from: string;
  to: string;
  expenseType: string;
  roundTripType: string;
  amount: number;
  remarks?: string;
  category?: 'business';
}

export interface ReceiptRecord {
  id: string;
  fileName: string;
  fileUrl: string;
  filePath: string;
  fileSize?: number;
  fileType?: string;
  remarks?: string;
  uploadedAt: string;
}

export interface ExpenseData {
  commuteExpenses: CommuteExpense[];
  businessExpenses: BusinessExpense[];
  receipts: ReceiptRecord[];
  employeeId?: string; // 従業員ID
  branch?: string; // 支店コード
}

/**
 * 指定された年月の経費データを取得する
 */
export async function fetchExpenseData(
  userId: string,
  year: number,
  month: number
): Promise<{ success: boolean; data?: ExpenseData; error?: string }> {
  try {
    console.log('経費データ取得開始 - ユーザーID:', userId, '年月:', year, month);

    // 経費ヘッダーを検索
    const { data: headerData, error: headerError } = await supabase
      .from('expense_headers')
      .select('id')
      .eq('user_id', userId)
      .eq('year', year)
      .eq('month', month)
      .maybeSingle();

    if (headerError) {
      console.error('経費ヘッダー検索エラー:', headerError);
      throw new Error('経費ヘッダーの検索に失敗しました');
    }

    // ヘッダーが存在しない場合は空のデータを返す
    if (!headerData) {
      return {
        success: true,
        data: {
          commuteExpenses: [],
          businessExpenses: [],
          receipts: []
        }
      };
    }

    const headerId = headerData.id;

    // 通勤費データを取得
    const { data: commuteData, error: commuteError } = await supabase
      .from('expense_details')
      .select('*')
      .eq('header_id', headerId)
      .eq('category', 'commute');

    if (commuteError) {
      console.error('通勤費データ取得エラー:', commuteError);
      throw new Error('通勤費データの取得に失敗しました');
    }

    // 業務経費データを取得
    const { data: expenseData, error: expenseError } = await supabase
      .from('expense_details')
      .select('*')
      .eq('header_id', headerId)
      .eq('category', 'business');

    if (expenseError) {
      console.error('業務経費データ取得エラー:', expenseError);
      throw new Error('業務経費データの取得に失敗しました');
    }

    // 領収書データを取得
    const { data: receiptsData, error: receiptsError } = await supabase
      .from('expense_receipts')
      .select('*')
      .eq('header_id', headerId);

    if (receiptsError) {
      console.error('領収書データ取得エラー:', receiptsError);
      throw new Error('領収書データの取得に失敗しました');
    }

    // 通勤費データを整形
    const commuteExpenses = commuteData?.map(item => ({
      id: item.id,
      date: item.date,
      transportation: item.transportation,
      from: item.from_location,
      to: item.to_location,
      expenseType: item.expense_type,
      roundTripType: item.round_trip_type,
      amount: item.amount,
      remarks: item.remarks || '',
      category: 'commute' as const
    })) || [];

    // 業務経費データを整形
    const businessExpenses = expenseData?.map(item => ({
      id: item.id,
      date: item.date,
      transportation: item.transportation,
      from: item.from_location,
      to: item.to_location,
      expenseType: item.expense_type,
      roundTripType: item.round_trip_type,
      amount: item.amount,
      remarks: item.remarks || '',
      category: 'business' as const
    })) || [];

    // 領収書データを整形
    const receipts = receiptsData?.map(item => ({
      id: item.id,
      fileName: item.file_name,
      fileUrl: '', // 公開URLは別途取得が必要
      filePath: item.file_path,
      fileSize: item.file_size,
      fileType: item.file_type,
      remarks: item.remarks || '',
      uploadedAt: item.uploaded_at || new Date().toISOString()
    })) || [];

    // 領収書の公開URLを取得
    for (const receipt of receipts) {
      if (receipt.filePath) {
        try {
          console.log('領収書ファイルパス:', receipt.filePath);
          // 正しいバケット名を使用（実際のバケット名に合わせて変更）
          const { data } = supabase.storage
            .from('expense-evidences')
            .getPublicUrl(receipt.filePath);
          
          receipt.fileUrl = data.publicUrl;
          console.log('取得した公開URL:', data.publicUrl);
        } catch (error) {
          console.error('領収書の公開URL取得エラー:', error);
          receipt.fileUrl = '';
        }
      }
    }

    return {
      success: true,
      data: {
        commuteExpenses,
        businessExpenses,
        receipts
      }
    };
  } catch (error) {
    console.error('経費データ取得エラー:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '経費データの取得に失敗しました'
    };
  }
}

// 経費データ保存
export async function saveExpenseData(
  userId: string,
  year: number,
  month: number,
  data: ExpenseData
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('経費保存開始 - ユーザーID:', userId, '年月:', year, month);

    // ユーザー情報はExpenseDataから取得
    const employeeId = data.employeeId || 'unknown';
    const branch = data.branch || 'unknown';

    console.log('使用するユーザー情報:', { userId, employeeId, branch });

    // 対応する勤怠ヘッダーを取得（存在すれば関連付ける）
    let attendanceHeaderId = null;
    
    try {
      const attendanceResponse = await supabase
        .from('attendance_headers')
        .select('id')
        .eq('user_id', userId)
        .eq('year', year)
        .eq('month', month);

      console.log('勤怠ヘッダー検索結果:', JSON.stringify(attendanceResponse));

      if (!attendanceResponse.error && attendanceResponse.data && attendanceResponse.data.length > 0) {
        attendanceHeaderId = attendanceResponse.data[0].id;
      }
    } catch (error) {
      console.warn('勤怠ヘッダー検索中にエラーが発生しましたが、処理を続行します:', error);
    }

    // 既存の経費ヘッダーを検索
    let headerId: string | null = null;
    
    try {
      const expenseHeaderResponse = await supabase
        .from('expense_headers')
        .select('id')
        .eq('user_id', userId)
        .eq('year', year)
        .eq('month', month);

      console.log('経費ヘッダー検索結果:', JSON.stringify(expenseHeaderResponse));

      if (!expenseHeaderResponse.error && expenseHeaderResponse.data && expenseHeaderResponse.data.length > 0) {
        // 既存の経費ヘッダーを更新
        headerId = expenseHeaderResponse.data[0].id;

        const updateHeaderResponse = await supabase
          .from('expense_headers')
          .update({
            attendance_header_id: attendanceHeaderId,
            employee_id: employeeId,
            branch: branch,
            updated_by: userId,
            updated_at: new Date().toISOString()
          })
          .eq('id', headerId);

        console.log('経費ヘッダー更新結果:', JSON.stringify(updateHeaderResponse));

        if (updateHeaderResponse.error) {
          console.error('経費ヘッダー更新エラー詳細:', JSON.stringify(updateHeaderResponse.error));
          throw new Error(`経費ヘッダーの更新に失敗しました: ${updateHeaderResponse.error.message}`);
        }
      } else {
        // 経費ヘッダーが存在しない場合は新規作成
        console.log('経費ヘッダー新規作成:', {
          user_id: userId,
          employee_id: employeeId,
          branch: branch,
          year: year,
          month: month,
          attendance_header_id: attendanceHeaderId
        });

        const newHeaderResponse = await supabase
          .from('expense_headers')
          .insert({
            user_id: userId,
            employee_id: employeeId,
            branch: branch,
            year: year,
            month: month,
            attendance_header_id: attendanceHeaderId,
            created_by: userId,
            updated_by: userId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select('id');

        console.log('経費ヘッダー作成結果:', JSON.stringify(newHeaderResponse));

        if (newHeaderResponse.error) {
          console.error('経費ヘッダー作成エラー詳細:', JSON.stringify(newHeaderResponse.error));
          throw new Error(`経費ヘッダーの作成に失敗しました: ${newHeaderResponse.error.message}`);
        }

        if (!newHeaderResponse.data || newHeaderResponse.data.length === 0) {
          throw new Error('経費ヘッダー作成後のIDが取得できませんでした');
        }

        headerId = newHeaderResponse.data[0].id;
      }

      // 既存の経費詳細データを削除
      const { error: deleteDetailsError } = await supabase
        .from('expense_details')
        .delete()
        .eq('header_id', headerId);

      if (deleteDetailsError) {
        console.error('経費詳細削除エラー:', deleteDetailsError);
        throw new Error('既存の経費データの削除に失敗しました');
      }

      // 既存の領収書データを削除（ファイルは残す）
      const { error: deleteReceiptsError } = await supabase
        .from('expense_receipts')
        .delete()
        .eq('header_id', headerId);

      if (deleteReceiptsError) {
        console.error('領収書データ削除エラー:', deleteReceiptsError);
        throw new Error('既存の領収書データの削除に失敗しました');
      }

      // 通勤費データを保存
      if (data.commuteExpenses.length > 0) {
        const commuteDetails = data.commuteExpenses.map(expense => ({
          header_id: headerId,
          category: 'commute',
          date: expense.date,
          transportation: expense.transportation,
          from_location: expense.from,
          to_location: expense.to,
          expense_type: expense.expenseType,
          round_trip_type: expense.roundTripType,
          amount: expense.amount,
          remarks: expense.remarks || null,
          created_by: userId,
          updated_by: userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));

        const { error: commuteError } = await supabase
          .from('expense_details')
          .insert(commuteDetails);

        if (commuteError) {
          console.error('通勤費保存エラー:', commuteError);
          throw new Error('通勤費の保存に失敗しました');
        }
      }

      // 業務経費データを保存
      if (data.businessExpenses.length > 0) {
        const businessDetails = data.businessExpenses.map(expense => ({
          header_id: headerId,
          category: 'business',
          date: expense.date,
          transportation: expense.transportation,
          from_location: expense.from,
          to_location: expense.to,
          expense_type: expense.expenseType,
          round_trip_type: expense.roundTripType,
          amount: expense.amount,
          remarks: expense.remarks || null,
          created_by: userId,
          updated_by: userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));

        const { error: businessError } = await supabase
          .from('expense_details')
          .insert(businessDetails);

        if (businessError) {
          console.error('業務経費保存エラー:', businessError);
          throw new Error('業務経費の保存に失敗しました');
        }
      }

      // 領収書データを保存
      if (data.receipts.length > 0) {
        console.log('領収書データを保存します - ユーザーID:', userId);
        
        const receiptDetails = data.receipts.map(receipt => ({
          header_id: headerId,
          file_name: receipt.fileName,
          file_path: receipt.filePath,
          file_size: receipt.fileSize,
          file_type: receipt.fileType,
          remarks: receipt.remarks || null,
          uploaded_at: receipt.uploadedAt,
          created_by: userId,
          updated_by: userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));

        console.log('保存する領収書データ:', JSON.stringify(receiptDetails));

        try {
          const { error: receiptError } = await supabase
            .from('expense_receipts')
            .insert(receiptDetails);

          if (receiptError) {
            console.error('領収書保存エラー:', receiptError);
            throw new Error('領収書の保存に失敗しました');
          }
        } catch (error) {
          console.error('領収書保存中に例外が発生しました:', error);
          throw new Error('領収書の保存中に例外が発生しました');
        }
      }

      return { success: true };
    } catch (headerError) {
      console.error('経費ヘッダー処理エラー:', headerError);
      throw headerError;
    }
  } catch (error) {
    console.error('経費データ保存エラー:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '経費データの保存に失敗しました'
    };
  }
} 