create table public.daily_attendances (
    id uuid not null default gen_random_uuid(),
    branch character varying not null,
    employee_id character varying not null,
    work_date date not null,
    check_in time null,
    check_out time null,
    working_hours numeric(4,1) null,  -- 勤務時間（時間）
    overtime_hours numeric(4,1) null,  -- 残業時間（時間）
    created_at timestamp with time zone null default CURRENT_TIMESTAMP,
    updated_at timestamp with time zone null default CURRENT_TIMESTAMP,
    created_by uuid null,
    updated_by uuid null,
    constraint daily_attendances_pkey primary key (id),
    constraint daily_attendances_branch_fkey foreign key (branch) references public.branch_master(code) on delete restrict,
    constraint daily_attendances_unique_record unique (branch, employee_id, work_date)
) tablespace pg_default;

-- インデックス
create index idx_daily_attendances_branch on public.daily_attendances using btree (branch);
create index idx_daily_attendances_employee on public.daily_attendances using btree (employee_id);
create index idx_daily_attendances_date on public.daily_attendances using btree (work_date);

-- RLSポリシー設定
alter table public.daily_attendances enable row level security;

-- フルアクセスポリシー
create policy "全ユーザーフルアクセス可能" on public.daily_attendances
    for all
    using (true)
    with check (true); 