-- Chính sách đọc công khai chỉ dành cho khách ẩn danh (bảng xếp hạng),
-- người đã đăng nhập phải có vai trò quản trị/kỹ thuật/biên soạn mới xem kết quả.
DROP POLICY IF EXISTS "results public read" ON public.results;

CREATE POLICY "results public read"
ON public.results
FOR SELECT
TO anon
USING (true);