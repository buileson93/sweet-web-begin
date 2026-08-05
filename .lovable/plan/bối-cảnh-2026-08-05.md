---
name: Nâng cấp phòng thủ chống gian lận chuyên nghiệp (VATM Anti-Cheat v3)
description: Áp dụng các kỹ thuật cao cấp từ các nền tảng thi trắc nghiệm lớn (ProctorU, Pearson VUE) như Phân tích sinh trắc học hành vi và Chuỗi tương tác logic.
type: feature
---

## Bối cảnh
Hệ thống hiện tại đã có:
- Chữ ký số P-256 (Payload Signing).
- Bẫy mồi (Honeypots).
- Kiểm tra `isTrusted` (thao tác vật lý).
- Chống tráo đổi đáp án (DOM Cloaking).

## Mục tiêu
Nâng cấp thêm các lớp bảo mật "vô hình" nhưng cực kỳ hiệu quả mà các nền tảng lớn hay dùng để phân biệt người và máy.

## Các kỹ thuật đề xuất

### 1. Phân tích Sinh trắc học Hành vi (Behavioral Biometrics) - Đa nền tảng
- **Mouse/Touch Analysis**: Trên máy tính, script thường di chuyển chuột theo đường thẳng tuyệt đối hoặc nhảy vọt. Trên điện thoại, người thật thường có diện tích tiếp xúc (touch area/pressure) biến thiên và tọa độ chạm không bao giờ trùng khít 100% giữa các lần bấm.
- **Phát hiện**: 
    - **Máy tính**: Theo dõi quỹ đạo chuột (jitter/curvature). 
    - **Điện thoại**: Theo dõi sự biến thiên của tọa độ (x, y) trong vùng bấm. Script thường click vào tâm tuyệt đối (ví dụ: chính giữa nút), người thật sẽ bấm lệch ngẫu nhiên.
    - **Chỉ số**: Nếu 10 câu liên tiếp có tọa độ click vào đúng 1 điểm duy nhất (pixel-perfect) -> Chắc chắn là Script.

### 2. (Đã loại bỏ: Chuỗi tương tác Logic)
- **Lưu ý:** Đã loại bỏ yêu cầu "Bắt buộc Hover trước khi Click" để tránh gây khó khăn cho người thi thật khi họ làm bài ở tốc độ cao (đua top) và click trực tiếp vào mục tiêu mà không cần rê chuột lâu.

### 3. Mã hoá Payload mức ứng dụng (Application-Level Encryption)
- Ngoài HTTPS và Chữ ký số, nội dung đáp án sẽ được mã hoá bằng một khoá tạm thời (Session Key) được thiết lập lúc bắt đầu thi. 
- Điều này khiến việc mở "Network Tab" để xem nội dung gửi đi trở nên vô nghĩa vì dữ liệu là một chuỗi vô định.

### 4. Canvas Text Fragment (Chống Copy/Cào dữ liệu)
- Hiển thị một phần nội dung quan trọng của câu hỏi hoặc phương án dưới dạng hình ảnh hoặc vẽ lên Canvas để các script cào text đơn giản (innerText/textContent) không lấy được nội dung trọn vẹn.

## Kế hoạch triển khai

1. **Behavioral Tracking (`src/lib/exam/behavior.ts`)**:
   - Tạo module theo dõi tọa độ chuột/touch và tính toán chỉ số "độ thật" (Human Score) dựa trên quỹ đạo.
2. **Phân tích hành vi nâng cao (`src/lib/exam/behavior.ts`)**:
   - Thay vì bắt Hover, chúng ta sẽ tập trung vào phân tích tọa độ click và sự biến thiên của touch/pointer event.
3. **Advanced Integrity Logic (`src/lib/integrity.ts`)**:
   - Thêm các loại vi phạm mới: `robotic_movement` (di chuyển chuột như máy), `unnatural_click` (tọa độ click luôn vào chính giữa tuyệt đối của nút).
4. **UI Feedback cho Admin**:
   - Hiển thị thêm chỉ số "Human Probability" (Xác suất người thật) trong trang theo dõi trực tiếp.

## Ghi chú
Các biện pháp này hoàn toàn "vô hình" với người dùng thật, không gây phiền hà hay yêu cầu nhập Captcha, nhưng cực kỳ khó để Script có thể vượt qua vì phải mô phỏng cả hành vi vật lý phức tạp của con người.
