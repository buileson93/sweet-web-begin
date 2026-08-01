# Leo Tháp Tri Thức — Bộ kế hoạch theo giai đoạn

Nguồn: bản thiết kế "Leo Tháp Tri Thức" (roguelike ôn tập cho Hội thi VATM).
Tài liệu gốc dài 1.100 dòng đã được chia thành **4 file kế hoạch** để thực thi tuần tự.

| File | Giai đoạn | Mục tiêu chính | Ước lượng |
| --- | --- | --- | --- |
| [phase-0-do-luong.md](./phase-0-do-luong.md) | 0 | `review_log` + đo lường, không đụng UI | 1–1,5 tuần |
| [phase-1-lich-on.md](./phase-1-lich-on.md) | 1 | `learner_cards` + Leitner 5 bậc + hàng đợi đến hạn | 2 tuần |
| [phase-2-vo-leo-thap.md](./phase-2-vo-leo-thap.md) | 2 | Tuyến `dau-truong_.leo-thap`, 3 RPC, gói đề IndexedDB, đồ hoạ đợt A | 3–4 tuần |
| [phase-3-4-chieu-sau.md](./phase-3-4-chieu-sau.md) | 3 + 4 | Elo chủ đề, bản đồ năng lực, báo cáo tổ chức | 3 tuần |

## Ràng buộc bất di bất dịch (áp cho MỌI giai đoạn)

1. **Không chạm hệ thống thi trắc nghiệm.** Tuyệt đối không sửa
   `src/lib/exam/*`, `src/lib/exam.server.ts`, `src/lib/exam.functions.ts`,
   `src/routes/thi.tsx`, `src/lib/grading.ts`, bảng `exam_sessions` / `results` /
   `exam_events`. Nếu cần dữ liệu từ luồng thi, chỉ **đọc** hoặc ghi log
   *fire-and-forget* qua một hàm riêng, bọc `try/catch`, lỗi thì nuốt im lặng.
2. **Không chạm hệ thống ra đề.** `questions`, `quizzes`, `QuestionManager`,
   `QuestionForm`, importer — chỉ đọc. Không thêm cột bắt buộc, không thêm trigger
   lên `questions`.
3. **Chỉ thêm bảng mới, migration idempotent.** Mọi bảng mới nằm ngoài đường đi
   của kỳ thi; có RLS + GRANT đầy đủ; `create table if not exists`.
4. **Không kênh realtime, không cron, không tác vụ nền** cho Leo Tháp.
5. **Không gửi đáp án đúng xuống client** ở chế độ có xếp hạng — giữ nguyên
   tinh thần `FORBIDDEN_KEYS`.
6. **Tách gói theo tuyến.** Người không vào Leo Tháp không tải thêm 1 KB nào.
7. **TDD**: mọi logic thuần (lịch ôn, chọn câu, hiệu ứng trợ học) có test vitest
   trước khi nối vào server. Chạy lint + typecheck + test sau mỗi task.
8. **Điều hướng**: số mục menu chính trước và sau phải bằng nhau — Leo Tháp là
   một thẻ trong sảnh `dau-truong.tsx`.

## Cổng kiểm soát giữa các giai đoạn

Không bắt đầu giai đoạn sau nếu chưa đạt phần "Nghiệm thu" của giai đoạn trước
**và** chưa xác nhận: kỳ thi chạy bình thường, thời gian nộp bài không đổi,
số truy vấn của luồng thi không tăng.
