ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS image_alt text NOT NULL DEFAULT '';
COMMENT ON COLUMN public.questions.image_alt IS 'Mô tả ảnh minh hoạ (alt) cho trình đọc màn hình.';