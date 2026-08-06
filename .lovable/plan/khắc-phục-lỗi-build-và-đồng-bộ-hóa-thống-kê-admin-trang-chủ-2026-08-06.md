# Khắc phục lỗi build và đồng bộ hóa thống kê Admin/Trang chủ

## 1. Sửa lỗi build (Unexpected JSX expression)
Lỗi build xảy ra tại `src/components/admin/UnitStats.tsx` do cú pháp ép kiểu `as DistributionBucket[]` bị đặt sai vị trí hoặc gây lỗi trong quá trình transform của Vite/TanStack Start khi nằm trong một biểu thức JSX hoặc gán biến có điều kiện phức tạp.
- **Giải pháp:** Tách biệt việc ép kiểu và khởi tạo giá trị mặc định cho `distribution` để cú pháp rõ ràng hơn.

## 2. Đồng bộ hóa thống kê tham gia ở Danh sách cuộc thi (Trang chủ)
Người dùng phản hồi số lượng người tham gia ở danh sách cuộc thi cuối trang chủ không đúng.
- **Vấn đề:** `getPublicParticipationRates` đang đếm số `employee_id` duy nhất từ `exam_sessions`. Tuy nhiên, nếu một kỳ thi cho phép thí sinh tự do (không có `employee_id`) hoặc logic đếm chưa bao quát hết các trạng thái, số liệu sẽ bị lệch.
- **Giải pháp:** 
    - Cập nhật `getPublicParticipationRates` để sử dụng `candidate_quiz_stats` làm nguồn dữ liệu chính cho `done` (số người đã nộp).
    - Cập nhật `quizStatsQuery` trong `src/routes/index.tsx` để lấy `passed` count chính xác hơn từ server thay vì filter client-side (giúp tránh giới hạn 1000 bản ghi của Supabase).

## 3. Rà soát Thống kê Admin (Thiết bị & Trình duyệt)
- **Vấn đề:** `DeviceStats.tsx` đang sử dụng vòng lặp để fetch tối đa 50.000 bản ghi (`MAX = 50000`). Điều này có thể gây treo trình duyệt hoặc quá tải nếu dữ liệu lớn.
- **Giải pháp:** 
    - Giới hạn lại số lượng bản ghi hiển thị mặc định.
    - Đảm bảo các bảng thống kê (Browser, OS, IP) luôn phản ánh đúng tỉ lệ trên tổng số dữ liệu tải về.

## Các bước thực hiện:

1.  **Sửa `src/components/admin/UnitStats.tsx`**: Khắc phục lỗi cú pháp JSX/Typescript gây crash build.
2.  **Sửa `src/lib/participationRate.functions.ts`**: Cập nhật logic `getPublicParticipationRates` để sử dụng `candidate_quiz_stats`.
3.  **Cập nhật `src/routes/index.tsx`**:
    - Sửa text thông tin theo yêu cầu người dùng.
    - Tối ưu `quizStatsQuery` để lấy dữ liệu từ server function thay vì truy vấn Supabase trực tiếp với filter client.
4.  **Kiểm tra `src/components/admin/DeviceStats.tsx`**: Đảm bảo hiệu năng khi xử lý dữ liệu lớn.
