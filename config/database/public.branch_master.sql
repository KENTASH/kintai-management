create table public.branch_master (
  code character varying not null,
  name_jp character varying not null,
  name_en character varying not null,
  created_at timestamp with time zone null default CURRENT_TIMESTAMP,
  updated_at timestamp with time zone null default CURRENT_TIMESTAMP,
  created_by uuid null,
  updated_by uuid null,
  constraint branch_master_pkey primary key (code)
) TABLESPACE pg_default;