-- Gỡ nốt các chỉ mục trùng với ràng buộc UNIQUE hoặc trùng hoàn toàn với nhau.
-- Không mất khả năng tra cứu: index UNIQUE tương ứng phục vụ y hệt.

-- user_roles(user_id, role) — trùng hoàn toàn UNIQUE user_roles_user_id_role_key
DROP INDEX IF EXISTS public.idx_user_roles_user;

-- quizzes(legacy_id) — trùng hoàn toàn UNIQUE quizzes_legacy_id_key
DROP INDEX IF EXISTS public.idx_quizzes_legacy_id;

-- audit_logs(created_at DESC) — bản sao y hệt của audit_logs_created_at_idx
DROP INDEX IF EXISTS public.idx_audit_logs_created_at;

ANALYZE public.user_roles;
ANALYZE public.quizzes;
ANALYZE public.audit_logs;