# Toàn diện hóa cơ chế chống gian lận script (Comprehensive Anti-Script Plan)

Mục tiêu: Ngăn chặn script tự động trả lời (auto-submit) ngay cả khi đối phương đã lách được cơ chế đọc đề (image-based). Chuyển trọng tâm từ "chống đọc" sang "phát hiện thao tác máy".

## 1. Kiểm soát Tốc độ & Thời gian (Server-side)
- [ ] **Enforce Per-Question Min Time**: Bổ sung kiểm tra mốc thời gian trả lời của từng câu hỏi trên máy chủ.
  - Thay vì chỉ chặn tần suất RPC chung (hiện tại 1.2s), máy chủ sẽ nới lỏng xuống **0.9s** theo yêu cầu để tránh phạt oan, nhưng vẫn đảm bảo không thể bắn hàng loạt.
  - Nếu khoảng cách < 0.9s, máy chủ sẽ từ chối ghi nhận.
- [ ] **Server-side Rolling Window**: Theo dõi tốc độ trung bình của 5 câu gần nhất. Nếu $\text{avg\_time} < 1.2s$, đánh dấu nghi vấn thay vì bật Captcha để không làm gián đoạn trải nghiệm người dùng thật.

## 2. Phát hiện Thao tác Giả lập (Client-side)
- [ ] **isTrusted Reinforcement**: Thắt chặt kiểm tra `event.isTrusted`. Nếu phát hiện `false`, gửi log cảnh báo và đánh dấu liêm chính thấp.
- [ ] **Click Entropy & Movement Proof**: 
  - Phân tích độ lệch tọa độ click (Click Entropy). Nếu click vào đúng tâm tuyệt đối 100% (script thường làm vậy), đánh dấu là `unnatural_click`.
  - Không bắt buộc Captcha ngay, chỉ ghi nhận vào báo cáo giám sát của Admin.

## 3. Mã hóa & Bảo mật Payload (Communication)
- [ ] **Per-Session Answer Nonces**: 
  - Thay vì gửi `index: 0`, client sẽ gửi một chuỗi hash được sinh ra từ `(sessionId + questionId + choiceIndex + clientSideSecret)`.
  - Máy chủ sẽ xác thực hash này. Script nếu không mô phỏng được logic hash sẽ không thể gửi đáp án đúng.
- [ ] **Liveness Signature Enforcement**: Đảm bảo mọi gói tin autosave bắt buộc phải có chữ ký ECDSA từ khoá không-thể-xuất trong `strictMode`.

## 4. Ngắt mạch (Adaptive Friction)
- [ ] **Adaptive Monitoring**: Khi máy chủ trả về lỗi `too_fast` hoặc `suspicious_behavior`, giao diện sẽ ghi nhận log và Admin sẽ theo dõi thay vì tự động hiện Captcha làm gián đoạn người dùng (trừ trường hợp rủi ro cực cao).



## 3. Mã hóa & Bảo mật Payload (Communication)
- [ ] **Per-Session Answer Nonces**: 
  - Thay vì gửi `index: 0`, client sẽ gửi một chuỗi hash được sinh ra từ `(sessionId + questionId + choiceIndex + clientSideSecret)`.
  - Máy chủ sẽ xác thực hash này. Script nếu không mô phỏng được logic hash (được giấu trong code đã obfuscated) sẽ không thể gửi đáp án đúng.
- [ ] **Liveness Signature Enforcement**: Đảm bảo mọi gói tin autosave bắt buộc phải có chữ ký ECDSA từ khoá không-thể-xuất trong `strictMode`.

## 4. Ngắt mạch (Adaptive Friction)
- [ ] **Auto-Trigger Captcha**: Khi máy chủ trả về lỗi `too_fast` hoặc `suspicious_behavior`, giao diện sẽ tự động hiện `CaptchaGuardDialog`.
- [ ] **Invisible Honeypots (Enhanced)**: Cải tiến bẫy mồi trong `optionCloak.ts` để chúng thay đổi vị trí liên tục và mang các token "trông có vẻ là đáp án đúng" nhưng thực chất là bẫy.

## Các file sẽ chỉnh sửa:
- `src/lib/exam/saveRate.ts`: Thêm logic kiểm tra thời gian giữa các câu.
- `src/lib/exam/behavior.ts`: Nâng cao phân tích quỹ đạo và entropy click.
- `src/lib/exam/inputProof.ts`: Bổ sung yêu cầu `hasMovement`.
- `src/routes/thi.tsx`: Xử lý phản hồi lỗi từ server để hiện Captcha tự động.
- `src/lib/exam/submit.server.ts`: Tích hợp logic kiểm tra rolling window và interval.
