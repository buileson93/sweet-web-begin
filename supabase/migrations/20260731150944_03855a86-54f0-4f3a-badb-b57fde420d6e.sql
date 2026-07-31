DO $$
DECLARE v_secret text := 'fbca136ff66b40d13785d43c8e8b3fcdd531a711ec62781e3767eb1710e20e32';
BEGIN
  -- Watchdog Đấu trường: chạy mỗi phút, mỗi lần gọi 6 nhịp cách nhau 5 giây
  PERFORM cron.unschedule('arena-tick') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'arena-tick');
  PERFORM cron.schedule('arena-tick', '* * * * *',
    format($f$
      select net.http_post(url:='https://project--e18a9a92-c822-4f4e-aa3d-fe075ccaef3d.lovable.app/api/public/cron/dau-truong',headers:='{"Content-Type":"application/json","x-cron-secret":"%1$s"}'::jsonb,body:='{}'::jsonb);
      select pg_sleep(5);
      select net.http_post(url:='https://project--e18a9a92-c822-4f4e-aa3d-fe075ccaef3d.lovable.app/api/public/cron/dau-truong',headers:='{"Content-Type":"application/json","x-cron-secret":"%1$s"}'::jsonb,body:='{}'::jsonb);
      select pg_sleep(5);
      select net.http_post(url:='https://project--e18a9a92-c822-4f4e-aa3d-fe075ccaef3d.lovable.app/api/public/cron/dau-truong',headers:='{"Content-Type":"application/json","x-cron-secret":"%1$s"}'::jsonb,body:='{}'::jsonb);
      select pg_sleep(5);
      select net.http_post(url:='https://project--e18a9a92-c822-4f4e-aa3d-fe075ccaef3d.lovable.app/api/public/cron/dau-truong',headers:='{"Content-Type":"application/json","x-cron-secret":"%1$s"}'::jsonb,body:='{}'::jsonb);
      select pg_sleep(5);
      select net.http_post(url:='https://project--e18a9a92-c822-4f4e-aa3d-fe075ccaef3d.lovable.app/api/public/cron/dau-truong',headers:='{"Content-Type":"application/json","x-cron-secret":"%1$s"}'::jsonb,body:='{}'::jsonb);
      select pg_sleep(5);
      select net.http_post(url:='https://project--e18a9a92-c822-4f4e-aa3d-fe075ccaef3d.lovable.app/api/public/cron/dau-truong',headers:='{"Content-Type":"application/json","x-cron-secret":"%1$s"}'::jsonb,body:='{}'::jsonb);
    $f$, v_secret));
END $$;