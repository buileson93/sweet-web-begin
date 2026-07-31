-- =============================================================================
-- BASELINE SCHEMA — Hệ thống thi trắc nghiệm nội bộ VATM
-- Sinh từ trạng thái schema THỰC TẾ của CSDL tại 2026-07-31 (đọc từ pg_catalog).
-- Thay thế toàn bộ các migration liệt kê trong db/_archive/README.md.
--
-- MÔI TRƯỜNG ĐÃ DEPLOY : KHÔNG chạy lại file này (schema đã ở đúng trạng thái).
-- MÔI TRƯỜNG MỚI       : chỉ cần chạy duy nhất file này.
--
-- File viết idempotent (IF NOT EXISTS / DROP ... IF EXISTS) nên chạy lại an toàn.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. EXTENSION
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- -----------------------------------------------------------------------------
-- 2. KIỂU LIỆT KÊ
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'user', 'staff', 'editor');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.question_kind AS ENUM
    ('single', 'true_false', 'multi', 'fill_blank', 'matching', 'ordering');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.question_difficulty AS ENUM ('easy', 'medium', 'hard');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- -----------------------------------------------------------------------------
-- 3. BẢNG
-- -----------------------------------------------------------------------------

-- 3.1 Phân quyền (BẮT BUỘC tách riêng khỏi bảng hồ sơ để tránh leo thang đặc quyền)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- 3.2 Đơn vị
CREATE TABLE IF NOT EXISTS public.units (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3.3 Nhân viên (danh sách dự thi)
CREATE TABLE IF NOT EXISTS public.employees (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name   text NOT NULL,
  name_key    text NOT NULL,
  position    text,
  unit_name   text,
  birth_date  date,
  phone       text,
  phone_last4 text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 3.4 Nhật ký đăng nhập thí sinh (chống dò tên)
CREATE TABLE IF NOT EXISTS public.employee_login_attempts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_key   text NOT NULL,
  success    boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3.5 Cuộc thi
CREATE TABLE IF NOT EXISTS public.quizzes (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id            text UNIQUE,
  title                text NOT NULL,
  description          text NOT NULL DEFAULT ''::text,
  start_time           timestamptz,
  end_time             timestamptz,
  is_active            boolean NOT NULL DEFAULT true,
  question_count       integer NOT NULL DEFAULT 20,
  duration_minutes     integer NOT NULL DEFAULT 20,
  shuffle_options      boolean NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  pass_percent         integer NOT NULL DEFAULT 50,
  shuffle_questions    boolean NOT NULL DEFAULT true,
  room_password        text,
  max_attempts         integer,
  instant_feedback     boolean NOT NULL DEFAULT false,
  allow_fifty_fifty    boolean NOT NULL DEFAULT false,
  allow_skip           boolean NOT NULL DEFAULT false,
  streak_bonus         boolean NOT NULL DEFAULT true,
  show_question_map    boolean NOT NULL DEFAULT true,
  negative_marking     numeric NOT NULL DEFAULT 0,
  blueprint            jsonb NOT NULL DEFAULT '{}'::jsonb,
  strict_mode          boolean NOT NULL DEFAULT false,
  disqualify_threshold integer NOT NULL DEFAULT 6
);

-- Điểm đạt LUÔN tính theo PHẦN TRĂM (0-100).
ALTER TABLE public.quizzes DROP CONSTRAINT IF EXISTS quizzes_pass_percent_range;
ALTER TABLE public.quizzes
  ADD CONSTRAINT quizzes_pass_percent_range CHECK (pass_percent >= 0 AND pass_percent <= 100);
COMMENT ON COLUMN public.quizzes.pass_percent IS
  'Mức điểm đạt tính theo phần trăm số câu đúng (0-100). 0 = dùng mặc định 50%.';

-- 3.6 Ngân hàng câu hỏi
CREATE TABLE IF NOT EXISTS public.questions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id            uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  question           text NOT NULL,
  options            text[] NOT NULL,
  correct_index      integer NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  image_url          text,
  kind               public.question_kind NOT NULL DEFAULT 'single'::public.question_kind,
  correct_indices    integer[] NOT NULL DEFAULT '{}'::integer[],
  accepted_answers   text[] NOT NULL DEFAULT '{}'::text[],
  pairs              jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_order      integer[] NOT NULL DEFAULT '{}'::integer[],
  difficulty         public.question_difficulty NOT NULL DEFAULT 'medium'::public.question_difficulty,
  tags               text[] NOT NULL DEFAULT '{}'::text[],
  points             integer NOT NULL DEFAULT 1,
  explanation        text NOT NULL DEFAULT ''::text,
  time_limit_seconds integer,
  is_archived        boolean NOT NULL DEFAULT false,
  order_index        integer NOT NULL DEFAULT 0,
  CONSTRAINT questions_correct_index_check CHECK (correct_index >= 0 AND correct_index <= 3)
);
COMMENT ON COLUMN public.questions.order_index IS
  'Thứ tự hiển thị ổn định trong cuộc thi; dùng khi quizzes.shuffle_questions = false.';

-- 3.7 Phiên thi
CREATE TABLE IF NOT EXISTS public.exam_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id         uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  candidate_name  text NOT NULL,
  birth_year      text NOT NULL DEFAULT ''::text,
  unit            text NOT NULL DEFAULT ''::text,
  question_ids    uuid[] NOT NULL,
  option_orders   jsonb NOT NULL DEFAULT '[]'::jsonb,
  started_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL,
  submitted_at    timestamptz,
  status          text NOT NULL DEFAULT 'active'::text,
  employee_id     uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  submit_token    uuid NOT NULL DEFAULT gen_random_uuid(),
  answers         jsonb NOT NULL DEFAULT '{}'::jsonb,
  helpers         jsonb NOT NULL DEFAULT '{}'::jsonb,
  best_streak     integer NOT NULL DEFAULT 0,
  points          integer NOT NULL DEFAULT 0,
  answers_seq     integer NOT NULL DEFAULT 0,
  integrity_score integer NOT NULL DEFAULT 0
);
COMMENT ON COLUMN public.exam_sessions.answers_seq IS
  'Số thứ tự lần lưu tạm đáp án gần nhất (chống ghi lùi khi mạng chậm).';

