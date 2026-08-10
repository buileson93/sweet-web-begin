# Plan: Khắc phục lỗi xác định nhầm thiết bị (False Positive) và cải thiện cơ chế định danh

Người dùng phản ánh lỗi "Thiết bị này vừa được L. T. Á. Kiều sử dụng..." bị xác định nhầm (báo sai người thi). Nguyên nhân do cơ chế Fingerprint (dấu vân tay thiết bị) bị trùng lặp trên các máy tính có cùng cấu hình phần cứng tại văn phòng, dẫn đến việc nhầm lẫn khi người dùng sử dụng chế độ Ẩn danh hoặc xóa Cache.

## 1. Phân tích nguyên nhân (Root Cause)
- **VATMFingerprint v1:** Kết hợp Canvas, WebGL và Hardware Entropy. Trong môi trường doanh nghiệp (VATM), các máy tính thường cùng lô sản xuất, cùng hệ điều hành và trình duyệt, dẫn đến Fingerprint giống hệt nhau.
- **Cơ chế fallback:** Khi không tìm thấy `device_id` (do Incognito), hệ thống tìm theo `fingerprint`. Nếu User A vừa thi xong, User B (cùng loại máy) vào thi sẽ bị chặn bởi bản ghi của User A.

## 2. Kế hoạch khắc phục (Logic Fix)
- **Bổ sung địa chỉ IP và User-Agent:** Cập nhật bảng `device_locks` để lưu IP và User-Agent của lần sử dụng cuối.
- **Thắt chặt điều kiện khớp Fingerprint:** 
    - Chỉ coi là cùng một thiết bị nếu (Fingerprint KHỚP) VÀ (IP KHỚP).
    - Nếu Fingerprint khớp nhưng IP khác, hệ thống sẽ coi đó là một máy tính khác cùng loại và cho phép tạo khóa mới (không chặn).
    - Nếu cả Fingerprint và IP đều khớp, khả năng cao là cùng một người hoặc cùng một máy trong cùng văn phòng, lúc này mới áp dụng Cooldown 120 phút.
- **Cập nhật hàm RPC `claim_exam_device`:** Nhận thêm tham số `p_ip` và `p_ua` để đối soát.

## 3. Các bước thực hiện cụ thể
- **Database:** Chạy migration thêm cột `last_ip` và `last_ua` vào `public.device_locks`.
- **Database:** Cập nhật hàm `public.claim_exam_device` để kiểm tra thêm IP khi đối soát fingerprint.
- **Server:** Cập nhật `src/lib/exam/session.server.ts` để lấy IP từ request và truyền vào hàm RPC.
- **Client:** (Tùy chọn) Thêm thông tin `screen.availWidth/Height` vào `VATMFingerprint` để tăng thêm một chút entropy (dù không nhiều).

## 4. Visual Text Edit (Theo yêu cầu)
- Cập nhật văn bản mô tả lỗi hoặc nhãn tương ứng (nếu tìm thấy "language selector") thành mô tả chi tiết về lỗi xác minh mà người dùng đã cung cấp để dễ dàng theo dõi trong hệ thống log/admin.
- *Lưu ý: Theo yêu cầu của người dùng, sẽ tập trung vào sửa logic gốc thay vì chỉ sửa UI text.*

## 5. Kiểm tra (Verification)
- Sử dụng Playwright giả lập hai thiết bị có cùng Fingerprint nhưng khác IP để đảm bảo không bị chặn lẫn nhau.
- Kiểm tra lại trường hợp của "L. T. Á. Kiều" trong log để xác nhận giả thuyết va chạm fingerprint.
