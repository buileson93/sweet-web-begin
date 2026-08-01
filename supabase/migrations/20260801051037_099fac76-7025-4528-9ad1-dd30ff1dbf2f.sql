INSERT INTO private.app_config (key, value)
VALUES ('cron_secret', encode(extensions.gen_random_bytes(32), 'hex'))
ON CONFLICT (key) DO UPDATE SET value = encode(extensions.gen_random_bytes(32), 'hex'), updated_at = now();

INSERT INTO private.app_config (key, value)
VALUES ('app_base_url', 'https://project--e18a9a92-c822-4f4e-aa3d-fe075ccaef3d.lovable.app')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

CREATE OR REPLACE FUNCTION public.verify_cron_secret(p_secret text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = private, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM private.app_config
    WHERE key = 'cron_secret' AND value = coalesce(p_secret, '')
  );
$$;

REVOKE ALL ON FUNCTION public.verify_cron_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_cron_secret(text) TO service_role;

DO $$
BEGIN
  PERFORM cron.unschedule('auto-submit-expired-exams') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-submit-expired-exams');
  PERFORM cron.unschedule('cleanup-question-images') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-question-images');
  PERFORM cron.unschedule('arena-tick') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'arena-tick');

  PERFORM cron.schedule('auto-submit-expired-exams', '*/5 * * * *',
    $c$select private.cron_post('/api/public/cron/auto-submit');$c$);
  PERFORM cron.schedule('cleanup-question-images', '0 3 * * *',
    $c$select private.cron_post('/api/public/cron/don-anh');$c$);
  PERFORM cron.schedule('arena-tick', '* * * * *',
    $c$
      select private.cron_post('/api/public/cron/dau-truong');
      select pg_sleep(5);
      select private.cron_post('/api/public/cron/dau-truong');
      select pg_sleep(5);
      select private.cron_post('/api/public/cron/dau-truong');
      select pg_sleep(5);
      select private.cron_post('/api/public/cron/dau-truong');
      select pg_sleep(5);
      select private.cron_post('/api/public/cron/dau-truong');
      select pg_sleep(5);
      select private.cron_post('/api/public/cron/dau-truong');
    $c$);
END $$;
