# Giai đoạn 0 — Đo lường trước khi làm

**Mục tiêu:** có dữ liệu thật về hành vi trả lời trước khi viết bất kỳ thuật toán
lịch ôn nào. Giai đoạn này **không có giao diện mới**, rủi ro gần bằng 0.

## Phạm vi

| Làm | Không làm |
| --- | --- |
| Thêm bảng `review_log` | Sửa logic chấm điểm |
| Ghi log từ luồng thi + luyện tập (fire-and-forget) | Đổi schema `questions`, `exam_sessions` |
| Báo cáo hiệu chuẩn độ khó (chỉ đọc) | Bất kỳ thay đổi UI thi nào |

## Việc cần làm

- [ ] Migration `review_log`:
      `id, employee_id, question_id, correct boolean, fraction numeric, ms_taken int, mode text, tags text[], created_at`
      — idempotent, RLS bật, `GRANT` cho `authenticated` (đọc của chính mình) và
      `service_role` (toàn quyền). Không `anon`.
- [ ] Chỉ mục: `(employee_id, created_at desc)`, `(question_id)`.
- [ ] `src/lib/review/log.server.ts`: hàm `logReviews(rows)` ghi **theo lô một
      lệnh insert**, bọc `try/catch`, không bao giờ throw ra ngoài.
- [ ] Nối vào 2 điểm, mỗi điểm đúng **một dòng gọi**, đặt sau khi kết quả đã
      được tính và trả về:
      - `src/lib/exam/submit.server.ts` — sau khi tính xong `review[]`
      - luyện tập/đấu trường: `src/lib/arena/duel.server.ts` khi chốt lượt
      Quy tắc: gọi cuối hàm, không `await` chặn đường trả kết quả, lỗi ghi log
      không được ảnh hưởng kết quả thi.
- [ ] Báo cáo hiệu chuẩn (chỉ SQL đọc, chạy thủ công): đối chiếu
      `questions.difficulty` với tỉ lệ đúng thực tế — tái dùng
      `src/lib/questionInsights.ts` đã có.
- [ ] Kiểm kê `Blueprint.tags`: bao nhiêu % câu đã có tag chủ đề dùng được.

## Test

- `src/lib/review/log.test.ts`: hàm dựng dòng log thuần (map từ kết quả chấm →
  mảng row), phủ trường hợp câu bỏ trống, câu đúng một phần, mảng rỗng.
- Test hồi quy: `submit.server` vẫn trả đúng kết quả khi hàm ghi log ném lỗi.

## Nghiệm thu

- ≥ 2.000 dòng `review_log` tích luỹ.
- Biết % câu bị gán sai độ khó.
- **Thời gian nộp bài không tăng quá 10 ms**; không có lỗi mới trong log kỳ thi.
