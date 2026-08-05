# Kế hoạch: Điều tra và tăng cường giám sát `autosave_rate:too_fast`

Người dùng đặt câu hỏi liệu một người chơi bấm câu trả lời thật (người thật) quá nhanh có bị kích hoạt lỗi `autosave_rate:too_fast` hay không, và bày tỏ nghi ngờ vì những người mắc lỗi này thường có kết quả rất nhanh và điểm cao.

## Phân tích hiện tại
- **Ngưỡng hiện tại**: 1.2 giây (`MIN_GAP_RPC_MS`) giữa 2 lần lưu.
- **Khả năng người thật**: Một người cực kỳ giỏi và thuộc đề có thể đọc câu hỏi ngắn và bấm chọn trong < 1.2 giây, đặc biệt là với các câu hỏi trắc nghiệm đơn giản. Tuy nhiên, việc duy trì tốc độ này liên tục qua nhiều câu là dấu hiệu bất thường.
- **Nghi vấn**: `autosave_rate:too_fast` có thể là hệ quả của việc script cố gắng "nhồi" đáp án nhanh nhất có thể hoặc thăm dò API.

## Các bước thực hiện

### 1. Cập nhật tài liệu nội bộ (src/lib/integrity.ts)
- Ghi chú rõ nghi vấn của người dùng: "Người thật bấm quá nhanh có bị lỗi này không? Thực tế cho thấy các trường hợp bị lỗi này thường có tốc độ và điểm số rất cao, cần giám sát chặt chẽ."
- Giải thích rõ cơ chế: Nếu bấm thật trong < 1.2s liên tục, lỗi này sẽ hiện ra.

### 2. Tinh chỉnh logic giám sát tốc độ (src/lib/exam/speedAudit.ts)
- Đảm bảo tín hiệu `autosave_rate` được kết hợp chặt chẽ với logic `auditSpeed`.
- Nếu một phiên có cả `autosave_rate` và tốc độ trung bình `< 3s/câu`, hệ thống sẽ gắn nhãn rủi ro cao hơn trong trang Admin để người quản trị dễ dàng phát hiện.

### 3. Đánh giá lại trọng số phạt
- Giữ trọng số là **0** để tránh phạt oan tuyệt đối cho người dùng mạng lag (khiến request bị dồn toa).
- Thay vào đó, tăng cường hiển thị cảnh báo cho Admin trong mục "Theo dõi trực tiếp" khi thấy sự kết hợp giữa: `too_fast` + `Điểm cao` + `Thời gian ngắn`.

## Kế hoạch kiểm tra
- Chạy thử nghiệm giả lập người thật bấm nhanh (< 1.2s) để xác nhận lỗi `too_fast` xuất hiện.
- Chạy các test case hiện có để đảm bảo không phá vỡ logic cũ.