-- 3.8 Kết quả
CREATE TABLE IF NOT EXISTS public.results (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        uuid REFERENCES public.exam_sessions(id) ON DELETE SET NULL,
  quiz_id           uuid REFERENCES public.quizzes(id) ON DELETE CASCADE,
  quiz_title        text NOT NULL DEFAULT ''::text,
  candidate_name    text NOT NULL,
  birth_year        text NOT NULL DEFAULT ''::text,
  unit              text NOT NULL DEFAULT ''::text,
  score             integer NOT NULL DEFAULT 0,
  total             integer NOT NULL DEFAULT 0,
  time_seconds      integer NOT NULL DEFAULT 0,
  disqualified      boolean NOT NULL DEFAULT false,
  disqualify_reason text,
  submitted_at      timestamptz NOT NULL DEFAULT now(),
  employee_id       uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  points            integer NOT NULL DEFAULT 0,
  max_points        integer NOT NULL DEFAULT 0,
  best_streak       integer NOT NULL DEFAULT 0,
  passed            boolean NOT NULL DEFAULT false,
  breakdown         jsonb NOT NULL DEFAULT '[]'::jsonb,
  late_submit       boolean NOT NULL DEFAULT false,
  integrity_score   integer,
  restored_by       uuid,
  restored_at       timestamptz
);
COMMENT ON COLUMN public.results.late_submit IS
  'True khi bài nộp sau expires_at + ân hạn; đáp án gửi từ máy khách bị bỏ qua.';

