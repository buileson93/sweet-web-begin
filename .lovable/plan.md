# Plan: Hiển thị Điểm liêm chính và Truy vết các hành vi chống Script cho Admin

Người dùng yêu cầu đưa các nâng cấp chống script mới (như behavior tracker, click coordinates, robotic movement...) vào hiển thị điểm liêm chính để quản trị viên có thể xem và truy vết các hành vi gian lận một cách trực quan. Yêu cầu nhấn mạnh không sửa UI không liên quan và tập trung vào việc giúp admin biết rõ vi phạm gì đã xảy ra.

## Các thành phần hiện có
1.  **Hệ thống liêm chính (`src/lib/integrity.ts`)**: Đã có logic tính điểm, nhãn vi phạm (`EXAM_EVENT_LABEL`) và mô tả chi tiết (`describeExamEvent`).
2.  **Theo dõi trực tiếp (`src/components/admin/LiveMonitor.tsx`)**:
    *   Đã hiển thị "Điểm liêm chính" trong modal chi tiết phiên thi (dòng 292).
    *   Tuy nhiên, chưa hiển thị danh sách các sự kiện vi phạm cụ thể (`exam_events`) để quản trị viên biết *vì sao* có số điểm đó.
3.  **Quản lý kết quả (`src/components/admin/ResultManager.tsx`)**: Đã có cột "Liêm chính" trong bảng kết quả.
4.  **Server Functions (`src/lib/integrity.functions.ts`)**: Đã có `listExamEvents` để lấy danh sách vi phạm của một phiên.

## Các bước thực hiện

### 1. Hiển thị chi tiết vi phạm (Behavioral Traces) trong Modal Chi tiết
*   Tích hợp danh sách từ `listExamEvents` vào modal chi tiết của `LiveMonitor`.
*   Hiển thị rõ các loại vi phạm mới: `pixel_perfect_clicks` (click trùng tọa độ), `robotic_trajectory` (đường di chuyển thẳng tắp), `unnatural_click` (click quá xa tâm nút).
*   Sử dụng hàm `describeExamEvent` (từ `src/lib/integrity.ts`) để giải thích bằng tiếng Việt dễ hiểu cho admin.

### 2. Cập nhật LiveMonitor (Danh sách tổng quát)
*   Hiển thị điểm liêm chính ngay tại bảng danh sách (ngoài modal) để admin nhận diện nhanh các phiên thi nghi vấn (ví dụ: đổi màu đỏ nếu điểm cao).

### 3. Đảm bảo dữ liệu truy vết (Audit Trail)
*   Kiểm tra việc ghi log từ `src/lib/exam/scriptGuard.server.ts` vào bảng `exam_events` đã đầy đủ các thông số kỹ thuật (tọa độ, khoảng cách thời gian) chưa.
*   Đảm bảo `integrity_score` tổng hợp đúng các vi phạm kỹ thuật này để admin có cái nhìn tổng quan nhanh nhất.
