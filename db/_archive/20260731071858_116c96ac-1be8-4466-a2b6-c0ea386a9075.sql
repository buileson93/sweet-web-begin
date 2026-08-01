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

ALTER TABLE public.exam_sessions
  ADD COLUMN IF NOT EXISTS submit_token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS answers jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS results_session_id_unique
  ON public.results (session_id) WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS exam_sessions_employee_idx
  ON public.exam_sessions (employee_id, started_at DESC);

CREATE INDEX IF NOT EXISTS results_employee_idx
  ON public.results (employee_id, submitted_at DESC);

DO $$ BEGIN
  CREATE TYPE public.question_kind AS ENUM ('single', 'true_false', 'multi', 'fill_blank', 'matching', 'ordering');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.question_difficulty AS ENUM ('easy', 'medium', 'hard');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS kind public.question_kind NOT NULL DEFAULT 'single',
  ADD COLUMN IF NOT EXISTS correct_indices integer[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS accepted_answers text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS pairs jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS correct_order integer[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS difficulty public.question_difficulty NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS points integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS explanation text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS time_limit_seconds integer,
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS questions_quiz_difficulty_idx ON public.questions (quiz_id, difficulty) WHERE is_archived = false;
CREATE INDEX IF NOT EXISTS questions_tags_idx ON public.questions USING gin (tags);

ALTER TABLE public.quizzes
  ADD COLUMN IF NOT EXISTS pass_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shuffle_questions boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS room_password text,
  ADD COLUMN IF NOT EXISTS max_attempts integer,
  ADD COLUMN IF NOT EXISTS instant_feedback boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_fifty_fifty boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_skip boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS streak_bonus boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_question_map boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS negative_marking numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS blueprint jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.exam_sessions
  ADD COLUMN IF NOT EXISTS helpers jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS best_streak integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS points integer NOT NULL DEFAULT 0;

ALTER TABLE public.results
  ADD COLUMN IF NOT EXISTS points integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_points integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS best_streak integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS passed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS breakdown jsonb NOT NULL DEFAULT '[]'::jsonb;