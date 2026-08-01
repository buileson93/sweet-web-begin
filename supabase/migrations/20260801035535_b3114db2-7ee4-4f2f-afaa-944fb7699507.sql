-- ============ Leo Tháp Tri Thức: nền dữ liệu (Giai đoạn 0 + 1) ============
-- Chỉ TẠO MỚI. Không sửa bảng thi (exam_sessions/results/questions/quizzes).

-- 1) review_log — nhật ký trả lời, append-only
CREATE TABLE IF NOT EXISTS public.review_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  question_id uuid,
  correct boolean NOT NULL DEFAULT false,
  fraction numeric NOT NULL DEFAULT 0,
  ms_taken integer NOT NULL DEFAULT 0,
  mode text NOT NULL DEFAULT 'exam',
  tags text[] NOT NULL DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT ALL ON public.review_log TO service_role;
ALTER TABLE public.review_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS review_log_employee_created_idx
  ON public.review_log (employee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS review_log_question_idx
  ON public.review_log (question_id);

-- 2) learner_cards — trái tim của lịch ôn (tạo lười, khoá chính kép)
CREATE TABLE IF NOT EXISTS public.learner_cards (
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  box smallint NOT NULL DEFAULT 1,
  next_due_at timestamp with time zone NOT NULL DEFAULT now(),
  lapses integer NOT NULL DEFAULT 0,
  reps integer NOT NULL DEFAULT 0,
  last_reviewed_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (employee_id, question_id)
);
GRANT ALL ON public.learner_cards TO service_role;
ALTER TABLE public.learner_cards ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS learner_cards_due_idx
  ON public.learner_cards (employee_id, next_due_at);

-- 3) tower_runs — phiên leo tháp
CREATE TABLE IF NOT EXISTS public.tower_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  quiz_id uuid REFERENCES public.quizzes(id) ON DELETE SET NULL,
  seed text NOT NULL DEFAULT '',
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  stage_index integer NOT NULL DEFAULT 0,
  hp integer NOT NULL DEFAULT 100,
  correct integer NOT NULL DEFAULT 0,
  answered integer NOT NULL DEFAULT 0,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  finished_at timestamp with time zone
);
GRANT ALL ON public.tower_runs TO service_role;
ALTER TABLE public.tower_runs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS tower_runs_employee_idx
  ON public.tower_runs (employee_id, started_at DESC);
CREATE INDEX IF NOT EXISTS tower_runs_active_idx
  ON public.tower_runs (employee_id) WHERE status = 'active';

-- 4) tower_run_events — nhật ký chi tiết phiên
CREATE TABLE IF NOT EXISTS public.tower_run_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES public.tower_runs(id) ON DELETE CASCADE,
  seq integer NOT NULL DEFAULT 0,
  kind text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT ALL ON public.tower_run_events TO service_role;
ALTER TABLE public.tower_run_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS tower_run_events_run_idx
  ON public.tower_run_events (run_id, seq);

-- 5) topic_ratings — Elo theo chủ đề
CREATE TABLE IF NOT EXISTS public.topic_ratings (
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  tag text NOT NULL,
  rating integer NOT NULL DEFAULT 1000,
  games integer NOT NULL DEFAULT 0,
  correct integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (employee_id, tag)
);
GRANT ALL ON public.topic_ratings TO service_role;
ALTER TABLE public.topic_ratings ENABLE ROW LEVEL SECURITY;

-- 6) Cập nhật lô thẻ ghi nhớ theo Leitner (một lượt đi về cho cả chặng)
CREATE OR REPLACE FUNCTION public.tower_apply_reviews(p_employee_id uuid, p_items jsonb)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH items AS (
    SELECT
      (i->>'questionId')::uuid AS question_id,
      coalesce((i->>'correct')::boolean, false) AS correct
    FROM jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) AS i
    WHERE (i->>'questionId') IS NOT NULL
  )
  INSERT INTO public.learner_cards AS c
    (employee_id, question_id, box, next_due_at, lapses, reps, last_reviewed_at)
  SELECT
    p_employee_id,
    question_id,
    CASE WHEN correct THEN 2 ELSE 1 END,
    now() + CASE WHEN correct THEN interval '3 days' ELSE interval '1 day' END,
    CASE WHEN correct THEN 0 ELSE 1 END,
    1,
    now()
  FROM items
  ON CONFLICT (employee_id, question_id) DO UPDATE SET
    box = CASE WHEN EXCLUDED.lapses = 0 THEN least(c.box + 1, 5) ELSE 1 END,
    next_due_at = now() + (
      CASE
        WHEN EXCLUDED.lapses > 0 THEN 1
        WHEN least(c.box + 1, 5) = 2 THEN 3
        WHEN least(c.box + 1, 5) = 3 THEN 7
        WHEN least(c.box + 1, 5) = 4 THEN 16
        WHEN least(c.box + 1, 5) = 5 THEN 35
        ELSE 1
      END || ' days')::interval,
    lapses = c.lapses + EXCLUDED.lapses,
    reps = c.reps + 1,
    last_reviewed_at = now();
$function$;

REVOKE ALL ON FUNCTION public.tower_apply_reviews(uuid, jsonb) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tower_apply_reviews(uuid, jsonb) TO service_role;