-- 3.9 Sự kiện giám sát tính toàn vẹn bài thi
CREATE TABLE IF NOT EXISTS public.exam_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.exam_sessions(id) ON DELETE CASCADE,
  kind       text NOT NULL,
  weight     integer NOT NULL DEFAULT 1,
  detail     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exam_events_kind_check CHECK (kind = ANY (ARRAY[
    'tab_hidden', 'window_blur', 'copy', 'paste', 'contextmenu',
    'fullscreen_exit', 'resize_suspect', 'reconnect', 'multi_tab'
  ]))
);

-- 3.10 Nhật ký thao tác quản trị
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_email  text NOT NULL DEFAULT ''::text,
  action       text NOT NULL,
  entity       text NOT NULL,
  entity_id    text,
  entity_label text NOT NULL DEFAULT ''::text,
  details      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- 3.11 Thống kê thiết bị / trình duyệt
CREATE TABLE IF NOT EXISTS public.device_visits (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_key     text NOT NULL DEFAULT ''::text,
  path            text NOT NULL DEFAULT ''::text,
  browser         text NOT NULL DEFAULT 'Khác'::text,
  browser_version text NOT NULL DEFAULT ''::text,
  os              text NOT NULL DEFAULT 'Khác'::text,
  os_version      text NOT NULL DEFAULT ''::text,
  device_type     text NOT NULL DEFAULT 'desktop'::text,
  screen_w        integer NOT NULL DEFAULT 0,
  screen_h        integer NOT NULL DEFAULT 0,
  viewport_w      integer NOT NULL DEFAULT 0,
  viewport_h      integer NOT NULL DEFAULT 0,
  pixel_ratio     numeric NOT NULL DEFAULT 1,
  language        text NOT NULL DEFAULT ''::text,
  timezone        text NOT NULL DEFAULT ''::text,
  is_pwa          boolean NOT NULL DEFAULT false,
  is_touch        boolean NOT NULL DEFAULT false,
  referrer_host   text NOT NULL DEFAULT ''::text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  ip              text NOT NULL DEFAULT ''::text,
  ip_source       text NOT NULL DEFAULT ''::text
);

-- -----------------------------------------------------------------------------
-- 4. HÀM
-- -----------------------------------------------------------------------------

-- 4.1 Kiểm tra vai trò (SECURITY DEFINER để tránh đệ quy RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- 4.2 Cập nhật updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- 4.3 Tài khoản đầu tiên trở thành admin, còn lại là user
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;
  RETURN NEW;
END;
$$;

-- 4.4 Mở phiên thi trong một giao dịch có khoá tư vấn (chống đua lượt thi)
CREATE OR REPLACE FUNCTION public.start_exam_session_tx(
  p_quiz_id uuid,
  p_employee_id uuid,
  p_max_attempts int,
  p_question_ids uuid[],
  p_option_orders jsonb,
  p_expires_at timestamptz,
  p_candidate_name text,
  p_birth_year text,
  p_unit text
)
RETURNS TABLE (session_id uuid, submit_token uuid, attempts int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_attempts int;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_quiz_id::text || p_employee_id::text, 0));

  SELECT count(*) INTO v_attempts
  FROM public.results r
  WHERE r.quiz_id = p_quiz_id
    AND r.employee_id = p_employee_id
    AND r.disqualified = false;

  IF p_max_attempts > 0 AND v_attempts >= p_max_attempts THEN
    RAISE EXCEPTION 'MAX_ATTEMPTS_REACHED';
  END IF;

  UPDATE public.exam_sessions s
  SET status = 'abandoned', submitted_at = now()
  WHERE s.employee_id = p_employee_id
    AND s.status = 'active'
    AND s.submitted_at IS NULL;

  RETURN QUERY
  INSERT INTO public.exam_sessions (
    quiz_id, candidate_name, birth_year, unit, employee_id,
    question_ids, option_orders, expires_at
  ) VALUES (
    p_quiz_id,
    p_candidate_name,
    COALESCE(p_birth_year, ''),
    COALESCE(NULLIF(p_unit, ''), 'Chưa cập nhật'),
    p_employee_id,
    p_question_ids,
    p_option_orders,
    p_expires_at
  )
  RETURNING public.exam_sessions.id, public.exam_sessions.submit_token, v_attempts;
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. TRIGGER
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS quizzes_touch ON public.quizzes;
CREATE TRIGGER quizzes_touch BEFORE UPDATE ON public.quizzes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS questions_touch ON public.questions;
CREATE TRIGGER questions_touch BEFORE UPDATE ON public.questions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS update_employees_updated_at ON public.employees;
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- 6. CHỈ MỤC
-- -----------------------------------------------------------------------------

