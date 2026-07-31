-- 1) Cấp quyền đọc các cột công khai còn thiếu của quizzes cho anon/authenticated
GRANT SELECT (status, intro_markdown, strict_mode, disqualify_threshold, streak_step, streak_max_bonus, double_points_after)
  ON public.quizzes TO anon;
GRANT SELECT (status, intro_markdown, strict_mode, disqualify_threshold, streak_step, streak_max_bonus, double_points_after)
  ON public.quizzes TO authenticated;
GRANT SELECT (integrity_score, late_submit, employee_id, session_id)
  ON public.results TO authenticated;

-- 2) Khoá thiết bị chống thi hộ
CREATE TABLE IF NOT EXISTS public.device_locks (
  device_id text PRIMARY KEY,
  employee_id uuid NOT NULL,
  candidate_name text NOT NULL DEFAULT '',
  last_used_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.device_locks TO authenticated;
GRANT ALL ON public.device_locks TO service_role;
ALTER TABLE public.device_locks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "device_locks staff read" ON public.device_locks;
CREATE POLICY "device_locks staff read" ON public.device_locks
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE INDEX IF NOT EXISTS device_locks_employee_idx ON public.device_locks (employee_id, last_used_at DESC);

DROP TRIGGER IF EXISTS device_locks_touch ON public.device_locks;
CREATE TRIGGER device_locks_touch BEFORE UPDATE ON public.device_locks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3) Hàm giành quyền dùng thiết bị (tuần tự hoá theo device_id)
CREATE OR REPLACE FUNCTION public.claim_exam_device(
  p_device_id text,
  p_employee_id uuid,
  p_candidate_name text,
  p_cooldown_minutes integer DEFAULT 30
)
RETURNS TABLE(allowed boolean, wait_seconds integer, holder_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.device_locks%ROWTYPE;
  v_wait integer;
BEGIN
  IF p_device_id IS NULL OR length(btrim(p_device_id)) < 8 THEN
    RETURN QUERY SELECT true, 0, ''::text;
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_device_id, 0));

  SELECT * INTO v_row FROM public.device_locks WHERE device_id = p_device_id;

  IF v_row.device_id IS NULL OR v_row.employee_id = p_employee_id THEN
    INSERT INTO public.device_locks (device_id, employee_id, candidate_name, last_used_at)
    VALUES (p_device_id, p_employee_id, COALESCE(p_candidate_name, ''), now())
    ON CONFLICT (device_id) DO UPDATE
      SET employee_id = EXCLUDED.employee_id,
          candidate_name = EXCLUDED.candidate_name,
          last_used_at = now();
    RETURN QUERY SELECT true, 0, COALESCE(p_candidate_name, '');
    RETURN;
  END IF;

  v_wait := GREATEST(
    0,
    CEIL(EXTRACT(EPOCH FROM (v_row.last_used_at + make_interval(mins => p_cooldown_minutes) - now())))::integer
  );

  IF v_wait > 0 THEN
    RETURN QUERY SELECT false, v_wait, v_row.candidate_name;
    RETURN;
  END IF;

  UPDATE public.device_locks
  SET employee_id = p_employee_id, candidate_name = COALESCE(p_candidate_name, ''), last_used_at = now()
  WHERE device_id = p_device_id;

  RETURN QUERY SELECT true, 0, COALESCE(p_candidate_name, '');
END;
$$;

REVOKE ALL ON FUNCTION public.claim_exam_device(text, uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_exam_device(text, uuid, text, integer) TO service_role;

-- 4) Index phục vụ bảng vinh danh (combo dài nhất, chăm chỉ nhất)
CREATE INDEX IF NOT EXISTS results_best_streak_idx ON public.results (best_streak DESC) WHERE disqualified = false;
CREATE INDEX IF NOT EXISTS results_employee_count_idx ON public.results (employee_id) WHERE disqualified = false;