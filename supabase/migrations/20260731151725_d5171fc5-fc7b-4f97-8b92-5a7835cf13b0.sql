-- Publication đang dùng danh sách cột, nên replica identity FULL khiến mọi UPDATE trên results bị từ chối.
-- Chuyển về replica identity mặc định (khoá chính) — cột id đã nằm trong danh sách publication.
ALTER TABLE public.results REPLICA IDENTITY DEFAULT;