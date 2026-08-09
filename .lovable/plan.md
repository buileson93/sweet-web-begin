# Kế hoạch Kiểm tra và Hoàn thiện Tính năng Chống gian lận bằng Hình ảnh

Cơ chế chống gian lận hiện tại sử dụng HTML5 Canvas để render câu hỏi và đáp án thành ảnh (PNG base64) ngay tại trình duyệt khi cuộc thi bật `strict_mode`.

## 1. Phân tích hiện trạng bảo mật (Anti-DOM Scanning)
- **Văn bản được thay thế bằng ảnh:** Các thẻ `RichText` trong câu hỏi và đáp án sẽ tự động chuyển sang chế độ `secureMode` nếu `strictMode` của phiên thi là `true`.
- **Chèn nhiễu (Noise):** `renderTextToImage` đã thêm nhiễu pixel và các đường kẻ siêu mảnh để chống các công cụ OCR đơn giản (như script dùng tesseract.js trực tiếp trên trình duyệt).
- **Phá vỡ cấu trúc SR-Only:** Văn bản dành cho trình đọc màn hình được chèn ký tự `Zero Width Space (\u200B)` giữa từng chữ cái. Điều này khiến các script `innerText` hoặc `textContent` đơn giản sẽ lấy ra chuỗi vô nghĩa (ví dụ: `C​â​u​ ​h​ỏ​i` thay vì `Câu hỏi`).
- **Chống chuột/touch:** Ảnh được đặt `pointer-events-none` và `select-none` để tránh thí sinh copy-paste hoặc thao tác chuột trực tiếp lên ảnh.

## 2. Các bước kiểm tra (Test Plan)
- [ ] **Kiểm tra DOM:** Đảm bảo không có thuộc tính `alt` hay `aria-label` nào chứa nội dung câu hỏi/đáp án thô.
- [ ] **Thử nghiệm script quét:** Chạy một đoạn mã giả lập bot để xem có thể lấy được nội dung có nghĩa từ `.rich-text-secure` hay không.
- [ ] **Kiểm tra đồng bộ:** Xác nhận `strict_mode` được bật đúng cho các cuộc thi quan trọng (đã tìm thấy cuộc thi ID `de4a7cfd...` đang bật).

## 3. Các cải tiến đề xuất
- **Giao diện:** Cập nhật thông báo trạng thái bảo mật trong Admin UI để người quản lý biết tính năng đang hoạt động.
- **Vật lý:** Kết hợp với `behaviorTracker` (đã có) để khóa ngay nếu phát hiện click "quá chính xác" vào tọa độ ảnh (thường là script).

## 4. Cập nhật văn bản giao diện
- Chỉnh sửa văn bản theo yêu cầu của người dùng tại các vị trí liên quan (Admin/Dashboard).