-- user_roles
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles (user_id, role);

-- employees
CREATE INDEX IF NOT EXISTS employees_lookup_idx          ON public.employees (name_key, phone_last4);
CREATE INDEX IF NOT EXISTS employees_unit_idx            ON public.employees (unit_name);
CREATE INDEX IF NOT EXISTS idx_employees_active_unit     ON public.employees (is_active, unit_name);
-- verifyEmployee: tra nhân viên đang hoạt động theo tên (0.133 ms -> 0.072 ms)
CREATE INDEX IF NOT EXISTS idx_employees_name_key_active ON public.employees (name_key) WHERE is_active = true;

-- employee_login_attempts
CREATE INDEX IF NOT EXISTS idx_login_attempts_name_created ON public.employee_login_attempts (name_key, created_at DESC);

-- quizzes
CREATE INDEX IF NOT EXISTS idx_quizzes_legacy_id ON public.quizzes (legacy_id);

-- questions
CREATE INDEX IF NOT EXISTS questions_quiz_order_idx      ON public.questions (quiz_id, order_index, created_at);
CREATE INDEX IF NOT EXISTS questions_quiz_difficulty_idx ON public.questions (quiz_id, difficulty) WHERE is_archived = false;
CREATE INDEX IF NOT EXISTS questions_tags_idx            ON public.questions USING gin (tags);
CREATE INDEX IF NOT EXISTS idx_questions_quiz            ON public.questions (quiz_id, is_archived);
CREATE INDEX IF NOT EXISTS idx_questions_quiz_difficulty ON public.questions (quiz_id, difficulty);
CREATE INDEX IF NOT EXISTS idx_questions_created_at      ON public.questions (created_at DESC);

