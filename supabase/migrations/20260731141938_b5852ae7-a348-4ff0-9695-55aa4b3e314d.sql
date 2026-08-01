-- 1. Kho tài nguyên ảnh dùng chung
CREATE TABLE IF NOT EXISTS public.quiz_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  storage_path text NOT NULL,
  kind text NOT NULL DEFAULT 'cover',
  tags text[] NOT NULL DEFAULT '{}',
  width integer NOT NULL DEFAULT 0,
  height integer NOT NULL DEFAULT 0,
  size_bytes integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_assets TO authenticated;
GRANT ALL ON public.quiz_assets TO service_role;

ALTER TABLE public.quiz_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quiz_assets admin manage" ON public.quiz_assets;
DROP POLICY IF EXISTS "quiz_assets admin manage" ON public.quiz_assets;
CREATE POLICY "quiz_assets admin manage" ON public.quiz_assets
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "quiz_assets editor manage" ON public.quiz_assets;
DROP POLICY IF EXISTS "quiz_assets editor manage" ON public.quiz_assets;
CREATE POLICY "quiz_assets editor manage" ON public.quiz_assets
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'editor'))
  WITH CHECK (public.has_role(auth.uid(), 'editor'));

CREATE INDEX IF NOT EXISTS quiz_assets_kind_created_idx ON public.quiz_assets (kind, created_at DESC);

DROP TRIGGER IF EXISTS quiz_assets_touch ON public.quiz_assets;
CREATE TRIGGER quiz_assets_touch BEFORE UPDATE ON public.quiz_assets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. Hồ sơ người chơi (kinh nghiệm, cấp độ, avatar 3D)
CREATE TABLE IF NOT EXISTS public.player_profiles (
  employee_id uuid PRIMARY KEY,
  display_name text NOT NULL DEFAULT '',
  unit text NOT NULL DEFAULT '',
  xp integer NOT NULL DEFAULT 0,
  level integer NOT NULL DEFAULT 1,
  exams_taken integer NOT NULL DEFAULT 0,
  exams_passed integer NOT NULL DEFAULT 0,
  best_streak integer NOT NULL DEFAULT 0,
  avatar_url text NOT NULL DEFAULT '',
  avatar_image text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.player_profiles TO anon;
GRANT SELECT ON public.player_profiles TO authenticated;
GRANT ALL ON public.player_profiles TO service_role;

ALTER TABLE public.player_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "player_profiles public read" ON public.player_profiles;
DROP POLICY IF EXISTS "player_profiles public read" ON public.player_profiles;
CREATE POLICY "player_profiles public read" ON public.player_profiles
  FOR SELECT TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS player_profiles_rank_idx ON public.player_profiles (xp DESC, level DESC);

DROP TRIGGER IF EXISTS player_profiles_touch ON public.player_profiles;
CREATE TRIGGER player_profiles_touch BEFORE UPDATE ON public.player_profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3. Cộng kinh nghiệm sau khi nộp bài (tuần tự hoá theo nhân viên)
CREATE OR REPLACE FUNCTION public.award_player_xp(
  p_employee_id uuid,
  p_display_name text,
  p_unit text,
  p_gain integer,
  p_passed boolean,
  p_best_streak integer
)
RETURNS TABLE(xp integer, level integer, gained integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_xp integer;
  v_level integer;
BEGIN
  IF p_employee_id IS NULL THEN
    RETURN QUERY SELECT 0, 1, 0;
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_employee_id::text, 7));

  INSERT INTO public.player_profiles (employee_id, display_name, unit, xp, exams_taken, exams_passed, best_streak)
  VALUES (
    p_employee_id,
    COALESCE(p_display_name, ''),
    COALESCE(NULLIF(p_unit, ''), 'Chưa cập nhật'),
    GREATEST(0, COALESCE(p_gain, 0)),
    1,
    CASE WHEN p_passed THEN 1 ELSE 0 END,
    GREATEST(0, COALESCE(p_best_streak, 0))
  )
  ON CONFLICT (employee_id) DO UPDATE SET
    display_name = COALESCE(NULLIF(EXCLUDED.display_name, ''), public.player_profiles.display_name),
    unit = COALESCE(NULLIF(EXCLUDED.unit, ''), public.player_profiles.unit),
    xp = public.player_profiles.xp + GREATEST(0, COALESCE(p_gain, 0)),
    exams_taken = public.player_profiles.exams_taken + 1,
    exams_passed = public.player_profiles.exams_passed + CASE WHEN p_passed THEN 1 ELSE 0 END,
    best_streak = GREATEST(public.player_profiles.best_streak, GREATEST(0, COALESCE(p_best_streak, 0)))
  RETURNING public.player_profiles.xp INTO v_xp;

  -- Cấp độ: mỗi cấp cần 100 + (cấp-1)*50 điểm kinh nghiệm (luỹ tiến)
  v_level := 1;
  WHILE v_xp >= (100 * v_level + 50 * v_level * (v_level - 1) / 2) LOOP
    v_level := v_level + 1;
  END LOOP;

  UPDATE public.player_profiles SET level = v_level WHERE employee_id = p_employee_id;

  RETURN QUERY SELECT v_xp, v_level, GREATEST(0, COALESCE(p_gain, 0));
END;
$$;

REVOKE ALL ON FUNCTION public.award_player_xp(uuid, text, text, integer, boolean, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.award_player_xp(uuid, text, text, integer, boolean, integer) TO service_role;

-- 4. Cho phép nhân viên tự đặt ảnh đại diện qua hàm an toàn
CREATE OR REPLACE FUNCTION public.set_player_avatar(
  p_employee_id uuid,
  p_avatar_url text,
  p_avatar_image text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.player_profiles (employee_id, avatar_url, avatar_image)
  VALUES (p_employee_id, COALESCE(p_avatar_url, ''), COALESCE(p_avatar_image, ''))
  ON CONFLICT (employee_id) DO UPDATE SET
    avatar_url = COALESCE(p_avatar_url, ''),
    avatar_image = COALESCE(p_avatar_image, '');
END;
$$;

REVOKE ALL ON FUNCTION public.set_player_avatar(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_player_avatar(uuid, text, text) TO service_role;