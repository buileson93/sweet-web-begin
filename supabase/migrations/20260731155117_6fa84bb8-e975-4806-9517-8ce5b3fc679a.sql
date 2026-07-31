ALTER TABLE public.duel_answers ADD COLUMN IF NOT EXISTS skill text NOT NULL DEFAULT '';
ALTER TABLE public.duel_players ADD COLUMN IF NOT EXISTS misses integer NOT NULL DEFAULT 0;
UPDATE public.arena_settings SET default_seconds = LEAST(default_seconds, 15) WHERE default_seconds > 15;