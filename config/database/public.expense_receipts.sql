create table public.expense_receipts (
  id uuid not null default gen_random_uuid (),
  header_id uuid not null,
  file_name text not null,
  file_path text not null,
  file_size integer not null default 0,
  file_type text not null,
  remarks text null,
  uploaded_at timestamp with time zone not null default now(),
  created_by uuid not null,
  created_at timestamp with time zone not null default now(),
  updated_by uuid not null,
  updated_at timestamp with time zone not null default now(),
  constraint expense_receipts_pkey primary key (id),
  constraint expense_receipts_created_by_fkey foreign KEY (created_by) references users (id),
  constraint expense_receipts_header_id_fkey foreign KEY (header_id) references expense_headers (id) on delete CASCADE,
  constraint expense_receipts_updated_by_fkey foreign KEY (updated_by) references users (id)
) TABLESPACE pg_default;

create index IF not exists expense_receipts_header_id_idx on public.expense_receipts using btree (header_id) TABLESPACE pg_default;

create index IF not exists expense_receipts_created_by_idx on public.expense_receipts using btree (created_by) TABLESPACE pg_default;

create index IF not exists expense_receipts_updated_by_idx on public.expense_receipts using btree (updated_by) TABLESPACE pg_default;