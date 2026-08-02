ALTER TABLE public.carousel_events
  ADD COLUMN IF NOT EXISTS card_labels text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS clicked_label text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS carousel_events_visitor_time_idx
  ON public.carousel_events (visitor_key, created_at DESC);

CREATE INDEX IF NOT EXISTS carousel_events_created_idx
  ON public.carousel_events (created_at DESC);

CREATE OR REPLACE FUNCTION public.prune_carousel_events(p_days integer DEFAULT 90)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_n integer;
BEGIN
  DELETE FROM public.carousel_events
  WHERE created_at < now() - make_interval(days => GREATEST(1, coalesce(p_days, 90)));
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

REVOKE ALL ON FUNCTION public.prune_carousel_events(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_carousel_events(integer) TO service_role;