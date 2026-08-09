# Kế hoạch kiểm tra và tối ưu tính năng chống gian lận bằng hình ảnh

Hiện tại, cuộc thi đang bật **Chế độ nghiêm ngặt** (Strict Mode) và render thành hình ảnh là: **"Tìm hiểu về Luật Hàng không dân dụng Việt Nam, các văn bản pháp luật về công tác Bảo đảm hoạt động bay"** (ID: `de4a7cfd-f3ad-45bb-9245-39fdbb8da514`).

## Các bước kiểm tra tính an toàn của DOM
1.  **Kiểm tra thuộc tính của ảnh:** Đảm bảo các thẻ `<img>` được sinh ra không có thuộc tính `alt` hoặc `aria-label` chứa nội dung văn bản gốc.
2.  **Kiểm tra văn bản ẩn (Hidden Text):**
    *   Truy cập vào lớp `.sr-only` được dùng cho trình đọc màn hình.
    *   Xác nhận văn bản đã được chia nhỏ thành từng ký tự trong các thẻ `<span>` riêng biệt.
    *   Xác nhận có sự hiện diện của ký tự "Zero Width Space" (`\u200B`) giữa các ký tự để đánh lừa các hàm `innerText` và `textContent` của script bot.
3.  **Thử nghiệm với Script cào dữ liệu mẫu:** Chạy một đoạn mã JavaScript đơn giản trong console để xem kết quả trả về từ `document.querySelector('.rich-text-secure').innerText` có đọc được không.

## Kế hoạch thực hiện
- [ ] Chạy script Playwright giả lập môi trường thí sinh để chụp ảnh và kiểm tra DOM tự động.
- [ ] Nếu phát hiện rò rỉ (ví dụ: `innerText` vẫn ghép được thành chữ), sẽ tăng cường độ nhiễu DOM bằng cách chèn thêm các thẻ span trống hoặc ký tự gây nhiễu ngẫu nhiên.
- [ ] Kiểm tra khả năng hiển thị trên các trình duyệt phổ biến (Chrome, Safari Mobile) để đảm bảo thí sinh thật không bị ảnh hưởng bởi nhiễu ảnh (Noise).

Tôi sẽ thực hiện kiểm tra chi tiết ngay sau khi bạn đồng ý với kế hoạch này.
