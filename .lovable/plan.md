# Kế hoạch: Nâng cấp cơ chế chống Script chuyên nghiệp

Người dùng đặt câu hỏi về việc thêm bẫy giả (honeypots) và các biện pháp chuyên nghiệp hơn để chặn script, thay vì chỉ dựa vào các biện pháp cơ bản hay tốc độ.

## Các biện pháp chống Script chuyên nghiệp đề xuất

Hệ thống sẽ được nâng cấp với các kỹ thuật "ẩn mình" và "xác thực sâu" sau:

### 1. Đa dạng hóa bẫy giả (Dynamic Honeypots)
- Không chỉ là các thẻ ẩn đơn giản. Chúng ta sẽ tạo ra các **"câu hỏi giả"** trong cấu trúc dữ liệu gửi xuống. Nếu script cố tình trả lời các câu hỏi không tồn tại này, đó là bằng chứng gian lận tuyệt đối.
- Sử dụng các thuộc tính CSS ngẫu nhiên để ẩn bẫy (ví dụ: `opacity: 0.0001`, `z-index: -9999`, hoặc nằm ngoài vùng nhìn thấy) để tránh các script lọc `display: none`.

### 2. Xác thực chuỗi hành vi (Interaction Sequence Validation)
- Người thật thường có các hành vi "thừa" như: di chuyển chuột, cuộn trang, hoặc thời gian giữa các lần di chuyển chuột không đều.
- Script thường chỉ "nhảy" trực tiếp đến phần tử và click.
- Chúng ta sẽ ghi nhận một "hash hành vi" tóm tắt các sự kiện này và gửi kèm gói đáp án.

### 3. Canvas/Webgl Fingerprinting (Nhận diện thiết bị sâu)
- Sử dụng kỹ thuật vẽ ẩn trên Canvas để tạo ra một vân tay thiết bị duy nhất. Nếu nhiều phiên thi khác nhau có cùng một vân tay thiết bị lạ hoặc vân tay từ các môi trường ảo (Headless Chrome), hệ thống sẽ cảnh báo.

### 4. Obfuscation (Làm rối mã nguồn)
- Làm rối các tên hàm và biến liên quan đến việc gửi đáp án (như `saveExamProgress`, `signature`) để khiến việc dịch ngược mã nguồn (reverse engineering) trở nên khó khăn hơn đối với các script tùy chỉnh.

## Các bước thực hiện trong Plan

### 1. Nâng cấp Honeypot (src/lib/integrity.ts & UI)
- Triển khai logic tạo bẫy ngẫu nhiên trong mỗi phiên thi.
- Cập nhật `scoreEvent` để xử lý các loại bẫy mới này.

### 2. Tăng cường xác thực phía máy chủ (src/lib/exam/answerIntake.ts)
- Kiểm tra sự hiện diện của "chuỗi hành vi" tối thiểu trước khi chấp nhận đáp án.

### 3. Cập nhật tài liệu (Tiếng Việt)
- Giải thích các biện pháp mới này trong mã nguồn để người quản trị hiểu được các lớp phòng thủ chuyên nghiệp đang hoạt động.

## Kế hoạch kiểm tra
- Thử nghiệm với các công cụ tự động hóa phổ biến (Selenium, Puppeteer) xem có bị phát hiện bởi các lớp bảo mật mới không.
- Đảm bảo người dùng thật (ngay cả khi thi rất nhanh) không bị kích hoạt các bẫy này.
