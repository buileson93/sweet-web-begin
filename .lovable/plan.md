# Kế hoạch Chuyển đổi Câu hỏi và Đáp án thành Ảnh Chống Gian lận (OCR-Required Protection)

Thí sinh phản ánh vẫn còn tình trạng dùng script chọn đáp án nhanh rồi đợi thời gian để nộp bài. Giải pháp đề xuất là chuyển đổi nội dung văn bản (đề bài và đáp án) thành hình ảnh có nhiễu nhẹ ngay tại trình duyệt. Điều này buộc script gian lận phải thực hiện OCR (nhận dạng chữ) — một thao tác tốn tài nguyên và thời gian, giúp ngăn chặn các script đơn giản đọc DOM.

## 1. Cơ chế Kỹ thuật (Text-to-Image Canvas)
Sử dụng HTML5 Canvas để vẽ văn bản câu hỏi và đáp án thành ảnh `data:image/png`.
- **Nhiễu nhẹ (Noise):** Chèn các điểm ảnh nhiễu, đường kẻ mảnh hoặc biến dạng nhẹ font chữ để gây khó khăn cho các thư viện OCR đơn giản.
- **Phong cách VATM:** Giữ nguyên font chữ và màu sắc thương hiệu nhưng render dưới dạng bitmap.
- **Tính an toàn:** Đáp án text thật sự sẽ không tồn tại trong DOM dưới dạng văn bản có thể quét (`innerText`/`textContent`).

## 2. Thay đổi UI & Logic
- **`src/components/RichText.tsx`:** Bổ sung chế độ render `asImage`. Khi chế độ này bật, thay vì render Markdown ra HTML, nó sẽ vẽ nội dung lên một Canvas ẩn và trả về một thẻ `<img>`.
- **`src/components/exam/QuestionCard.tsx`:** Cấu hình để truyền cờ bảo vệ vào các thành phần con.
- **`src/components/exam/QuestionInput.tsx`:** Áp dụng cơ chế vẽ ảnh cho từng phương án trả lời.
- **Khả năng truy cập (Accessibility):** Cung cấp `aria-label` chứa nội dung đã được làm nhiễu hoặc mã hóa cơ bản để trình đọc màn hình vẫn hoạt động nhưng script khó khai thác trực tiếp.

## 3. Các bước thực hiện
1. **Tạo Utility vẽ ảnh (`src/lib/exam/textCanvas.ts`):** 
   - Hàm `renderTextToImage(text, options)`: Vẽ text lên canvas, thêm nhiễu, trả về base64.
2. **Cập nhật `RichText` component:** 
   - Thêm prop `secureMode?: boolean`.
   - Sử dụng `useMemo` để sinh ảnh nhằm đảm bảo hiệu năng.
3. **Tích hợp vào giao diện thi:**
   - Mặc định bật chế độ này cho các kỳ thi có `strict_mode` hoặc cấu hình riêng.
4. **Kiểm tra tương thích:**
   - Đảm bảo hiển thị tốt trên các kích thước màn hình khác nhau (responsive).
   - Đảm bảo các công thức toán học (KaTeX) vẫn được render đúng (vẽ kết quả KaTeX lên canvas).

## 4. Lưu ý quan trọng
- **Hiệu năng:** Việc render canvas tốn thêm một ít CPU lúc load câu hỏi, cần tối ưu bằng `memo`.
- **Dữ liệu:** Dữ liệu gốc vẫn được gửi về từ server dưới dạng text (đã được obfuscate qua `revealGuard.ts`), việc chuyển thành ảnh chỉ diễn ra ở lớp hiển thị cuối cùng để chặn script cào DOM.

Bạn có muốn tôi bắt đầu triển khai Utility vẽ ảnh và cập nhật component RichText trước không?
