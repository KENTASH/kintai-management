create table public.work_types (
  code character varying(2) not null,
  name_ja text not null,
  name_en text not null,
  is_paid boolean null default false,
  is_working_day boolean null default true,
  created_by uuid not null,
  created_at timestamp with time zone null default now(),
  updated_by uuid not null,
  updated_at timestamp with time zone null default now(),
  constraint work_types_pkey primary key (code),
  constraint work_types_created_by_fkey foreign KEY (created_by) references users (id),
  constraint work_types_updated_by_fkey foreign KEY (updated_by) references users (id)
) TABLESPACE pg_default;