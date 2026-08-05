# Plan: Hiển thị Điểm liêm chính và Chi tiết vi phạm cho Quản trị viên

Người dùng yêu cầu kiểm tra xem điểm liêm chính đã được đưa vào phần quản trị chưa và có thể xem chi tiết các vi phạm (khi hover hoặc xem chi tiết) để quản trị viên đánh giá áp dụng. Yêu cầu nhấn mạnh không sửa UI và không tìm "language selector".

## Các thành phần hiện có
1.  **Hệ thống liêm chính (`src/lib/integrity.ts`)**: Đã có logic tính điểm, nhãn vi phạm (`EXAM_EVENT_LABEL`) và mô tả chi tiết (`describeExamEvent`).
2.  **Theo dõi trực tiếp (`src/components/admin/LiveMonitor.tsx`)**:
    *   Đã hiển thị "Điểm liêm chính" trong modal chi tiết phiên thi (dòng 292).
    *   Tuy nhiên, chưa hiển thị danh sách các sự kiện vi phạm cụ thể (`exam_events`) để quản trị viên biết *vì sao* có số điểm đó.
3.  **Quản lý kết quả (`src/components/admin/ResultManager.tsx`)**: Đã có cột "Liêm chính" trong bảng kết quả.
4.  **Server Functions (`src/lib/integrity.functions.ts`)**: Đã có `listExamEvents` để lấy danh sách vi phạm của một phiên.

## Các bước thực hiện

### 1. Cập nhật Modal Chi tiết trong LiveMonitor
*   Sử dụng `useQuery` để gọi `listExamEvents` khi mở modal chi tiết một phiên thi.
*   Hiển thị danh sách các sự kiện liêm chính (tên vi phạm, trọng số, thời điểm, và mô tả chi tiết từ `describeExamEvent`).
*   Thêm tooltip hoặc vùng hiển thị giải thích khi hover vào điểm số.

### 2. Cập nhật LiveMonitor (Danh sách tổng quát)
*   Hiển thị điểm liêm chính ngay tại bảng danh sách (ngoài modal) để admin nhận diện nhanh các phiên thi nghi vấn (ví dụ: đổi màu đỏ nếu điểm cao).

### 3. Đảm bảo dữ liệu đồng bộ
*   Kiểm tra lại trigger và logic server để đảm bảo `integrity_score` luôn được cập nhật chính xác vào `exam_sessions`.

## Câu hỏi làm rõ
1. Bạn muốn xem chi tiết vi phạm ngay khi hover vào điểm số ở bảng danh sách, hay chỉ cần xem đầy đủ trong modal "Chi tiết" là đủ?
2. Có cần phân loại màu sắc cho điểm liêm chính không? (Ví dụ: < 2 điểm màu xanh, 2-5 màu vàng, > 6 màu đỏ).
