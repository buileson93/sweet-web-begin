CREATE OR REPLACE FUNCTION public.start_exam_session_tx(
  p_quiz_id uuid,
  p_employee_id uuid,
  p_max_attempts int,
  p_question_ids uuid[],
  p_option_orders jsonb,
  p_expires_at timestamptz,
  p_candidate_name text,
  p_birth_year text,
  p_unit text
)
RETURNS TABLE (session_id uuid, submit_token uuid, attempts int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempts int;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_quiz_id::text || p_employee_id::text, 0));

  SELECT count(*) INTO v_attempts
  FROM public.results r
  WHERE r.quiz_id = p_quiz_id
    AND r.employee_id = p_employee_id
    AND r.disqualified = false;

  IF p_max_attempts > 0 AND v_attempts >= p_max_attempts THEN
    RAISE EXCEPTION 'MAX_ATTEMPTS_REACHED';
  END IF;

  UPDATE public.exam_sessions s
  SET status = 'abandoned', submitted_at = now()
  WHERE s.employee_id = p_employee_id
    AND s.status = 'active'
    AND s.submitted_at IS NULL;

  RETURN QUERY
  INSERT INTO public.exam_sessions (
    quiz_id, candidate_name, birth_year, unit, employee_id,
    question_ids, option_orders, expires_at
  ) VALUES (
    p_quiz_id,
    p_candidate_name,
    COALESCE(p_birth_year, ''),
    COALESCE(NULLIF(p_unit, ''), 'Chưa cập nhật'),
    p_employee_id,
    p_question_ids,
    p_option_orders,
    p_expires_at
  )
  RETURNING public.exam_sessions.id, public.exam_sessions.submit_token, v_attempts;
END;
$$;

REVOKE ALL ON FUNCTION public.start_exam_session_tx(uuid, uuid, int, uuid[], jsonb, timestamptz, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_exam_session_tx(uuid, uuid, int, uuid[], jsonb, timestamptz, text, text, text) TO service_role;