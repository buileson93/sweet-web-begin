CREATE OR REPLACE FUNCTION public.award_player_xp(p_employee_id uuid, p_display_name text, p_unit text, p_gain integer, p_passed boolean, p_best_streak integer)
RETURNS TABLE(xp integer, level integer, gained integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  v_level := 1;
  WHILE v_level < 10 AND v_xp >= (1250 * v_level * (v_level + 1)) LOOP
    v_level := v_level + 1;
  END LOOP;

  UPDATE public.player_profiles SET level = v_level WHERE employee_id = p_employee_id;

  RETURN QUERY SELECT v_xp, v_level, GREATEST(0, COALESCE(p_gain, 0));
END;
$function$;