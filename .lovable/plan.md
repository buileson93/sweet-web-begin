# Khắc phục thống kê Admin (Thống kê đơn vị)

Vấn đề: "Thống kê theo đơn vị" hiển thị dữ liệu không khớp với thực tế. Nguyên nhân là do logic tính toán đang gộp (aggregate) lượt thi từ `candidate_quiz_stats` nhưng tính điểm trung bình từ `results` (giới hạn 50k bản ghi), dẫn đến sai lệch khi có nhiều lượt thi hoặc nhân viên không được gán đúng ID.

## Giải pháp

1.  **Chuẩn hóa UnitStats Logic (`src/lib/unitStats.functions.ts`):**
    *   Sử dụng `candidate_quiz_stats` làm nguồn duy nhất để đếm "Lượt thi" và "Số thí sinh".
    *   Tính toán "Điểm trung bình", "Tỉ lệ đạt" và "Điểm cao nhất" bằng cách sử dụng các hàm SQL Aggregation (như `AVG`, `MAX`, `COUNT`) trực tiếp trên bảng `results` theo `unit`.
    *   Loại bỏ việc tải hàng chục ngàn bản ghi về client/server function để tính toán thủ công bằng JS.

2.  **Cập nhật UI (`src/components/admin/UnitStats.tsx`):**
    *   Đảm bảo biểu đồ và bảng hiển thị đồng bộ.
    *   Phân bố điểm (Distribution) cũng sẽ được tính toán bằng SQL thay vì `results.limit(50000)`.

3.  **Rà soát dữ liệu (Data Integrity):**
    *   Đảm bảo `unit` trong bảng `results` và `candidate_quiz_stats` được TRIM và xử lý nhất quán (vì hiện tại đang có sự lệch nhẹ giữa `unit` và `unit_name`).

## Các bước thực hiện

1.  **Tạo server function SQL-based mới** trong `unitStats.functions.ts` để lấy thống kê đơn vị tập hợp sẵn từ DB.
2.  **Cập nhật `UnitStats.tsx`** để gọi function mới này.
3.  **Tối ưu hóa query phân bố điểm** bằng cách sử dụng `bucket` hoặc `case when` trong SQL.

