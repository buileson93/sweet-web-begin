# Kế hoạch Đồng bộ hóa Thống kê Tham gia

Người dùng báo cáo rằng mục "Tình hình dự thi" trong chi tiết cuộc thi không đồng bộ và hiển thị sai số liệu (ví dụ: hiển thị 232 người đã thi trong khi thực tế có hơn 400 người đã nộp bài). Nguyên nhân là do thành phần này vẫn đang sử dụng logic tính toán thủ công ở phía Client/Server với các giới hạn truy vấn cũ, thay vì sử dụng các hàm tổng hợp (RPC) đã được tối ưu hóa ở lượt trước.

## Các bước thực hiện:

1.  **Cập nhật Memory**: Cập nhật `mem://features/participation-sync` để bao gồm cả trang chi tiết cuộc thi vào phạm vi đồng bộ hóa "Một nguồn sự thật".
2.  **Tái cấu trúc Server Function**: Sửa `src/lib/participation.functions.ts` để thay thế logic cũ (truy vấn 5.000 nhân viên + 20.000 lượt thi rồi join bằng JS) bằng cách gọi RPC `get_detailed_participation_summary`.
3.  **Đồng nhất Dữ liệu**: Đảm bảo các trạng thái `passed`, `failed` được tính là "Đã thi", còn `pending`, `none` được tính là "Chưa thi" để khớp hoàn toàn với báo cáo của Admin.
4.  **Kiểm tra tính chính xác**: Xác nhận số lượng "Thuộc diện thi" (613) và "Đã thi" (~400) phản ánh đúng dữ liệu thực tế từ bảng `candidate_quiz_stats` và `results`.

Việc chuyển đổi sang RPC không chỉ sửa lỗi sai số mà còn giúp trang chi tiết cuộc thi tải nhanh hơn đáng kể khi không phải xử lý hàng chục ngàn dòng dữ liệu thô.
