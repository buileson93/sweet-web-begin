ALTER TABLE public.results ADD COLUMN IF NOT EXISTS time_ms integer;
UPDATE public.results SET time_ms = time_seconds * 1000 WHERE time_ms IS NULL;