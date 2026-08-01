ALTER TABLE public.arena_settings
  ADD COLUMN IF NOT EXISTS tower_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS tower_locked_until timestamptz;