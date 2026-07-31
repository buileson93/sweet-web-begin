ALTER TABLE public.device_visits
  ADD COLUMN IF NOT EXISTS ip text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ip_source text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS device_visits_ip_idx ON public.device_visits (ip);

DROP POLICY IF EXISTS "device_visits anon insert" ON public.device_visits;
DROP POLICY IF EXISTS "device_visits insert" ON public.device_visits;
DROP POLICY IF EXISTS "device_visits public insert" ON public.device_visits;
DROP POLICY IF EXISTS "Anyone can log a visit" ON public.device_visits;

REVOKE INSERT ON public.device_visits FROM anon, authenticated;
GRANT ALL ON public.device_visits TO service_role;