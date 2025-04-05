create table public.holiday_master (
  id uuid not null default gen_random_uuid (),
  year integer not null,
  date date not null,
  remarks text null,
  created_at timestamp with time zone null default CURRENT_TIMESTAMP,
  updated_at timestamp with time zone null default CURRENT_TIMESTAMP,
  created_by uuid null,
  updated_by uuid null,
  constraint holiday_master_pkey primary key (id),
  constraint holiday_master_year_date_key unique (year, date),
  constraint holiday_master_created_by_fkey foreign KEY (created_by) references users (id),
  constraint holiday_master_updated_by_fkey foreign KEY (updated_by) references users (id)
) TABLESPACE pg_default;

create index IF not exists idx_holiday_master_year on public.holiday_master using btree (year) TABLESPACE pg_default;

create index IF not exists idx_holiday_master_date on public.holiday_master using btree (date) TABLESPACE pg_default;

create trigger set_holiday_master_updated_at BEFORE
update on holiday_master for EACH row
execute FUNCTION handle_updated_at ();