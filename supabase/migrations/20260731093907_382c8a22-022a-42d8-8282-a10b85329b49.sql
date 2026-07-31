CREATE TABLE IF NOT EXISTS public.exam_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.exam_sessions(id) ON DELETE CASCADE,
  kind text NOT NULL,
  weight int NOT NULL DEFAULT 1,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE public.exam_events ADD CONSTRAINT exam_events_kind_check CHECK (kind IN (
    'tab_hidden','window_blur','copy','paste','contextmenu','fullscreen_exit','resize_suspect','reconnect','multi_tab'
  ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS exam_events_session_created_idx ON public.exam_events (session_id, created_at);

GRANT ALL ON public.exam_events TO service_role;
ALTER TABLE public.exam_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.exam_sessions ADD COLUMN IF NOT EXISTS integrity_score int NOT NULL DEFAULT 0;
ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS strict_mode boolean NOT NULL DEFAULT false;
ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS disqualify_threshold int NOT NULL DEFAULT 6;
ALTER TABLE public.results ADD COLUMN IF NOT EXISTS integrity_score int;
ALTER TABLE public.results ADD COLUMN IF NOT EXISTS restored_by uuid;
ALTER TABLE public.results ADD COLUMN IF NOT EXISTS restored_at timestamptz;