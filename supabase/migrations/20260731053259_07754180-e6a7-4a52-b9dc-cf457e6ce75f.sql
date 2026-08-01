CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_email text NOT NULL DEFAULT '',
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text,
  entity_label text NOT NULL DEFAULT '',
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_user_idx ON public.audit_logs (user_id);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins and staff can read audit logs" ON public.audit_logs;
CREATE POLICY "Admins and staff can read audit logs"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
DROP POLICY IF EXISTS "Users insert their own audit logs" ON public.audit_logs;
CREATE POLICY "Users insert their own audit logs"
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.results REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'results'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.results';
  END IF;
END $$;

CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  name_key text NOT NULL,
  position text,
  unit_name text,
  birth_date date,
  phone text,
  phone_last4 text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX employees_lookup_idx ON public.employees (name_key, phone_last4);
CREATE INDEX employees_unit_idx ON public.employees (unit_name);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff and admins can view employees" ON public.employees;
CREATE POLICY "Staff and admins can view employees"
  ON public.employees FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
DROP POLICY IF EXISTS "Admins can insert employees" ON public.employees;
CREATE POLICY "Admins can insert employees"
  ON public.employees FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins can update employees" ON public.employees;
CREATE POLICY "Admins can update employees"
  ON public.employees FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins can delete employees" ON public.employees;
CREATE POLICY "Admins can delete employees"
  ON public.employees FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.employee_login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_key text NOT NULL,
  success boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX employee_login_attempts_idx ON public.employee_login_attempts (name_key, created_at DESC);
GRANT ALL ON public.employee_login_attempts TO service_role;
ALTER TABLE public.employee_login_attempts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.exam_sessions ADD COLUMN IF NOT EXISTS employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL;
ALTER TABLE public.results ADD COLUMN IF NOT EXISTS employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS image_url text;

DROP POLICY IF EXISTS "Admin staff can read question images" ON storage.objects;
CREATE POLICY "Admin staff can read question images"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'question-images' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')));
DROP POLICY IF EXISTS "Admin staff can upload question images" ON storage.objects;
CREATE POLICY "Admin staff can upload question images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'question-images' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')));
DROP POLICY IF EXISTS "Admin staff can update question images" ON storage.objects;
CREATE POLICY "Admin staff can update question images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'question-images' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')))
WITH CHECK (bucket_id = 'question-images' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')));
DROP POLICY IF EXISTS "Admin staff can delete question images" ON storage.objects;
CREATE POLICY "Admin staff can delete question images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'question-images' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')));