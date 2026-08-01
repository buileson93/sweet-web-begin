DROP POLICY IF EXISTS "anyone can log a visit" ON public.device_visits;
REVOKE INSERT ON public.device_visits FROM anon, authenticated;
GRANT ALL ON public.device_visits TO service_role;

REVOKE ALL ON FUNCTION public.snapshot_question_version() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.snapshot_question_version() TO service_role;