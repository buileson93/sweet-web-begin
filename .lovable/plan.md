# Kế hoạch Nghiên cứu và Triển khai Dấu vân tay Thiết bị (Device Fingerprinting) Chống Gian lận

Để tăng cường khả năng phát hiện và ngăn chặn gian lận trong các kỳ thi nội bộ VATM, chúng ta cần một cơ chế định danh thiết bị mạnh mẽ hơn là chỉ dựa vào `localStorage` (vốn dễ dàng bị xóa hoặc vượt qua bằng chế độ Ẩn danh).

## 1. Dữ liệu hiện có & Hạn chế
- **Hiện tại:** Sử dụng `deviceId` (UUID ngẫu nhiên lưu trong `localStorage`).
- **Hạn chế:** Người dùng có thể xóa dữ liệu trang web, dùng trình duyệt khác hoặc chế độ Incognito để bỏ qua cơ chế "thời gian nguội" (cooldown) khi đổi người thi trên cùng một máy.
- **Dữ liệu thống kê:** Đã thu thập IP, User-Agent, độ phân giải màn hình, thông tin phần cứng cơ bản (CPU, RAM). Nhưng các thông số này thường giống nhau trên các máy tính văn phòng tiêu chuẩn.

## 2. Giải pháp Dấu vân tay Thiết bị (Device Fingerprinting)
Tôi đề xuất triển khai cơ chế **VATM Fingerprint v1** kết hợp nhiều đặc điểm phần cứng và trình duyệt để tạo ra một "mã định danh" bền vững:

### A. Kỹ thuật thu thập (Client-side)
1. **Canvas Fingerprinting:** Vẽ một đoạn văn bản và hình ảnh ẩn lên Canvas. Sự khác biệt nhỏ trong card đồ họa, driver và trình duyệt sẽ tạo ra dữ liệu pixel duy nhất khi băm (hash).
2. **WebGL Fingerprinting:** Thu thập thông tin chi tiết về card đồ họa (Renderer, Vendor) và các thông số giới hạn của GPU.
3. **Audio Fingerprinting:** Sử dụng `AudioContext` để xử lý âm thanh ẩn, tạo ra chữ ký số dựa trên cách trình duyệt xử lý tín hiệu âm thanh.
4. **Hardware Entropy:** Kết hợp số nhân CPU, bộ nhớ RAM, múi giờ, ngôn ngữ và danh sách các font chữ có sẵn.

### B. Lưu trữ và Đối soát (Database & Server-side)
1. **Cập nhật bảng `device_locks`:** Lưu thêm cột `fingerprint_hash`.
2. **Cập nhật bảng `exam_sessions`:** Lưu `fingerprint_hash` tại thời điểm bắt đầu thi.
3. **Cơ chế phát hiện:**
   - **Đổi người dùng trên cùng thiết bị:** Phát hiện khi 2 mã nhân viên khác nhau có cùng một `fingerprint_hash` trong thời gian ngắn (chống thi hộ).
   - **Tự động hóa (Bot/Script):** Các trình duyệt không đầu (Headless) hoặc script thường có dấu vân tay rất đặc trưng (thiếu WebGL extensions, độ phân giải màn hình giả lập).

## 3. Các bước triển khai cụ thể
1. **Tạo `src/lib/exam/fingerprint.ts`**: Chứa logic tạo mã băm từ Canvas/WebGL/Hardware.
2. **Nâng cấp `src/lib/deviceId.ts`**: Kết hợp `localStorage` UUID với `fingerprint` để tạo ra ID định danh thiết bị mạnh mẽ hơn.
3. **Cập nhật Database**: Thêm cột `fingerprint` vào các bảng liên quan.
4. **Xây dựng Dashboard giám sát**: Hiển thị các trường hợp "Nghi vấn dùng chung thiết bị" cho Admin.

## 4. Hiệu quả mang lại
- Ngăn chặn hiệu quả việc "lách luật" thời gian chờ bằng cách xóa cache/Incognito.
- Truy vết được các trường hợp một nhóm người dùng chung 1 máy tính để thi hộ nhau.
- Tăng độ tin cậy của chỉ số Liêm chính (Integrity Score).

Tôi sẽ bắt đầu triển khai module tạo dấu vân tay thiết bị nếu bạn đồng ý với hướng tiếp cận này.
