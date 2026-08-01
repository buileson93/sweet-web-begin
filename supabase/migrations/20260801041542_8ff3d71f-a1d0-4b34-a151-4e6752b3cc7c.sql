CREATE TABLE IF NOT EXISTS public.tower_progress (
  employee_id uuid PRIMARY KEY REFERENCES public.employees(id) ON DELETE CASCADE,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  runs integer NOT NULL DEFAULT 0,
  best_stage integer NOT NULL DEFAULT 0,
  coins integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.tower_progress TO service_role;

ALTER TABLE public.tower_progress ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS touch_tower_progress ON public.tower_progress;
CREATE TRIGGER touch_tower_progress
  BEFORE UPDATE ON public.tower_progress
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();