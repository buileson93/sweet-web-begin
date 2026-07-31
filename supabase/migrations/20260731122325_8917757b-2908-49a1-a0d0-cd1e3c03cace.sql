ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS option_images text[] NOT NULL DEFAULT '{}'::text[];