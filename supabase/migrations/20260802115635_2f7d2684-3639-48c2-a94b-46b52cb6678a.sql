
CREATE TABLE IF NOT EXISTS public.result_events (
  id bigserial PRIMARY KEY,
  quiz_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.result_events TO anon;
GRANT SELECT ON public.result_events TO authenticated;
GRANT ALL ON public.result_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.result_events_id_seq TO service_role;

ALTER TABLE public.result_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "result_events public read" ON public.result_events;
CREATE POLICY "result_events public read" ON public.result_events
  FOR SELECT TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS result_events_created_idx ON public.result_events (created_at DESC);

CREATE OR REPLACE FUNCTION public.emit_result_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.result_events (quiz_id) VALUES (NEW.quiz_id);
  DELETE FROM public.result_events WHERE created_at < now() - interval '2 days';
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.emit_result_event() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS results_emit_event ON public.results;
CREATE TRIGGER results_emit_event
  AFTER INSERT ON public.results
  FOR EACH ROW EXECUTE FUNCTION public.emit_result_event();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='results') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.results;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='duels') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.duels;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='duel_players') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.duel_players;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='result_events') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.result_events;
  END IF;
END $$;
