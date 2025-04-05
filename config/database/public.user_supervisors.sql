create table public.user_supervisors (
  user_id uuid not null,
  supervisor_type public.supervisor_type_enum not null,
  pic_user_id uuid null,
  created_at timestamp with time zone null default CURRENT_TIMESTAMP,
  updated_at timestamp with time zone null default CURRENT_TIMESTAMP,
  created_by uuid null,
  updated_by uuid null,
  constraint user_supervisors_pkey primary key (user_id, supervisor_type),
  constraint user_supervisors_pic_user_id_fkey foreign KEY (pic_user_id) references users (id) on delete set null,
  constraint user_supervisors_user_id_fkey foreign KEY (user_id) references users (id) on delete CASCADE,
  constraint user_supervisors_supervisor_type_check check (
    (
      (supervisor_type)::text = any (
        array[
          ('leader'::character varying)::text,
          ('subleader'::character varying)::text
        ]
      )
    )
  )
) TABLESPACE pg_default;