-- exam_sessions
CREATE INDEX IF NOT EXISTS exam_sessions_status_expires_idx  ON public.exam_sessions (status, expires_at);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_employee        ON public.exam_sessions (employee_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_quiz_started    ON public.exam_sessions (quiz_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_started_at      ON public.exam_sessions (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_status_started  ON public.exam_sessions (status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_submitted_at    ON public.exam_sessions (submitted_at DESC);
-- start_exam_session_tx: phiên đang mở của nhân viên (0.785 ms -> 0.144 ms)
CREATE INDEX IF NOT EXISTS idx_exam_sessions_employee_status ON public.exam_sessions (employee_id, status);
-- loadLivePage: bộ đếm "đang thi" (12.889 ms -> 0.100 ms, 579 -> 2 buffer)
CREATE INDEX IF NOT EXISTS idx_exam_sessions_open            ON public.exam_sessions (started_at DESC) WHERE submitted_at IS NULL;

-- results
CREATE UNIQUE INDEX IF NOT EXISTS results_session_id_unique ON public.results (session_id) WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS results_rank_idx           ON public.results (quiz_id, score DESC, time_seconds);
CREATE INDEX IF NOT EXISTS idx_results_employee       ON public.results (employee_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_results_quiz_submitted ON public.results (quiz_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_results_submitted_at   ON public.results (submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_results_unit           ON public.results (unit);
-- startExamSession/submitExamSession: đếm lượt hợp lệ + bestPercent (1.116 ms -> 0.220 ms)
CREATE INDEX IF NOT EXISTS idx_results_quiz_employee_valid ON public.results (quiz_id, employee_id) WHERE disqualified = false;


-- exam_events
CREATE INDEX IF NOT EXISTS exam_events_session_created_idx ON public.exam_events (session_id, created_at);

-- audit_logs
CREATE INDEX IF NOT EXISTS audit_logs_user_idx       ON public.audit_logs (user_id);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC);

-- device_visits
CREATE INDEX IF NOT EXISTS device_visits_ip_idx          ON public.device_visits (ip);
CREATE INDEX IF NOT EXISTS idx_device_visits_created_at  ON public.device_visits (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_device_visits_browser     ON public.device_visits (browser, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_device_visits_os          ON public.device_visits (os, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_device_visits_device_type ON public.device_visits (device_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_device_visits_visitor_key ON public.device_visits (visitor_key, created_at DESC);

-- -----------------------------------------------------------------------------
-- 7. RLS — bật trên MỌI bảng của schema public
-- -----------------------------------------------------------------------------
ALTER TABLE public.user_roles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_sessions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.results                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_events             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_visits           ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 8. GRANT trên bảng
--    exam_sessions, exam_events, employee_login_attempts KHÔNG có policy nào
--    => RLS chặn sạch anon/authenticated; chỉ service_role (bỏ qua RLS, dùng
--    trong server function) truy cập được.
-- -----------------------------------------------------------------------------
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;

-- results / quizzes: anon CHỈ đọc được các cột an toàn (không lộ room_password,
-- birth_year, breakdown, disqualify_reason...).
REVOKE SELECT ON public.results FROM anon;
GRANT SELECT (
  id, quiz_id, quiz_title, candidate_name, unit, score, total, time_seconds,
  disqualified, submitted_at, points, max_points, best_streak, passed
) ON public.results TO anon;

REVOKE SELECT ON public.quizzes FROM anon;
GRANT SELECT (
  id, legacy_id, title, description, start_time, end_time, is_active,
  question_count, duration_minutes, shuffle_options, shuffle_questions,
  pass_percent, max_attempts, instant_feedback, allow_fifty_fifty, allow_skip,
  streak_bonus, show_question_map, negative_marking, blueprint,
  created_at, updated_at
) ON public.quizzes TO anon;

-- device_visits: ghi lượt truy cập đi qua server function (service_role),
-- không cho máy khách ghi trực tiếp.
REVOKE INSERT ON public.device_visits FROM anon, authenticated;

-- -----------------------------------------------------------------------------
-- 9. POLICY
-- -----------------------------------------------------------------------------

-- 9.1 user_roles
DROP POLICY IF EXISTS "own roles readable" ON public.user_roles;
CREATE POLICY "own roles readable" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "admins read all roles" ON public.user_roles;
CREATE POLICY "admins read all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins grant roles" ON public.user_roles;
CREATE POLICY "admins grant roles" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins revoke roles" ON public.user_roles;
CREATE POLICY "admins revoke roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND user_id <> auth.uid());

-- 9.2 units
DROP POLICY IF EXISTS "units public read" ON public.units;
CREATE POLICY "units public read" ON public.units
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "units admin write" ON public.units;
CREATE POLICY "units admin write" ON public.units
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "units editor manage" ON public.units;
CREATE POLICY "units editor manage" ON public.units
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'editor'))
  WITH CHECK (public.has_role(auth.uid(), 'editor'));

-- 9.3 quizzes
DROP POLICY IF EXISTS "quizzes public read" ON public.quizzes;
CREATE POLICY "quizzes public read" ON public.quizzes
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "quizzes admin write" ON public.quizzes;
CREATE POLICY "quizzes admin write" ON public.quizzes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "quizzes editor manage" ON public.quizzes;
CREATE POLICY "quizzes editor manage" ON public.quizzes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'editor'))
  WITH CHECK (public.has_role(auth.uid(), 'editor'));

-- 9.4 questions — KHÔNG có policy đọc cho anon: đáp án đúng không bao giờ
--     được gửi thẳng xuống máy khách.
DROP POLICY IF EXISTS "questions admin only" ON public.questions;
CREATE POLICY "questions admin only" ON public.questions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "questions editor manage" ON public.questions;
CREATE POLICY "questions editor manage" ON public.questions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'editor'))
  WITH CHECK (public.has_role(auth.uid(), 'editor'));

-- 9.5 results
DROP POLICY IF EXISTS "results public read" ON public.results;
CREATE POLICY "results public read" ON public.results
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "results staff read" ON public.results;
CREATE POLICY "results staff read" ON public.results
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'staff')
    OR public.has_role(auth.uid(), 'editor')
  );

DROP POLICY IF EXISTS "results admin write" ON public.results;
CREATE POLICY "results admin write" ON public.results
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 9.6 employees
DROP POLICY IF EXISTS "Staff and admins can view employees" ON public.employees;
CREATE POLICY "Staff and admins can view employees" ON public.employees
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')
  );

DROP POLICY IF EXISTS "Admins can insert employees" ON public.employees;
CREATE POLICY "Admins can insert employees" ON public.employees
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update employees" ON public.employees;
CREATE POLICY "Admins can update employees" ON public.employees
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete employees" ON public.employees;
CREATE POLICY "Admins can delete employees" ON public.employees
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 9.7 audit_logs
DROP POLICY IF EXISTS "Users insert their own audit logs" ON public.audit_logs;
CREATE POLICY "Users insert their own audit logs" ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins and staff can read audit logs" ON public.audit_logs;
CREATE POLICY "Admins and staff can read audit logs" ON public.audit_logs
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')
  );

