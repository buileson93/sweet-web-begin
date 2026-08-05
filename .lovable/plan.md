# Kế hoạch: Phân tích và báo cáo cơ chế chống Script (Thay thế luật tốc độ)

Người dùng khẳng định việc trả lời 1.2s/câu là bình thường đối với người thuộc đề và yêu cầu tập trung vào các biện pháp kỹ thuật phát hiện script thay vì dựa vào tốc độ.

## Phân tích kỹ thuật hiện tại (Anti-Script)

Hệ thống hiện tại **không chỉ** dựa vào tốc độ mà sử dụng các lớp phòng thủ kỹ thuật sâu hơn để phân biệt người thật và máy:

1.  **Chữ ký số Payload (ECDSA P-256)**:
    - Mỗi gói đáp án gửi lên máy chủ phải được ký bằng một khoá riêng (Private Key) được tạo ra ngay trong trình duyệt khi bắt đầu thi.
    - Khoá này được lưu trong bộ nhớ an toàn (không thể xuất ra, không thể sao chép bằng script thông thường).
    - Script bên ngoài (Python, curl, Postman) không có khoá này sẽ không thể tạo được chữ ký hợp lệ để gửi đáp án.

2.  **Bằng chứng thao tác vật lý (isTrusted proofs)**:
    - Mỗi khi người dùng bấm chọn đáp án, hệ thống ghi lại cờ `isTrusted` từ trình duyệt (chỉ `true` khi có tác động vật lý thật từ chuột/bàn phím).
    - Các script tự động (gọi `.click()` hoặc sửa DOM) sẽ có cờ `isTrusted = false`.
    - Máy chủ kiểm tra cờ này kèm theo chữ ký số để đảm bảo bằng chứng không bị giả mạo.

3.  **Giới hạn số câu mới mỗi lần lưu (MAX_NEW_ANSWERS_PER_SAVE)**:
    - Ngay cả khi một script lách được các bước trên, máy chủ cũng chỉ chấp nhận tối đa **5 câu mới** trong mỗi 1.2 giây.
    - Điều này ngăn chặn việc "nhồi" toàn bộ 50-100 câu hỏi vào cơ sở dữ liệu chỉ trong một giây.

4.  **Honeypot (Bẫy ẩn)**:
    - Các phần tử mồi ẩn mà người thật không thể thấy nhưng script quét mã nguồn sẽ thấy và tương tác. Nếu "bấm" trúng bẫy này, hệ thống sẽ đánh dấu gian lận tuyệt đối.

## Các bước thực hiện

### 1. Cập nhật tài liệu và giải thích (src/lib/integrity.ts)
- Thay đổi các ghi chú để làm rõ: **Hệ thống không dùng tốc độ làm tiêu chí phạt**.
- Khẳng định tốc độ 1.2s/câu là hợp lệ đối với người thuộc đề.
- Chỉnh sửa logic `describeExamEvent` để cung cấp thông tin kỹ thuật (chữ ký, cờ `isTrusted`) thay vì chỉ nói về "nhanh".

### 2. Rà soát lỗ hổng (Investigation)
- Kiểm tra lại luồng `src/lib/exam/answerIntake.ts` để đảm bảo không có cách nào gửi đáp án mà không qua bước xác thực chữ ký.
- Xác minh `src/lib/exam/payloadSign.ts` đang hoạt động đúng ở chế độ "Nghiêm ngặt" (Strict Mode).

### 3. Điều chỉnh nhãn hiển thị cho Admin
- Thay đổi nhãn "Tốc độ bất thường" thành "Nghi vấn Script" nếu có sự kết hợp của nhiều tín hiệu kỹ thuật, không chỉ dựa vào thời gian.

## Kế hoạch kiểm tra
- Chạy thử nghiệm gửi đáp án bằng script (không có chữ ký) để xác nhận máy chủ từ chối.
- Chạy thử nghiệm "người thật thi nhanh" (1.2s/câu) để đảm bảo điểm liêm chính vẫn là 100.
