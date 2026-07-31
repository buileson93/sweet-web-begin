-- Chỉ mục B-tree cho các truy vấn nóng
CREATE INDEX IF NOT EXISTS idx_exam_sessions_started_at ON public.exam_sessions (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_status_started ON public.exam_sessions (status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_quiz_started ON public.exam_sessions (quiz_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_submitted_at ON public.exam_sessions (submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_employee ON public.exam_sessions (employee_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_results_submitted_at ON public.results (submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_results_quiz_submitted ON public.results (quiz_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_results_unit ON public.results (unit);
CREATE INDEX IF NOT EXISTS idx_results_employee ON public.results (employee_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_results_session ON public.results (session_id);

CREATE INDEX IF NOT EXISTS idx_questions_quiz ON public.questions (quiz_id, is_archived);
CREATE INDEX IF NOT EXISTS idx_questions_quiz_difficulty ON public.questions (quiz_id, difficulty);
CREATE INDEX IF NOT EXISTS idx_questions_created_at ON public.questions (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_employees_name_key ON public.employees (name_key);
CREATE INDEX IF NOT EXISTS idx_employees_active_unit ON public.employees (is_active, unit_name);

CREATE INDEX IF NOT EXISTS idx_login_attempts_name_created ON public.employee_login_attempts (name_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles (user_id, role);
CREATE INDEX IF NOT EXISTS idx_quizzes_legacy_id ON public.quizzes (legacy_id);

ANALYZE public.exam_sessions;
ANALYZE public.results;
ANALYZE public.questions;
ANALYZE public.employees;