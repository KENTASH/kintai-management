create table public.user_roles (
  user_id uuid not null,
  user_role_id character varying not null,
  created_at timestamp with time zone null default CURRENT_TIMESTAMP,
  updated_at timestamp with time zone null default CURRENT_TIMESTAMP,
  created_by uuid null,
  updated_by uuid null,
  constraint user_roles_pkey primary key (user_id, user_role_id),
  constraint user_roles_user_id_fkey foreign KEY (user_id) references users (id) on delete CASCADE,
  constraint user_roles_user_role_id_check check (
    (
      (user_role_id)::text = any (
        (
          array[
            'employee'::character varying,
            'leader'::character varying,
            'admin'::character varying
          ]
        )::text[]
      )
    )
  )
) TABLESPACE pg_default;