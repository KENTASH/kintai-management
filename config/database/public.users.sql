create table public.users (
  id uuid not null default gen_random_uuid (),
  auth_id uuid null,
  employee_id character varying not null,
  email character varying not null,
  last_name character varying not null,
  first_name character varying not null,
  last_name_en character varying null,
  first_name_en character varying null,
  branch character varying not null,
  avatar_url text null,
  is_active boolean null default true,
  theme public.theme_enum not null default 'Light'::theme_enum,
  language character varying not null default 'ja_JP'::character varying,
  created_at timestamp with time zone null default CURRENT_TIMESTAMP,
  updated_at timestamp with time zone null default CURRENT_TIMESTAMP,
  created_by uuid null,
  updated_by uuid null,
  registration_status public.registration_status_enum not null default '01'::registration_status_enum,
  constraint users_pkey primary key (id),
  constraint users_auth_id_key unique (auth_id),
  constraint users_email_key unique (email),
  constraint users_employee_id_key unique (employee_id),
  constraint users_branch_fkey foreign KEY (branch) references branch_master (code) on delete set null,
  constraint users_language_check check (
    (
      (language)::text = any (
        (
          array[
            'ja_JP'::character varying,
            'en_US'::character varying
          ]
        )::text[]
      )
    )
  ),
  constraint users_theme_check check (
    (
      (theme)::text = any (
        array[
          ('Light'::character varying)::text,
          ('Dark'::character varying)::text
        ]
      )
    )
  )
) TABLESPACE pg_default;