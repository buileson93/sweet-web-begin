ALTER TABLE public.quizzes
  ADD COLUMN IF NOT EXISTS cover_fit text NOT NULL DEFAULT 'contain',
  ADD COLUMN IF NOT EXISTS peek_rewards text[] NOT NULL DEFAULT '{}'::text[];