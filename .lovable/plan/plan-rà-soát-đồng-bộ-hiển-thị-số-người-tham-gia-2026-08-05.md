# Plan - Rà soát đồng bộ hiển thị số người tham gia

Đồng bộ hóa cách hiển thị số lượng người tham gia trên toàn bộ ứng dụng (Trang chủ, Bảng xếp hạng, Thống kê Admin) để đảm bảo tính nhất quán giữa số người đã thi, số người đạt và chưa đạt.

## Các thay đổi chính

### 1. Cập nhật Trang chủ (`src/routes/index.tsx`)
- Thay đổi mô tả hoặc tooltip tại khu vực thống kê để giải thích rõ số lượng "Lượt thi" và "Trực tiếp" (đạt/chưa đạt).
- Đảm bảo các con số này khớp với dữ liệu thực tế từ `candidate_quiz_stats`.

### 2. Cập nhật Bảng xếp hạng (`src/routes/bang-xep-hang.tsx`)
- Thay đổi văn bản mô tả tại header (hiện đang là "Tôi đã triển khai giải pháp tối ưu hóa...") thành nội dung rà soát đồng bộ theo yêu cầu.
- Hiển thị rõ ràng tổng số người đã tham gia, trong đó bao nhiêu người đạt và bao nhiêu người chưa đạt để tránh gây hiểu lầm khi bảng xếp hạng chỉ hiện danh sách đạt.

### 3. Cập nhật Thống kê Đơn vị (`src/components/admin/UnitStats.tsx`)
- Rà soát logic đếm `attempts` và `candidates` để đảm bảo không bỏ sót các bản ghi "chưa đạt" khi tính toán tổng quan đơn vị.

### 4. Kiểm tra Server Functions (`src/lib/adminStats.functions.ts`)
- Đảm bảo `getQuizStatsSummary` trả về đầy đủ các trường `passedCount`, `failedCount`, `submittedCount` và `totalAttempts` một cách chính xác.

## Các bước thực hiện

1.  **Chỉnh sửa `src/routes/bang-xep-hang.tsx`**: Thay đổi đoạn text giới thiệu và phần hiển thị metadata để đồng bộ số liệu người tham gia.
2.  **Chỉnh sửa `src/routes/index.tsx`**: Cập nhật lại các nhãn (labels) và tooltip ở phần thống kê nhanh.
3.  **Chỉnh sửa `src/components/admin/UnitStats.tsx`**: Cập nhật chú thích biểu đồ để nhấn mạnh việc bao gồm cả người chưa đạt.
4.  **Kiểm tra lại toàn bộ**: Truy cập các trang để xác nhận các con số đã được đồng bộ và hiển thị rõ ràng.

## Phê duyệt
Vui lòng xem qua kế hoạch này trước khi tôi bắt đầu thực hiện các thay đổi mã nguồn.
