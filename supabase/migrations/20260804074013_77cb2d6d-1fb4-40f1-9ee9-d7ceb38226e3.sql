CREATE OR REPLACE FUNCTION public.bump_integrity(p_session uuid, p_weight integer)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE public.exam_sessions
  SET integrity_score = integrity_score + GREATEST(0, coalesce(p_weight, 0))
  WHERE id = p_session
  RETURNING integrity_score;
$$;

REVOKE ALL ON FUNCTION public.bump_integrity(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bump_integrity(uuid, integer) TO service_role;