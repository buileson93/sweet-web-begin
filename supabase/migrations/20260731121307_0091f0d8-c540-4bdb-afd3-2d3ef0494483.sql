ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft';
ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS intro_markdown text NOT NULL DEFAULT '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quizzes_status_check'
  ) THEN
    ALTER TABLE public.quizzes
      ADD CONSTRAINT quizzes_status_check CHECK (status IN ('draft','published','closed'));
  END IF;
END $$;

UPDATE public.quizzes SET status = CASE WHEN is_active THEN 'published' ELSE 'draft' END
WHERE status = 'draft';

CREATE INDEX IF NOT EXISTS quizzes_status_idx ON public.quizzes (status);

CREATE TABLE IF NOT EXISTS public.quiz_audiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (quiz_id, unit_id)
);

GRANT SELECT ON public.quiz_audiences TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_audiences TO authenticated;
GRANT ALL ON public.quiz_audiences TO service_role;

ALTER TABLE public.quiz_audiences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quiz_audiences public read" ON public.quiz_audiences;
CREATE POLICY "quiz_audiences public read" ON public.quiz_audiences
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "quiz_audiences admin write" ON public.quiz_audiences;
CREATE POLICY "quiz_audiences admin write" ON public.quiz_audiences
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "quiz_audiences editor manage" ON public.quiz_audiences;
CREATE POLICY "quiz_audiences editor manage" ON public.quiz_audiences
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'editor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'editor'::app_role));

CREATE INDEX IF NOT EXISTS quiz_audiences_quiz_idx ON public.quiz_audiences (quiz_id);
