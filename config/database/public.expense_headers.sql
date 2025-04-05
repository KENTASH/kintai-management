create table public.expense_headers (
  id uuid not null default extensions.uuid_generate_v4 (),
  attendance_header_id uuid null,
  user_id uuid null,
  employee_id character varying null,
  branch character varying null,
  year integer null,
  month integer null,
  created_at timestamp with time zone null default CURRENT_TIMESTAMP,
  updated_at timestamp with time zone null default CURRENT_TIMESTAMP,
  created_by uuid null,
  updated_by uuid null,
  constraint expense_headers_pkey primary key (id),
  constraint expense_headers_user_year_month_unique unique (user_id, year, month),
  constraint expense_headers_branch_fkey foreign KEY (branch) references branch_master (code),
  constraint expense_headers_created_by_fkey foreign KEY (created_by) references users (id),
  constraint expense_headers_attendance_header_id_fkey foreign KEY (attendance_header_id) references attendance_headers (id),
  constraint expense_headers_updated_by_fkey foreign KEY (updated_by) references users (id),
  constraint expense_headers_user_id_fkey foreign KEY (user_id) references users (id)
) TABLESPACE pg_default;

create index IF not exists idx_expense_headers_user_id on public.expense_headers using btree (user_id) TABLESPACE pg_default;

create index IF not exists idx_expense_headers_year_month on public.expense_headers using btree (year, month) TABLESPACE pg_default;