DROP POLICY IF EXISTS "Editors can read audit logs" ON public.audit_logs;
CREATE POLICY "Editors can read audit logs" ON public.audit_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'editor'));

-- 9.8 device_visits (quyền INSERT của anon/authenticated đã bị thu hồi ở mục 8)
DROP POLICY IF EXISTS "anyone can log a visit" ON public.device_visits;
CREATE POLICY "anyone can log a visit" ON public.device_visits
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "staff and admins read device visits" ON public.device_visits;
CREATE POLICY "staff and admins read device visits" ON public.device_visits
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'staff')
    OR public.has_role(auth.uid(), 'editor')
  );

-- 9.9 exam_sessions, exam_events, employee_login_attempts:
--     CỐ Ý không có policy nào => chỉ service_role truy cập được.

-- -----------------------------------------------------------------------------
-- 10. GRANT trên hàm
-- -----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.touch_updated_at() TO service_role;

REVOKE ALL ON FUNCTION public.handle_new_user_role() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user_role() TO service_role;

REVOKE ALL ON FUNCTION public.start_exam_session_tx(uuid, uuid, int, uuid[], jsonb, timestamptz, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_exam_session_tx(uuid, uuid, int, uuid[], jsonb, timestamptz, text, text, text)
  TO service_role;

-- -----------------------------------------------------------------------------
-- 11. STORAGE — bucket ảnh câu hỏi (riêng tư)
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('question-images', 'question-images', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Admin staff can read question images" ON storage.objects;
CREATE POLICY "Admin staff can read question images" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'question-images'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))
  );

DROP POLICY IF EXISTS "Admin staff can upload question images" ON storage.objects;
CREATE POLICY "Admin staff can upload question images" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'question-images'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))
  );

DROP POLICY IF EXISTS "Admin staff can update question images" ON storage.objects;
CREATE POLICY "Admin staff can update question images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'question-images'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))
  )
  WITH CHECK (
    bucket_id = 'question-images'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))
  );

DROP POLICY IF EXISTS "Admin staff can delete question images" ON storage.objects;
CREATE POLICY "Admin staff can delete question images" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'question-images'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))
  );

-- -----------------------------------------------------------------------------
-- 12. REALTIME — chỉ phát các cột an toàn của bảng results
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime SET TABLE public.results (
    id, quiz_id, quiz_title, candidate_name, unit, score, total, time_seconds,
    disqualified, submitted_at, points, max_points, best_streak, passed
  );
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- =============================================================================
-- HẾT BASELINE
-- =============================================================================
