ALTER TABLE public.duels ADD COLUMN IF NOT EXISTS hp_start integer NOT NULL DEFAULT 100;
ALTER TABLE public.duel_players ADD COLUMN IF NOT EXISTS hp integer NOT NULL DEFAULT 100;
ALTER TABLE public.duel_players ADD COLUMN IF NOT EXISTS damage_dealt integer NOT NULL DEFAULT 0;
ALTER TABLE public.duel_answers ADD COLUMN IF NOT EXISTS damage integer NOT NULL DEFAULT 0;
ALTER TABLE public.duel_answers ADD COLUMN IF NOT EXISTS first_correct boolean NOT NULL DEFAULT false;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS players_last_seen_idx ON public.players (last_seen_at DESC);
CREATE INDEX IF NOT EXISTS duel_players_employee_joined_idx ON public.duel_players (employee_id, joined_at DESC);
CREATE INDEX IF NOT EXISTS duel_answers_duel_round_idx ON public.duel_answers (duel_id, round_index);