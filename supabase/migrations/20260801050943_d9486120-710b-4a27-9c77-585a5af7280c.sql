CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.app_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
REVOKE ALL ON private.app_config FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;
GRANT ALL ON private.app_config TO service_role;

ALTER TABLE private.app_config ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION private.cron_post(p_path text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public, extensions
AS $$
DECLARE
  v_secret text;
  v_base text;
BEGIN
  SELECT value INTO v_secret FROM private.app_config WHERE key = 'cron_secret';
  SELECT value INTO v_base FROM private.app_config WHERE key = 'app_base_url';
  IF v_secret IS NULL OR v_base IS NULL THEN
    RAISE NOTICE 'Chua cau hinh cron_secret/app_base_url';
    RETURN;
  END IF;
  PERFORM net.http_post(
    url := rtrim(v_base, '/') || p_path,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    body := '{}'::jsonb
  );
END;
$$;

REVOKE ALL ON FUNCTION private.cron_post(text) FROM PUBLIC, anon, authenticated;
