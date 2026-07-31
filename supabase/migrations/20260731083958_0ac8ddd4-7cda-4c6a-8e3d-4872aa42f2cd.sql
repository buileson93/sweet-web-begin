CREATE TABLE public.device_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_key text NOT NULL DEFAULT '',
  path text NOT NULL DEFAULT '',
  browser text NOT NULL DEFAULT 'Khác',
  browser_version text NOT NULL DEFAULT '',
  os text NOT NULL DEFAULT 'Khác',
  os_version text NOT NULL DEFAULT '',
  device_type text NOT NULL DEFAULT 'desktop',
  screen_w integer NOT NULL DEFAULT 0,
  screen_h integer NOT NULL DEFAULT 0,
  viewport_w integer NOT NULL DEFAULT 0,
  viewport_h integer NOT NULL DEFAULT 0,
  pixel_ratio numeric NOT NULL DEFAULT 1,
  language text NOT NULL DEFAULT '',
  timezone text NOT NULL DEFAULT '',
  is_pwa boolean NOT NULL DEFAULT false,
  is_touch boolean NOT NULL DEFAULT false,
  referrer_host text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.device_visits TO anon;
GRANT SELECT, INSERT ON public.device_visits TO authenticated;
GRANT ALL ON public.device_visits TO service_role;

ALTER TABLE public.device_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can log a visit" ON public.device_visits
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "staff and admins read device visits" ON public.device_visits
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'editor'::app_role));

CREATE INDEX idx_device_visits_created_at ON public.device_visits (created_at DESC);
CREATE INDEX idx_device_visits_browser ON public.device_visits (browser, created_at DESC);
CREATE INDEX idx_device_visits_os ON public.device_visits (os, created_at DESC);
CREATE INDEX idx_device_visits_device_type ON public.device_visits (device_type, created_at DESC);
CREATE INDEX idx_device_visits_visitor_key ON public.device_visits (visitor_key, created_at DESC);