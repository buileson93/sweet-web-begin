# Plan - Chống script và Giảm thiểu báo cáo "bị oan"

Hệ thống sẽ được tinh chỉnh để bảo vệ tính liêm chính nhưng không chặn thí sinh thật do các vấn đề về mạng hoặc cấu hình thiết bị không mong muốn.

## Các thay đổi chính

### 1. Cải thiện độ tin cậy của Cloudflare Turnstile
- **Tăng thời gian chờ (Timeout)**: Tăng từ 6s lên 10s để hỗ trợ mạng yếu.
- **Xử lý lỗi mạng thông minh**: Thay vì chặn ngay lập tức khi không liên lạc được máy chủ Cloudflare, hệ thống sẽ cho phép "tạm bỏ qua" và ghi log để rà soát thay vì huỷ bài ngay (ngay cả ở chế độ nghiêm ngặt, nếu lỗi là do hạ tầng).
- **Kiểm tra khóa cấu hình**: Đảm bảo Site Key và Secret Key đồng bộ.

### 2. Tinh chỉnh bộ lọc "Trình duyệt tự động hoá"
- **Giảm trọng số**: Chuyển `automation_detected` từ phạt 6 điểm (ngưỡng huỷ bài) xuống 4 điểm, để chỉ khi có thêm tín hiệu khác mới bị huỷ bài.
- **Rà soát tín hiệu false-positive**: Loại bỏ các dấu hiệu dễ bị nhầm lẫn bởi các tiện ích mở rộng (extension) hoặc trình duyệt di động đặc thù.

### 3. Cập nhật giao diện và Thông báo
- **Thay đổi văn bản Header**: Cập nhật mô tả tại Bảng xếp hạng theo yêu cầu của người dùng để thông báo về kế hoạch cải tiến này.
- **Thông báo rõ ràng hơn**: Nếu bị chặn do Turnstile, hướng dẫn thí sinh kiểm tra kết nối mạng thay vì chỉ báo "Lỗi script".

### 4. Công cụ cho Admin
- **Xem chi tiết lý do "Oan"**: Cải thiện màn hình theo dõi để Admin thấy rõ *tín hiệu* nào đã gây ra lỗi script (ví dụ: do mạng lỗi hay do dấu hiệu webdriver thật).

## Các bước thực hiện

1.  **Chỉnh sửa `src/lib/turnstile.ts`**: Tăng timeout lấy token.
2.  **Chỉnh sửa `src/lib/turnstile.server.ts`**: Cập nhật logic `verifyTurnstileToken` để xử lý lỗi mạng mềm dẻo hơn.
3.  **Chỉnh sửa `src/lib/integrity.ts`**: Điều chỉnh trọng số `automation_detected` và `captcha_failed`.
4.  **Chỉnh sửa `src/routes/bang-xep-hang.tsx`**: Cập nhật văn bản mô tả header.
5.  **Kiểm tra và xác nhận**: Đảm bảo các thay đổi không làm giảm khả năng chống script thật nhưng loại bỏ được các trường hợp lỗi mạng/cấu hình.
