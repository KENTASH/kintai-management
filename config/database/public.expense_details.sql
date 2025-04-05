create table public.expense_details (
  id uuid not null default extensions.uuid_generate_v4 (),
  header_id uuid not null,
  category character varying(10) not null,
  date date not null,
  transportation character varying(100) not null,
  from_location character varying(100) not null,
  to_location character varying(100) not null,
  expense_type character varying(20) not null,
  round_trip_type character varying(20) not null,
  amount integer not null,
  remarks text null,
  created_at timestamp with time zone null default CURRENT_TIMESTAMP,
  updated_at timestamp with time zone null default CURRENT_TIMESTAMP,
  created_by uuid not null,
  updated_by uuid not null,
  constraint expense_details_pkey primary key (id),
  constraint expense_details_created_by_fkey foreign KEY (created_by) references users (id),
  constraint expense_details_header_id_fkey foreign KEY (header_id) references expense_headers (id),
  constraint expense_details_updated_by_fkey foreign KEY (updated_by) references users (id),
  constraint expense_details_amount_check check ((amount >= 0)),
  constraint expense_details_category_check check (
    (
      (category)::text = any (
        (
          array[
            'commute'::character varying,
            'business'::character varying
          ]
        )::text[]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_expense_details_header_id on public.expense_details using btree (header_id) TABLESPACE pg_default;

create index IF not exists idx_expense_details_date on public.expense_details using btree (date) TABLESPACE pg_default;

create index IF not exists idx_expense_details_category on public.expense_details using btree (category) TABLESPACE pg_default;

create trigger update_expense_details_updated_at BEFORE
update on expense_details for EACH row
execute FUNCTION update_updated_at_column ();