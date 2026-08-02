CREATE TABLE IF NOT EXISTS public.carousel_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  label text NOT NULL DEFAULT '',
  path text NOT NULL DEFAULT '',
  total_cards integer NOT NULL DEFAULT 0,
  viewed_cards integer NOT NULL DEFAULT 0,
  max_index integer NOT NULL DEFAULT 0,
  swipes integer NOT NULL DEFAULT 0,
  dwell_ms integer NOT NULL DEFAULT 0,
  clicked boolean NOT NULL DEFAULT false,
  clicked_index integer NOT NULL DEFAULT -1,
  device_type text NOT NULL DEFAULT '',
  visitor_key text NOT NULL DEFAULT ''
);

GRANT ALL ON public.carousel_events TO service_role;
GRANT SELECT ON public.carousel_events TO authenticated;

ALTER TABLE public.carousel_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "carousel_events_admin_select" ON public.carousel_events;
CREATE POLICY "carousel_events_admin_select" ON public.carousel_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS carousel_events_created_idx ON public.carousel_events (created_at DESC);
CREATE INDEX IF NOT EXISTS carousel_events_label_idx ON public.carousel_events (label, created_at DESC);