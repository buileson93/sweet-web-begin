ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS option_explanations text[] NOT NULL DEFAULT '{}'::text[];