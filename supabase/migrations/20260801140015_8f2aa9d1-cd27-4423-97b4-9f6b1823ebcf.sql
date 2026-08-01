CREATE TABLE IF NOT EXISTS public.tower_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  unit text NOT NULL DEFAULT '',
  board text NOT NULL DEFAULT 'tu-do',
  day_key text NOT NULL DEFAULT '',
  seed text NOT NULL DEFAULT '',
  score integer NOT NULL DEFAULT 0,
  floors integer NOT NULL DEFAULT 0,
  hp integer NOT NULL DEFAULT 0,
  relics text[] NOT NULL DEFAULT '{}',
  curses text[] NOT NULL DEFAULT '{}',
  ascension integer NOT NULL DEFAULT 0,
  win boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.tower_scores TO service_role;

ALTER TABLE public.tower_scores ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS tower_scores_board_idx ON public.tower_scores (board, day_key, score DESC);
CREATE INDEX IF NOT EXISTS tower_scores_employee_idx ON public.tower_scores (employee_id, created_at DESC);

DELETE FROM public.tower_run_events;
DELETE FROM public.tower_runs;
DELETE FROM public.tower_progress;