-- 勤怠ヘッダーテーブル
CREATE TABLE attendance_headers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id VARCHAR(10) NOT NULL,
    branch VARCHAR(10) NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    status VARCHAR(2) NOT NULL DEFAULT '00',  -- 00:作成中, 01:確定
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_employee FOREIGN KEY (employee_id) REFERENCES employees(employee_id),
    CONSTRAINT fk_branch FOREIGN KEY (branch) REFERENCES branches(code),
    CONSTRAINT fk_created_by FOREIGN KEY (created_by) REFERENCES auth.users(id),
    CONSTRAINT fk_updated_by FOREIGN KEY (updated_by) REFERENCES auth.users(id),
    CONSTRAINT unique_employee_year_month UNIQUE (employee_id, year, month)
);

-- 勤怠詳細テーブル
CREATE TABLE attendance_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    header_id UUID NOT NULL,
    date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    break_time INTEGER DEFAULT 60,  -- 休憩時間（分）
    actual_working_hours NUMERIC(4,1),  -- 実働時間（時間）
    overtime_hours NUMERIC(4,1),  -- 残業時間（時間）
    work_type_code VARCHAR(2) DEFAULT '01',  -- 01:通常勤務, 02:休日出勤, etc
    remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_header FOREIGN KEY (header_id) REFERENCES attendance_headers(id),
    CONSTRAINT unique_header_date UNIQUE (header_id, date)
);

-- インデックス
CREATE INDEX idx_attendance_headers_employee ON attendance_headers(employee_id);
CREATE INDEX idx_attendance_headers_branch ON attendance_headers(branch);
CREATE INDEX idx_attendance_headers_year_month ON attendance_headers(year, month);
CREATE INDEX idx_attendance_details_header ON attendance_details(header_id);
CREATE INDEX idx_attendance_details_date ON attendance_details(date);

-- トリガー関数: 更新日時を自動更新
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- トリガー設定
CREATE TRIGGER update_attendance_headers_updated_at
    BEFORE UPDATE ON attendance_headers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_attendance_details_updated_at
    BEFORE UPDATE ON attendance_details
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLSポリシー設定
ALTER TABLE attendance_headers ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_details ENABLE ROW LEVEL SECURITY;

-- 参照用ポリシー
CREATE POLICY "ユーザーは自分の勤怠データを参照可能" ON attendance_headers
    FOR SELECT
    USING (created_by = auth.uid());

CREATE POLICY "ユーザーは自分の勤怠詳細を参照可能" ON attendance_details
    FOR SELECT
    USING (header_id IN (
        SELECT id FROM attendance_headers 
        WHERE created_by = auth.uid()
    ));

-- 更新用ポリシー
CREATE POLICY "ユーザーは自分の勤怠データを更新可能" ON attendance_headers
    FOR UPDATE
    USING (created_by = auth.uid());

CREATE POLICY "ユーザーは自分の勤怠詳細を更新可能" ON attendance_details
    FOR UPDATE
    USING (header_id IN (
        SELECT id FROM attendance_headers 
        WHERE created_by = auth.uid()
    ));

-- 挿入用ポリシー
CREATE POLICY "ユーザーは勤怠データを作成可能" ON attendance_headers
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "ユーザーは勤怠詳細を作成可能" ON attendance_details
    FOR INSERT
    WITH CHECK (header_id IN (
        SELECT id FROM attendance_headers 
        WHERE created_by = auth.uid()
    ));

-- 今日の勤怠テーブル
CREATE TABLE daily_attendances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch VARCHAR(10) NOT NULL,
    employee_id VARCHAR(10) NOT NULL,
    work_date DATE NOT NULL,
    check_in TIME,
    check_out TIME,
    working_hours NUMERIC(4,1),  -- 勤務時間（時間）
    overtime_hours NUMERIC(4,1),  -- 残業時間（時間）
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_employee FOREIGN KEY (employee_id) REFERENCES employees(employee_id),
    CONSTRAINT fk_branch FOREIGN KEY (branch) REFERENCES branches(code),
    CONSTRAINT unique_attendance_record UNIQUE (branch, employee_id, work_date)
);

-- インデックス
CREATE INDEX idx_daily_attendances_branch ON daily_attendances(branch);
CREATE INDEX idx_daily_attendances_employee ON daily_attendances(employee_id);
CREATE INDEX idx_daily_attendances_date ON daily_attendances(work_date);

-- トリガー関数: 更新日時を自動更新
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- トリガー設定
CREATE TRIGGER update_daily_attendances_updated_at
    BEFORE UPDATE ON daily_attendances
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLSポリシー設定
ALTER TABLE daily_attendances ENABLE ROW LEVEL SECURITY;

-- 参照・更新・挿入用ポリシー
CREATE POLICY "ユーザーは自分の支店の勤怠データにアクセス可能" ON daily_attendances
    FOR ALL
    USING (
        branch IN (
            SELECT branch FROM user_branches 
            WHERE user_id = auth.uid()
        )
    ); 