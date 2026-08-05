# Kế hoạch tinh chỉnh thông báo lỗi và rà soát Cloudflare Turnstile

Dựa trên thắc mắc "có phải do Cloudflare không", tôi sẽ cập nhật giao diện để giải thích rõ hơn về vai trò của Cloudflare Turnstile trong việc bảo vệ phòng thi và hướng dẫn cách xử lý nếu bị chặn.

## Các thay đổi chính

### 1. Cập nhật nội dung Header tại Bảng xếp hạng
- Thay đổi đoạn văn mô tả để đề cập trực tiếp đến việc tinh chỉnh cơ chế xác minh an toàn (Cloudflare Turnstile), giúp thí sinh yên tâm và biết cách xử lý khi gặp lỗi.

### 2. Tinh chỉnh thông báo lỗi phía Server (`src/lib/turnstile.server.ts`)
- Cải thiện nội dung `reason` để giải thích rằng lỗi có thể do kết nối mạng đến máy chủ xác thực của Cloudflare bị gián đoạn, thay vì chỉ báo lỗi script chung chung.

### 3. Cập nhật mô tả lỗi captcha tại `src/lib/turnstile/verify.ts`
- Làm rõ hơn các mã lỗi liên quan đến Cloudflare để Admin dễ dàng hỗ trợ thí sinh.

## Các bước thực hiện

1. **Chỉnh sửa `src/routes/bang-xep-hang.tsx`**: Cập nhật text header theo yêu cầu mới.
2. **Chỉnh sửa `src/lib/turnstile.server.ts`**: Tinh chỉnh câu chữ trong các thông báo lỗi trả về cho client.
3. **Chỉnh sửa `src/lib/turnstile/verify.ts`**: Cập nhật hàm `describeTurnstileCode` để hiển thị tiếng Việt chi tiết hơn về lỗi Cloudflare.

Việc thay đổi này giúp trả lời trực tiếp câu hỏi của người dùng ngay trên giao diện hệ thống.
