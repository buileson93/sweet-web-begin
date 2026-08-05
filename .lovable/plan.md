# Chiến lược chuẩn hóa hiển thị và minh bạch dữ liệu (VATM Quiz)

Dự án cần một chuẩn mực thống nhất cho các chỉ số quan trọng (Lượt thi, Người tham gia) trên toàn bộ nền tảng (Trang chủ, Bảng xếp hạng, Admin) để tránh nhầm lẫn cho người dùng, đồng thời hiển thị thời điểm đồng bộ dữ liệu cuối cùng.

## 1. Định nghĩa chuẩn hóa (Glossary)
- **Lượt thi (Total Attempts):** Tổng số lần nhấn nút "Bắt đầu thi", bao gồm cả những lần bỏ dở hoặc chưa nộp bài.
- **Người tham gia (Unique Participants):** Số lượng nhân viên (đã định danh) đã nộp bài ít nhất một lần thành công (status = 'submitted', 'grading', hoặc 'disqualified').

## 2. Các thay đổi về Logic (Server-side)
- **`getQuizStatsSummary` (src/lib/adminStats.functions.ts):**
  - Trả về thêm trường `lastUpdatedAt`: Lấy giá trị `max(last_updated_at)` từ bảng `candidate_quiz_stats`.
  - Đảm bảo `submittedCount` luôn là số người đã nộp bài (deduplicated).
- **`getPublicParticipationRates` (src/lib/participationRate.functions.ts):**
  - Đảm bảo đồng bộ định nghĩa "done" với `submittedCount`.

## 3. Các thay đổi về Giao diện (Frontend)
### Trang chủ (`src/routes/index.tsx`)
- Thêm `Tooltip` giải thích cho hai ô `StatTile` (Lượt thi & Người tham gia).
- Hiển thị dòng "Dữ liệu cập nhật lúc: [Thời gian]" bên dưới các ô thống kê.
- Đồng bộ hiển thị "Tham gia" trên các thẻ cuộc thi.

### Bảng xếp hạng (`src/routes/bang-xep-hang.tsx`)
- Thêm `Tooltip` giải thích định nghĩa các chỉ số trong phần tóm tắt thống kê.
- Hiển thị thời điểm đồng bộ dữ liệu cuối cùng.

### Thành phần dùng chung (`src/components/ui-kit.tsx`)
- Cập nhật `SectionHeading` để hỗ trợ tooltip hoặc thông tin bổ sung nếu cần.

## 4. Các bước triển khai chi tiết
1.  **Cập nhật Server Function:**
    *   Chỉnh sửa `src/lib/adminStats.functions.ts` để lấy `last_updated_at`.
2.  **Cập nhật UI Components:**
    *   Thêm `TooltipProvider` vào `AppShell` hoặc bọc các trang cần thiết.
    *   Chèn nội dung giải thích vào các vị trí nhạy cảm về số liệu.
    *   Format thời gian đồng bộ thân thiện với người dùng (ví dụ: "vừa xong", "5 phút trước").

## 5. Danh sách các file sẽ chỉnh sửa
- `src/lib/adminStats.functions.ts`
- `src/routes/index.tsx`
- `src/routes/bang-xep-hang.tsx`
- `src/components/AppShell.tsx` (Nếu cần bọc TooltipProvider)

---
*Lưu ý: Việc sử dụng bảng `candidate_quiz_stats` giúp hệ thống phản hồi nhanh mà không tốn tài nguyên tính toán lại từ hàng vạn bản ghi `exam_sessions` mỗi lần người dùng truy cập.*
