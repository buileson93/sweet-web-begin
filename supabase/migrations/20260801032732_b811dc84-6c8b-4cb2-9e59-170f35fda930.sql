-- 1) Khoá chuẩn hoá cho câu hỏi (chống trùng toàn hệ thống)
CREATE OR REPLACE FUNCTION public.question_norm_key(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT btrim(regexp_replace(
    lower(translate(
      regexp_replace(normalize(coalesce(p_text, ''), NFD), '[' || U&'\0300' || '-' || U&'\036F' || ']', '', 'g'),
      'đĐ', 'dD'
    )),
    '\s+', ' ', 'g'
  ))
$$;

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS norm_key text
  GENERATED ALWAYS AS (public.question_norm_key(question)) STORED;

CREATE INDEX IF NOT EXISTS questions_norm_key_idx ON public.questions (norm_key);

-- 2) Thống kê độ khó thực tế theo dữ liệu bài thi
CREATE TABLE IF NOT EXISTS public.question_stats (
  question_id uuid PRIMARY KEY REFERENCES public.questions(id) ON DELETE CASCADE,
  attempts integer NOT NULL DEFAULT 0,
  correct integer NOT NULL DEFAULT 0,
  partial integer NOT NULL DEFAULT 0,
  blank integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.question_stats TO authenticated;
GRANT ALL ON public.question_stats TO service_role;
ALTER TABLE public.question_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "question_stats_read_staff" ON public.question_stats;
DROP POLICY IF EXISTS "question_stats_read_staff" ON public.question_stats;
CREATE POLICY "question_stats_read_staff" ON public.question_stats
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));

CREATE OR REPLACE FUNCTION public.bump_question_stats(p_items jsonb)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.question_stats AS s (question_id, attempts, correct, partial, blank, updated_at)
  SELECT
    (item->>'id')::uuid,
    1,
    CASE WHEN (item->>'fraction')::numeric >= 1 THEN 1 ELSE 0 END,
    CASE WHEN (item->>'fraction')::numeric > 0 AND (item->>'fraction')::numeric < 1 THEN 1 ELSE 0 END,
    CASE WHEN coalesce((item->>'answered')::boolean, false) THEN 0 ELSE 1 END,
    now()
  FROM jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) AS item
  ON CONFLICT (question_id) DO UPDATE SET
    attempts = s.attempts + EXCLUDED.attempts,
    correct = s.correct + EXCLUDED.correct,
    partial = s.partial + EXCLUDED.partial,
    blank = s.blank + EXCLUDED.blank,
    updated_at = now();
$$;

REVOKE ALL ON FUNCTION public.bump_question_stats(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bump_question_stats(jsonb) TO service_role;

-- 3) Lịch sử phiên bản câu hỏi
CREATE TABLE IF NOT EXISTS public.question_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL,
  quiz_id uuid,
  version integer NOT NULL DEFAULT 1,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS question_versions_question_idx
  ON public.question_versions (question_id, created_at DESC);

GRANT SELECT ON public.question_versions TO authenticated;
GRANT ALL ON public.question_versions TO service_role;
ALTER TABLE public.question_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "question_versions_read_staff" ON public.question_versions;
DROP POLICY IF EXISTS "question_versions_read_staff" ON public.question_versions;
CREATE POLICY "question_versions_read_staff" ON public.question_versions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));

CREATE OR REPLACE FUNCTION public.snapshot_question_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next integer;
BEGIN
  IF OLD.question IS NOT DISTINCT FROM NEW.question
     AND OLD.options IS NOT DISTINCT FROM NEW.options
     AND OLD.correct_index IS NOT DISTINCT FROM NEW.correct_index
     AND OLD.correct_indices IS NOT DISTINCT FROM NEW.correct_indices
     AND OLD.accepted_answers IS NOT DISTINCT FROM NEW.accepted_answers
     AND OLD.pairs IS NOT DISTINCT FROM NEW.pairs
     AND OLD.correct_order IS NOT DISTINCT FROM NEW.correct_order
     AND OLD.explanation IS NOT DISTINCT FROM NEW.explanation
     AND OLD.option_explanations IS NOT DISTINCT FROM NEW.option_explanations
     AND OLD.image_url IS NOT DISTINCT FROM NEW.image_url
     AND OLD.difficulty IS NOT DISTINCT FROM NEW.difficulty
     AND OLD.points IS NOT DISTINCT FROM NEW.points THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(max(version), 0) + 1 INTO v_next
  FROM public.question_versions WHERE question_id = OLD.id;

  INSERT INTO public.question_versions (question_id, quiz_id, version, snapshot)
  VALUES (OLD.id, OLD.quiz_id, v_next, to_jsonb(OLD) - 'norm_key');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS questions_snapshot_version ON public.questions;
CREATE TRIGGER questions_snapshot_version
  BEFORE UPDATE ON public.questions
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_question_version();