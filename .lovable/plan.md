# Plan: Khắc phục thống kê Admin (Kết quả dự thi & Nhắc nhở tham gia) và Hiển thị liêm chính

Người dùng phản hồi rằng các trang admin hiện tại ("Kết quả dự thi" và "Nhắc nhở tham gia") không hiển thị dữ liệu chính xác trên toàn bộ database (bị giới hạn 1000 bản ghi, không tìm kiếm được toàn bộ). Cần giải pháp đảm bảo hiệu năng nhưng phải phản ánh đúng thực tế:
1. Thống kê được danh sách người đã làm bài, người tham gia nhưng chưa đạt chuẩn (dưới 50%) trong từng cuộc thi cụ thể.
2. Tích hợp các chỉ số liêm chính (chống script) vào giao diện admin để truy vết.

## Các bước thực hiện

### 1. Tối ưu hóa "Kết quả dự thi" (Admin Results)
*   Chuyển từ fetch client-side giới hạn 1000 sang **Server-side Pagination & Search** sử dụng `createServerFn`.
*   Thay vì tải toàn bộ, sẽ thực hiện query `count` tổng số bản ghi và chỉ fetch trang hiện tại (ví dụ 50 bản ghi/trang).
*   Thực hiện tìm kiếm (tên, đơn vị) trực tiếp trên Postgres để đảm bảo tìm thấy mọi thí sinh dù database có hàng chục ngàn dòng.
*   Hiển thị cột **Điểm liêm chính** và cho phép click/hover xem chi tiết các vi phạm kỹ thuật (Script violation logs).

### 2. Sửa đổi "Nhắc nhở tham gia" (Participation Reminder)
*   Sử dụng bảng `candidate_quiz_stats` làm nguồn dữ liệu chính để đối soát với danh sách `employees`.
*   Phân loại rõ ràng:
    *   **Đã đạt**: Có kết quả >= 50%.
    *   **Chưa đạt**: Đã thi nhưng điểm cao nhất < 50%.
    *   **Chưa tham gia**: Chưa có bản ghi nào trong `exam_sessions` cho cuộc thi đó.
*   Đảm bảo bộ lọc theo "Cuộc thi" (Quiz ID) hoạt động chính xác trên toàn bộ danh sách nhân sự.

### 3. Hiển thị dữ liệu liêm chính & Truy vết Script
*   Tích hợp `listExamEvents` vào modal chi tiết của từng phiên thi.
*   Hiển thị rõ các bằng chứng hành vi: `pixel_perfect_clicks` (tọa độ click trùng khít), `robotic_trajectory` (di chuyển robot), `unnatural_click`.
*   Sử dụng `describeExamEvent` để admin dễ dàng đọc hiểu lý do bị trừ điểm liêm chính.

### 4. Đảm bảo Hiệu năng (Performance)
*   Sử dụng Index trên các cột `quiz_id`, `employee_id`, `status` và `score`.
*   Sử dụng `useSuspenseQuery` kết hợp với `placeholderData` để UI mượt mà khi chuyển trang.

## Câu hỏi làm rõ
1. Bạn muốn xuất Excel cho toàn bộ danh sách "Nhắc nhở tham gia" (gồm cả người chưa thi) hay chỉ cần hiển thị trên web?
2. Trong phần "Kết quả dự thi", bạn có muốn lọc nhanh theo "Mức độ liêm chính thấp" (Nghi vấn script) không?
