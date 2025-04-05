create table public.attendance_approvals (
  id uuid not null default extensions.uuid_generate_v4 (),
  header_id uuid not null,
  process_type character varying(2) not null,
  result_code character varying(10) not null,
  approved_by uuid not null,
  approved_at timestamp with time zone null default now(),
  comments text null,
  created_by uuid not null,
  created_at timestamp with time zone null default now(),
  updated_by uuid not null,
  updated_at timestamp with time zone null default now(),
  constraint attendance_approvals_pkey primary key (id),
  constraint attendance_approvals_approved_by_fkey foreign KEY (approved_by) references users (id),
  constraint attendance_approvals_created_by_fkey foreign KEY (created_by) references users (id),
  constraint attendance_approvals_header_id_fkey foreign KEY (header_id) references attendance_headers (id) on delete CASCADE,
  constraint attendance_approvals_updated_by_fkey foreign KEY (updated_by) references users (id)
) TABLESPACE pg_default;