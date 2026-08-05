# Plan: Cập nhật cơ chế đếm lượt thi thông minh (Optimization)

Người dùng yêu cầu tối ưu hóa việc đếm lượt thi thay vì phải truy vấn hàng chục ngàn dòng (hiện tại đang fetch 50,000 dòng để đếm trong server function). Giải pháp đề xuất là lưu trữ số lượt thi trực tiếp vào một bảng thống kê hoặc bảng kết quả để hiển thị nhanh chóng.

## Phân tích hiện trạng
- **Bảng `exam_sessions`**: Lưu toàn bộ các lần mở đề (sessions). Hiện có khoảng 4,681 bản ghi (và đang tăng nhanh).
- **Hệ thống hiện tại**: Khi load Bảng xếp hạng, server function `getRankableResults` fetch tới 50,000 dòng từ `exam_sessions` để đếm `attempts` theo từng thí sinh. Điều này gây áp lực lên database và làm chậm response khi dữ liệu lớn.
- **Yêu cầu**: Không cần fetch quá nhiều, chỉ cần "ghi log vào thí sinh rồi hiển thị lên".

## Giải pháp: Sử dụng bảng tổng hợp (Aggregation Table)
Thay vì đếm tại thời điểm truy vấn (on-the-fly), chúng ta sẽ duy trì một bảng thống kê lượt thi theo bộ (quiz_id, employee_id).

### 1. Cơ sở dữ liệu
- Tạo bảng `candidate_quiz_stats` để lưu trữ:
    - `quiz_id`
    - `employee_id`
    - `candidate_name`, `unit` (để fallback cho người không có employee_id)
    - `attempt_count`: Tổng số lần mở đề.
    - `submitted_count`: Tổng số lần nộp bài.
- Thêm **Trigger** vào bảng `exam_sessions`:
    - Khi một bản ghi mới được chèn (`INSERT`), tăng `attempt_count` trong `candidate_quiz_stats`.
- Thêm **Migration** để đồng bộ dữ liệu cũ (Init data) vào bảng stats này.

### 2. Logic Server (Server Functions)
- Cập nhật `src/lib/leaderboard.functions.ts`: 
    - Thay vì fetch 50,000 dòng `exam_sessions`, thực hiện một lệnh JOIN đơn giản với bảng `candidate_quiz_stats`.
    - Điều này sẽ giảm số lượng dòng trả về từ hàng chục ngàn xuống còn đúng bằng số lượng thí sinh trong cuộc thi đó (thường < 1000).

### 3. Hiển thị UI
- Giữ nguyên giao diện Bảng xếp hạng nhưng dữ liệu sẽ load tức thì và chính xác tuyệt đối mà không cần "limit 50000".

## Các bước thực hiện
1. **Database Migration**:
    - Tạo bảng `candidate_quiz_stats`.
    - Tạo function `sync_candidate_stats()` để cập nhật stats khi có session mới.
    - Tạo trigger trên `exam_sessions`.
    - Chạy script SQL để tính toán lại stats cho toàn bộ dữ liệu lịch sử.
2. **Refactor Code**:
    - Sửa `getRankableResults` trong `src/lib/leaderboard.functions.ts` để lấy `attempts` từ bảng stats mới.
3. **Kiểm tra**:
    - Xác nhận số lượt thi của các thí sinh (Nguyễn Thị Ngọc Mai, Châu Quang Huy...) vẫn chính xác nhưng tốc độ phản hồi nhanh hơn.

## Câu hỏi làm rõ
1. Bạn có muốn thống kê lượt thi này hiển thị cả ở trang cá nhân của thí sinh không, hay chỉ phục vụ admin/leaderboard?
2. Chúng ta có nên tính cả các lượt thi "nháp" (mở ra rồi đóng lại ngay) vào số lần thi không? (Hiện tại hệ thống đang đếm tất cả).
