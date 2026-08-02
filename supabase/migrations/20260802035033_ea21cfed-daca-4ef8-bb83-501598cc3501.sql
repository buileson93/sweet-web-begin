-- Bảng tiếp nhận báo lỗi / góp ý từ người dùng
CREATE TABLE IF NOT EXISTS public.bug_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  kind text NOT NULL DEFAULT 'bug',
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  contact text NOT NULL DEFAULT '',
  reporter_name text NOT NULL DEFAULT '',
  path text NOT NULL DEFAULT '',
  shot_path text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'new',
  admin_note text NOT NULL DEFAULT '',
  resolved_at timestamptz,
  device jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_agent text NOT NULL DEFAULT '',
  ip text NOT NULL DEFAULT '',
  ip_source text NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS bug_reports_created_idx ON public.bug_reports (created_at DESC);
CREATE INDEX IF NOT EXISTS bug_reports_status_idx ON public.bug_reports (status, created_at DESC);

GRANT SELECT, UPDATE, DELETE ON public.bug_reports TO authenticated;
GRANT ALL ON public.bug_reports TO service_role;

ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin đọc báo lỗi" ON public.bug_reports;
CREATE POLICY "Admin đọc báo lỗi" ON public.bug_reports
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admin cập nhật báo lỗi" ON public.bug_reports;
CREATE POLICY "Admin cập nhật báo lỗi" ON public.bug_reports
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admin xoá báo lỗi" ON public.bug_reports;
CREATE POLICY "Admin xoá báo lỗi" ON public.bug_reports
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Thu thập thêm thông tin thiết bị cho thống kê
ALTER TABLE public.device_visits
  ADD COLUMN IF NOT EXISTS device_model text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS platform_version text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS architecture text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cpu_cores integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS memory_gb numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS network_type text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS downlink numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS save_data boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS user_agent text NOT NULL DEFAULT '';