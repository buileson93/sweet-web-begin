# Giai đoạn 2 — Vỏ Leo Tháp

**Mục tiêu:** chế độ chơi hoàn chỉnh trên tuyến riêng, tải lười, không realtime.

## 2A. Trả nợ hiệu năng Đấu trường (làm trước tiên)

- [ ] Bỏ một trong hai bộ lắng nghe trùng (`broadcast` vs `postgres_changes`).
- [ ] `broadcast: { self: false }`.
- [ ] `MIN_GAP_MS` 350 → 120; `BATCH_WINDOW_MS` 70 → 30.
- [ ] Nới thăm dò dự phòng 4000/1200 → 10000/2000 ms.
- [ ] Preload sprite atlas dùng chung.

Đo ping / eventLag **trước và sau**; không được xấu đi.

## 2B. Tuyến và điều hướng

- Tuyến con `src/routes/dau-truong_.leo-thap.tsx`, **lazy**, gói riêng ≤ 120 KB gzip,
  ảnh hưởng gói chung **+0 KB**.
- Sảnh `dau-truong.tsx` đúng **ba thẻ**: Đấu xếp hạng · Leo Tháp · Thống kê.
  `PracticePanel` được **nâng cấp thành** Leo Tháp, không tồn tại song song.
- Tổng kết phiên dùng lại khung `dau-truong_.xem-lai.$duelId`.

## 2C. Máy chủ — 3 RPC, không hơn

| RPC | Việc | Lượt đi về |
| --- | --- | --- |
| `tower_start_run` | lấy hàng đợi (LIMIT 75), tạo `tower_runs`, trả **mảng id** cả phiên | 1 |
| `tower_submit_stage` | chấm lại cả chặng, upsert lô `learner_cards`, ghi lô `review_log`, trả chặng kế | 1 |
| `tower_finish_run` | tổng kết, cộng xu, cập nhật `topic_ratings` | 1 |

Bảng mới: `tower_runs(id, employee_id, seed, state jsonb ≤32KB, version, status, started_at, finished_at)`,
`tower_run_events(run_id, seq, kind, payload, created_at)`.
Ngân sách: **≤ 45 truy vấn / phiên 12–15 phút**.

## 2D. Gói đề IndexedDB (tối ưu quan trọng nhất — làm sớm)

- `bank_version` tăng khi admin sửa đề (đọc từ `max(updated_at)`, **không thêm
  trigger lên `questions`**).
- Client tải gói đề nén **không chứa đáp án**, lưu IndexedDB; lần sau chỉ gửi
  `bank_version`, trùng thì `304`.
- Trong phiên máy chủ chỉ trả id câu + thứ tự xáo phương án.

## 2E. Luật chơi

- 5 chặng × 5 câu; bài tổng hợp ở chặng 5; góc sửa lỗi giữa các chặng.
- Máu không hồi; ngưỡng dừng khi sai > 40% một chặng — **không dùng ngôn từ thất bại**.
- 8 trợ học (5 Thường + 3 Hiếm), chọn 1 trong 3.
- Chế độ mặc định **Ôn nhanh** (chấm client, máy chủ chấm lại cuối chặng).
  Chế độ **Tháp thi đấu** có xếp hạng: đáp án **không bao giờ** rời máy chủ.
- Trợ học và nguyên mẫu chặng **đọc từ JSON ngay bản đầu** (ngôn ngữ hiệu ứng
  dữ liệu hoá) — làm sau sẽ rất đắt.
- Gợi ý nghỉ mềm sau phiên thứ 2 trong ngày; nhắc chứ không chặn.

## 2F. Hiệu năng client (bắt buộc)

- **Một** vòng `requestAnimationFrame` cho đồng hồ + sprite + hiệu ứng; không `setInterval`.
- Đồng hồ ghi thẳng vào DOM/biến CSS, không `setState` mỗi khung.
- Không đặt `RunState` vào context bao cả cây; lấy trạng thái có chọn lọc.
- Nạp trước câu kế trong cùng phản hồi chặng.
- **Cấm dùng lại `useDuelChannel`** hay bất kỳ kênh realtime nào.
- Đồ hoạ đợt A: số bật lên, dừng hình khi trúng, thanh máu hai lớp, preload sprite.

## Test

- `tower/rng.test.ts` — RNG có hạt tái lập.
- `tower/damage.test.ts` — khoá cứng thứ tự:
  `xúc xắc → combo → kỹ năng → lớp → trợ học → thưởng bộ → ràng buộc`.
- `tower/select.test.ts` — chọn câu, xen kẽ chủ đề, chống lặp 3 phiên gần nhất.
- `tower/boon.test.ts` — thông dịch hiệu ứng từ JSON.

## Nghiệm thu

- Phiên 12–15 phút; tỉ lệ đúng 80–85%.
- ≤ 45 truy vấn/phiên; **không một kênh realtime nào được mở**.
- Vào câu đầu < 1,5 s; chấm → hiện kết quả < 300 ms (p95); ≥ 50 fps.
- Kỳ thi, ra đề, đấu xếp hạng: hành vi và hiệu năng không đổi.
