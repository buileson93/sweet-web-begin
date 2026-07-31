-- =============================================================================
-- Tối ưu chỉ mục: thêm 4 chỉ mục thiếu, gỡ 8 chỉ mục trùng lặp.
-- Idempotent: chạy lại nhiều lần vẫn an toàn.
-- Mọi quyết định đều dựa trên EXPLAIN (ANALYZE, BUFFERS) trước/sau ở quy mô
-- 216k results / 240k exam_sessions / 20k questions / 150k login_attempts.
-- =============================================================================

-- --- 1. THÊM ------------------------------------------------------------------

-- startExamSession + submitExamSession: đếm lượt thi hợp lệ và tính bestPercent.
-- Trước: Bitmap trên idx_results_employee, 1.116 ms / 75 buffer
-- Sau:   Bitmap trên chỉ mục này,          0.220 ms / 11 buffer  (-80% thời gian)
CREATE INDEX IF NOT EXISTS idx_results_quiz_employee_valid
  ON public.results (quiz_id, employee_id)
  WHERE disqualified = false;

-- start_exam_session_tx: tìm phiên đang mở của nhân viên để đánh dấu bỏ dở.
-- Trước: BitmapAnd 2 chỉ mục (quét 24.000 dòng), 0.785 ms / 31 buffer
-- Sau:   Bitmap trên chỉ mục này,                0.144 ms / 11 buffer  (-82%)
CREATE INDEX IF NOT EXISTS idx_exam_sessions_employee_status
  ON public.exam_sessions (employee_id, status);

-- loadLivePage: bộ đếm "đang thi" (started_at >= T AND submitted_at IS NULL).
-- Đây là truy vấn chậm nhất đo được, chạy mỗi nhịp làm mới của Theo dõi trực tiếp.
-- Trước: Index Scan idx_exam_sessions_started_at, 12.889 ms / 579 buffer
-- Sau:   Index Scan trên chỉ mục riêng phần này,   0.100 ms / 2 buffer  (-99%)
CREATE INDEX IF NOT EXISTS idx_exam_sessions_open
  ON public.exam_sessions (started_at DESC)
  WHERE submitted_at IS NULL;

-- verifyEmployee: tra nhân viên đang hoạt động theo name_key.
-- Trước: idx_employees_name_key rồi lọc is_active, 0.133 ms / 3 buffer
-- Sau:   Index Scan riêng phần,                    0.072 ms / 2 buffer  (-46%)
CREATE INDEX IF NOT EXISTS idx_employees_name_key_active
  ON public.employees (name_key)
  WHERE is_active = true;

-- --- 2. GỠ CHỈ MỤC TRÙNG LẶP --------------------------------------------------
-- Các migration cũ bị chạy lặp hai lần nên sinh ra các cặp chỉ mục y hệt hoặc
-- là tiền tố của nhau. Đã đo lại toàn bộ 10 truy vấn nóng sau khi gỡ: không có
-- truy vấn nào đổi kế hoạch xấu đi.

-- results(session_id) — trùng hoàn toàn với UNIQUE results_session_id_unique
DROP INDEX IF EXISTS public.idx_results_session;
-- results(employee_id, submitted_at DESC) — bản sao của idx_results_employee
DROP INDEX IF EXISTS public.results_employee_idx;
-- results(quiz_id) — tiền tố của idx_results_quiz_submitted
DROP INDEX IF EXISTS public.results_quiz_idx;
-- exam_sessions(employee_id, started_at DESC) — bản sao của idx_exam_sessions_employee
DROP INDEX IF EXISTS public.exam_sessions_employee_idx;
-- exam_sessions(quiz_id) — tiền tố của idx_exam_sessions_quiz_started
DROP INDEX IF EXISTS public.exam_sessions_quiz_idx;
-- exam_sessions(status, expires_at) — giữ lại; job auto-submit vẫn dùng
-- employee_login_attempts(name_key, created_at DESC) — bản sao của idx_login_attempts_name_created
DROP INDEX IF EXISTS public.employee_login_attempts_idx;
-- questions(quiz_id) — tiền tố của idx_questions_quiz(quiz_id, is_archived)
DROP INDEX IF EXISTS public.questions_quiz_idx;
-- employees(name_key) — tiền tố của employees_lookup_idx(name_key, phone_last4)
-- và đã được thay bằng idx_employees_name_key_active ở trên
DROP INDEX IF EXISTS public.idx_employees_name_key;

-- --- 3. KHÔNG THÊM (đã có sẵn hoặc đo được là không cải thiện) ----------------
-- results(quiz_id, score DESC, time_seconds) WHERE disqualified=false
--   -> results_rank_idx (không riêng phần) đã đủ: 0.710 ms -> 0.661 ms (-7%),
--      56 -> 53 buffer. Chênh lệch nằm trong sai số, không đáng thêm chỉ mục.
-- results(session_id)
--   -> đã có UNIQUE riêng phần results_session_id_unique (dữ liệu không trùng:
--      6 dòng, 2 session_id khác nhau, 4 NULL, 0 trùng).
-- exam_sessions(status, expires_at)   -> đã có exam_sessions_status_expires_idx.
-- exam_sessions(started_at DESC)      -> đã có idx_exam_sessions_started_at.
-- employee_login_attempts(name_key, created_at DESC) -> đã có (thậm chí 2 bản).
-- questions(quiz_id, is_archived, difficulty)
--   -> đã thử, planner KHÔNG dùng: lấy pool trả về 2400/2500 dòng nên Bitmap Heap
--      Scan qua questions_quiz_difficulty_idx rẻ hơn. 3.519 ms -> 3.367 ms, cùng
--      597 buffer. Bốc đề theo blueprint đã có
--      questions_quiz_difficulty_idx (quiz_id, difficulty) WHERE is_archived=false.

ANALYZE public.results;
ANALYZE public.exam_sessions;
ANALYZE public.employees;
ANALYZE public.questions;