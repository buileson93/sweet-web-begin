DROP FUNCTION IF EXISTS public.start_exam_session_tx(uuid, uuid, integer, uuid[], jsonb, timestamptz, text, text, text);

REVOKE ALL ON FUNCTION public.start_exam_session_tx(uuid, uuid, integer, uuid[], jsonb, timestamptz, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_exam_session_tx(uuid, uuid, integer, uuid[], jsonb, timestamptz, text, text, text, jsonb) TO service_role;