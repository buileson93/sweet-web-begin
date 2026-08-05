# Kế hoạch: Rà soát chống gian lận & Đánh giá Phan Thành An

Người dùng muốn tập trung vào việc rà soát kỹ thuật chống gian lận và đánh giá hành vi của thí sinh "Phan Thành An", không muốn thay đổi bất kỳ văn bản UI nào.

## Các nội dung chính

### 1. Kiểm tra những gì đã làm được (Anti-Cheat)
- **Cơ chế hiện tại**:
    - **Khóa thời gian phía máy chủ**: Không thể sửa giờ máy để gian lận.
    - **Điểm Liêm chính (Integrity Score)**: Theo dõi việc rời màn hình (blur), đổi tab.
    - **Chống Script**: Sử dụng `answerLock` (giới hạn tốc độ lưu), `humanPresence` (kiểm tra thuộc tính `isTrusted` của sự kiện), và Cloudflare Turnstile (xác thực không phải robot).
    - **Bảo mật dữ liệu**: Đáp án đúng không bao giờ được gửi xuống client (`revealGuard`).
    - **Chữ ký số Payload**: Autosave được ký bằng ECDSA P-256 để chống can thiệp trực tiếp vào API.

### 2. Đánh giá khả năng của Phan Thành An
- **Phân tích dữ liệu**:
    - Truy vấn lại `exam_events` cho `employee_id` `15facc7d-acc3-45bd-8959-e027f859b4aa`.
    - Xem xét các lỗi `autosave_rate:too_fast` (hiện trọng số là 0 - chỉ ghi log).
    - Kiểm tra xem có bất kỳ lỗi `unsigned_check` hoặc `isTrusted:false` nào nghiêm trọng không.
    - So sánh tần suất và mẫu hành vi (pattern) với các thí sinh bình thường khác.

### 3. Đề xuất cải thiện (nếu cần)
- Nếu Phan Thành An thực sự dùng script:
    - Cân nhắc tăng trọng số cho `autosave_rate` lên mức cảnh báo (ví dụ: 1).
    - Thêm cơ chế "Thử thách" (Challenge-Response) ngẫu nhiên giữa giờ thi nếu phát hiện tốc độ bất thường.
- Nếu là "oan" do mạng lag:
    - Giữ nguyên trọng số 0 để tránh ảnh hưởng trải nghiệm người dùng thật.

### 4. Cam kết không thay đổi giao diện
- Sẽ không chỉnh sửa bất kỳ file `.tsx` hay `.css` nào liên quan đến hiển thị nếu không cần thiết cho logic bảo mật.

## Kế hoạch thực hiện

### Bước 1: Thu thập bằng chứng số (Investigation)
Sử dụng `supabase--read_query` để lấy dữ liệu sự kiện chi tiết của Phan Thành An, tập trung vào:
- `kind`: Loại vi phạm.
- `detail`: Thông tin kỹ thuật (tốc độ, browser, device).
- `created_at`: Để xem chuỗi hành động có quá đều đặn (máy làm) hay không.

### Bước 2: Báo cáo phân tích
Trả lời người dùng về việc:
- Phan Thành An có thực sự dùng script không?
- Các biện pháp hiện tại có đang bắt "nhầm" không?
- Cần làm gì thêm để hệ thống chặt chẽ hơn.
