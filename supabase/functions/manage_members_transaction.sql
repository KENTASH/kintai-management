CREATE OR REPLACE FUNCTION manage_members_transaction(
  changed_members jsonb,
  new_members jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  member jsonb;
  new_user_id uuid;
  debug_info jsonb;
  update_results jsonb[];
  insert_results jsonb[];
BEGIN
  -- デバッグ情報の初期化
  debug_info := jsonb_build_object(
    'start_time', now(),
    'new_members_count', COALESCE(jsonb_array_length(new_members), 0),
    'changed_members_count', COALESCE(jsonb_array_length(changed_members), 0)
  );

  -- 配列の初期化
  update_results := ARRAY[]::jsonb[];
  insert_results := ARRAY[]::jsonb[];

  -- 1. 既存メンバーの更新
  IF changed_members IS NOT NULL AND jsonb_array_length(changed_members) > 0 THEN
    FOR member IN SELECT * FROM jsonb_array_elements(changed_members)
    LOOP
      -- 1.1 ユーザー基本情報の更新
      UPDATE users
      SET
        last_name = COALESCE((member->>'last_name')::text, last_name),
        first_name = COALESCE((member->>'first_name')::text, first_name),
        last_name_en = COALESCE((member->>'last_name_en')::text, last_name_en),
        first_name_en = COALESCE((member->>'first_name_en')::text, first_name_en),
        email = COALESCE((member->>'email')::text, email),
        branch = COALESCE((member->>'branch')::text, branch),
        updated_by = (member->>'updated_by')::uuid,
        updated_at = now()
      WHERE id = (member->>'id')::uuid
      RETURNING id INTO new_user_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'ユーザーが見つかりません: ID %', (member->>'id')::uuid;
      END IF;

      -- 1.2 担当者情報の更新
      DELETE FROM user_supervisors WHERE user_id = (member->>'id')::uuid;
    
      -- リーダー情報の追加
      IF member->'supervisor_info'->'leader' IS NOT NULL THEN
        INSERT INTO user_supervisors (
          user_id,
          supervisor_type,
          pic_user_id,
          created_by,
          updated_by
        ) VALUES (
          (member->>'id')::uuid,
          'leader',
          ((member->'supervisor_info'->'leader'->>'id')::uuid),
          (member->>'updated_by')::uuid,
          (member->>'updated_by')::uuid
        );
      END IF;

      -- サブリーダー情報の追加
      IF member->'supervisor_info'->'subleader' IS NOT NULL THEN
        INSERT INTO user_supervisors (
          user_id,
          supervisor_type,
          pic_user_id,
          created_by,
          updated_by
        ) VALUES (
          (member->>'id')::uuid,
          'subleader',
          ((member->'supervisor_info'->'subleader'->>'id')::uuid),
          (member->>'updated_by')::uuid,
          (member->>'updated_by')::uuid
        );
      END IF;

      -- 1.3 権限情報の更新
      -- リーダー権限
      IF (member->'roles'->>'is_leader')::boolean THEN
        INSERT INTO user_roles (
          user_id,
          user_role_id,
          created_by,
          updated_by
        ) VALUES (
          (member->>'id')::uuid,
          'leader',
          (member->>'updated_by')::uuid,
          (member->>'updated_by')::uuid
        )
        ON CONFLICT (user_id, user_role_id) DO NOTHING;
      ELSE
        DELETE FROM user_roles 
        WHERE user_id = (member->>'id')::uuid 
        AND user_role_id = 'leader';
      END IF;

      -- 管理者権限
      IF (member->'roles'->>'is_admin')::boolean THEN
        INSERT INTO user_roles (
          user_id,
          user_role_id,
          created_by,
          updated_by
        ) VALUES (
          (member->>'id')::uuid,
          'admin',
          (member->>'updated_by')::uuid,
          (member->>'updated_by')::uuid
        )
        ON CONFLICT (user_id, user_role_id) DO NOTHING;
      ELSE
        DELETE FROM user_roles 
        WHERE user_id = (member->>'id')::uuid 
        AND user_role_id = 'admin';
      END IF;

      -- 更新結果を配列に追加
      update_results := array_append(update_results, 
        jsonb_build_object(
          'id', member->>'id',
          'email', member->>'email'
        )
      );
    END LOOP;
  END IF;

  -- 2. 新規メンバーの追加
  IF new_members IS NOT NULL AND jsonb_array_length(new_members) > 0 THEN
    FOR member IN SELECT * FROM jsonb_array_elements(new_members)
    LOOP
      -- 2.1 public.usersテーブルへの登録
      INSERT INTO users (
        employee_id,
        last_name,
        first_name,
        last_name_en,
        first_name_en,
        email,
        branch,
        registration_status,
        is_active,
        auth_id,
        created_by,
        updated_by,
        theme,
        language
      ) VALUES (
        (member->>'employee_id')::text,
        (member->>'last_name')::text,
        (member->>'first_name')::text,
        (member->>'last_name_en')::text,
        (member->>'first_name_en')::text,
        (member->>'email')::text,
        (member->>'branch')::text,
        '01',
        true,
        NULL,  -- auth_idはNULLで登録
        (member->>'created_by')::uuid,
        (member->>'updated_by')::uuid,
        'Light',
        'ja_JP'
      )
      RETURNING id INTO new_user_id;

      -- 2.2 担当者情報の登録
      IF member->'supervisor_info'->'leader' IS NOT NULL THEN
        INSERT INTO user_supervisors (
          user_id,
          supervisor_type,
          pic_user_id,
          created_by,
          updated_by
        ) VALUES (
          new_user_id,
          'leader',
          ((member->'supervisor_info'->'leader'->>'id')::uuid),
          (member->>'created_by')::uuid,
          (member->>'updated_by')::uuid
        );
      END IF;

      IF member->'supervisor_info'->'subleader' IS NOT NULL THEN
        INSERT INTO user_supervisors (
          user_id,
          supervisor_type,
          pic_user_id,
          created_by,
          updated_by
        ) VALUES (
          new_user_id,
          'subleader',
          ((member->'supervisor_info'->'subleader'->>'id')::uuid),
          (member->>'created_by')::uuid,
          (member->>'updated_by')::uuid
        );
      END IF;

      -- 2.3 権限情報の登録
      IF (member->'roles'->>'is_leader')::boolean THEN
        INSERT INTO user_roles (
          user_id,
          user_role_id,
          created_by,
          updated_by
        ) VALUES (
          new_user_id,
          'leader',
          (member->>'created_by')::uuid,
          (member->>'updated_by')::uuid
        );
      END IF;

      IF (member->'roles'->>'is_admin')::boolean THEN
        INSERT INTO user_roles (
          user_id,
          user_role_id,
          created_by,
          updated_by
        ) VALUES (
          new_user_id,
          'admin',
          (member->>'created_by')::uuid,
          (member->>'updated_by')::uuid
        );
      END IF;

      -- 挿入結果を配列に追加
      insert_results := array_append(insert_results, 
        jsonb_build_object(
          'id', new_user_id,
          'email', member->>'email'
        )
      );
    END LOOP;
  END IF;

  -- 最終的なデバッグ情報を構築
  debug_info := debug_info || jsonb_build_object(
    'updated_members', update_results,
    'inserted_members', insert_results
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'メンバー情報が正常に更新されました',
    'debug_info', debug_info
  );
EXCEPTION
  WHEN OTHERS THEN
    -- エラー発生時はロールバック
    RAISE EXCEPTION 'トランザクションエラー: % \nデバッグ情報: %', SQLERRM, debug_info;
END;
$$;

-- 関数の実行権限を設定
GRANT EXECUTE ON FUNCTION manage_members_transaction(jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION manage_members_transaction(jsonb, jsonb) TO service_role; 