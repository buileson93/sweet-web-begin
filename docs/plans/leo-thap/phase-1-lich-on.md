# Giai đoạn 1 — Động cơ lặp lại ngắt quãng

**Mục tiêu:** đúng thuật toán lịch ôn, **chưa cần giao diện tháp**.
Điểm vào duy nhất: một huy hiệu "N thẻ cần ôn" trên thẻ Luyện tập trong sảnh
`dau-truong.tsx`, bấm vào mở đúng phiên ôn đơn giản.

## Cơ sở dữ liệu (chỉ thêm mới)

```
learner_cards(employee_id, question_id, box smallint, next_due_at timestamptz,
              lapses int, last_reviewed_at timestamptz)
  primary key (employee_id, question_id)   -- không cột id riêng
  index (employee_id, next_due_at)
```

- **Tạo lười**: chỉ sinh dòng khi người học gặp câu lần đầu. Không backfill toàn
  bộ (1,5 triệu dòng — cấm).
- RLS: người dùng chỉ đọc dòng của mình; ghi qua `service_role` trong server fn.
- Dòng gọn, không JSONB.

## Logic thuần (viết test trước)

`src/lib/tower/leitner.ts`:

| Hàm | Nội dung |
| --- | --- |
| `nextBox(box, correct)` | đúng → +1 (tối đa 5); sai → về 1, `lapses += 1` |
| `intervalDays(box)` | 1 · 3 · 7 · 16 · 35 |
| `scheduleCard(card, correct, now)` | trả `{ box, next_due_at, lapses }` |
| `pickDueQueue(cards, limit, opts)` | xen kẽ chủ đề: không quá 2 câu liên tiếp cùng tag |

`src/lib/tower/leitner.test.ts` phủ: lên hộp, rớt hộp, kịch trần hộp 5,
biên giới đến hạn (`next_due_at = now`), xen kẽ khi chỉ có 1 chủ đề.

## Máy chủ

- `src/lib/tower.functions.ts` (client-safe) → `src/lib/tower/*.server.ts`.
- `getDueCount()` — 1 truy vấn `count` có chỉ mục, cache 60 s phía client.
- `submitReviews(batch)` — **một** `insert … on conflict do update` cho cả lô +
  **một** insert `review_log`. Tối đa 2 truy vấn cho mỗi chặng.
- Không cron, không job đêm: "đến hạn" tính lười theo `now()`.

## Giao diện tối thiểu

- Huy hiệu số trên thẻ Luyện tập sẵn có (`PracticePanel`) — **không thêm menu**.
- Danh sách phiên ôn dùng lại `QuestionCard` hiện có, không viết mới.

## Không được làm

- Không sửa `src/lib/exam/*`, `grading.ts`, `QuestionManager`, `QuestionForm`.
- Không thêm trigger lên `questions`.
- Không xoá/đổi chế độ đánh bot hiện tại ở giai đoạn này.

## Nghiệm thu

- Tỉ lệ đúng ở lần ôn thứ hai của cùng một thẻ **tăng rõ rệt** so với lần đầu.
- Lấy hàng đợi đến hạn < 150 ms.
- Kỳ thi và trình ra đề không thay đổi hành vi; toàn bộ test cũ vẫn xanh.
