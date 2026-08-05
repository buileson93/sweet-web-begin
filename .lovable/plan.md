# Plan - Tinh chỉnh Thông báo và Logic Xác minh Chống Script

Dựa trên phản hồi về lỗi "Thiếu token xác minh chống script", tôi sẽ thực hiện tinh chỉnh để thông báo thân thiện hơn và giảm thiểu các trường hợp chặn nhầm (oan) do hạ tầng.

## Các thay đổi chính

### 1. Cập nhật Thông báo Lỗi
- Thay đổi thông báo kỹ thuật "Thiếu token xác minh chống script" thành hướng dẫn hành động cụ thể cho thí sinh: "Hệ thống không nhận được tín hiệu xác minh an toàn từ trình duyệt của bạn. Vui lòng kiểm tra kết nối mạng, tắt các trình chặn quảng cáo (AdBlock) và tải lại trang để tiếp tục."

### 2. Tinh chỉnh Logic `verifyTurnstileToken`
- **Xử lý linh hoạt hơn**: Khi thiếu token ở chế độ nghiêm ngặt, thay vì báo lỗi kỹ thuật thô, hệ thống sẽ trả về lý do yêu cầu thí sinh kiểm tra mạng/tải lại trang.
- **Phân biệt lỗi hạ tầng**: Đảm bảo lỗi do máy chủ Cloudflare không liên lạc được luôn trả về `skipped: true` để không bao giờ chặn đứng thí sinh.

### 3. Đồng bộ hóa Text giao diện
- Cập nhật Header Bảng xếp hạng để phản ánh việc hệ thống đã được tinh chỉnh để bảo vệ thí sinh khỏi các lỗi báo cáo "oan".

## Các bước thực hiện

1.  **Chỉnh sửa `src/lib/turnstile/verify.ts`**: Cập nhật hàm `describeTurnstileCode` để cung cấp thông báo tiếng Việt dễ hiểu hơn.
2.  **Chỉnh sửa `src/lib/turnstile.server.ts`**: Cập nhật nội dung `reason` trong hàm `verifyTurnstileToken` khi thiếu token hoặc xác minh thất bại.
3.  **Chỉnh sửa `src/routes/bang-xep-hang.tsx`**: Cập nhật đoạn văn mô tả ở Header theo yêu cầu.

## Về yêu cầu "nếu sai thì đưa ra kế hoạch"
Cơ chế hiện tại (token dựa trên liveness và Turnstile) là đúng đắn về mặt kỹ thuật để chống script chuyên nghiệp. Lỗi "thiếu token" thường do:
- Mạng thí sinh chặn domain `challenges.cloudflare.com`.
- Trình duyệt cài đặt extension quá chặt chẽ làm script Turnstile không chạy được.
- Thí sinh để trang quá lâu dẫn đến token hết hạn (timeout).
=> Việc tinh chỉnh thông báo để hướng dẫn thí sinh "tải lại trang" và kiểm tra mạng là hướng giải quyết đúng đắn nhất thay vì tắt bỏ lớp bảo mật.
