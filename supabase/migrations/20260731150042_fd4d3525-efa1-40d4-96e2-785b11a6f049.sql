ALTER TABLE public.duels ADD COLUMN IF NOT EXISTS last_result jsonb;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS quests jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS blocked boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.arena_settings (
  id boolean PRIMARY KEY DEFAULT true,
  enabled boolean NOT NULL DEFAULT true,
  default_rounds integer NOT NULL DEFAULT 10,
  default_seconds integer NOT NULL DEFAULT 20,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT arena_settings_single CHECK (id)
);
INSERT INTO public.arena_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.arena_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.arena_settings FROM anon, authenticated;
GRANT ALL ON public.arena_settings TO service_role;
GRANT SELECT ON public.arena_settings TO authenticated;
DROP POLICY IF EXISTS "arena_settings_admin_read" ON public.arena_settings;
CREATE POLICY "arena_settings_admin_read" ON public.arena_settings
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));