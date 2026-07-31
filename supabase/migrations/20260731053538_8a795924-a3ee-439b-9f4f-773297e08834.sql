ALTER TABLE public.exam_sessions
  ADD COLUMN IF NOT EXISTS submit_token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS answers jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS results_session_id_unique
  ON public.results (session_id) WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS exam_sessions_employee_idx
  ON public.exam_sessions (employee_id, started_at DESC);

CREATE INDEX IF NOT EXISTS results_employee_idx
  ON public.results (employee_id, submitted_at DESC);