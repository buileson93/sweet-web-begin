# Hiển thị thời gian hoàn thành bài thi tới mili-giây

## Hiện trạng (đã kiểm tra)
- Bảng `results` chỉ lưu `time_seconds` (số nguyên giây). Khi nộp bài, `src/lib/exam/submit.server.ts` làm tròn: `Math.round((endMoment - startedAt)/1000)`.
- Mọi nơi hiển thị đều dùng `formatSeconds()` trong `src/lib/format.ts` → dạng `mm:ss` (Bảng xếp hạng, Podium, Lịch sử, Nhân vật, Admin Kết quả, Lịch sử nhân viên, Awards).
- Xếp hạng phá hoà theo `time_seconds` (`src/lib/leaderboard.ts`), nên hai người cùng số giây đang bị coi là bằng nhau.

## Mục tiêu
Đo và hiển thị thời gian làm bài chính xác tới mili-giây (`mm:ss.mmm`), đồng thời dùng độ chính xác này để phá hoà xếp hạng công bằng hơn.

## Các bước

1. **Cơ sở dữ liệu**
   - Thêm cột `time_ms integer` vào `public.results` (mặc định `NULL`).
   - Backfill dữ liệu cũ: `time_ms = time_seconds * 1000` để không có ô trống.
   - Giữ nguyên `time_seconds` để mọi tính năng/RPC/thống kê hiện có không vỡ.

2. **Lúc nộp bài** (`src/lib/exam/submit.server.ts`)
   - Tính `timeMs` từ chênh lệch mốc thời gian (không làm tròn), `time_seconds` vẫn = `round(timeMs/1000)`.
   - Ghi cả hai cột; khi xem lại (replay) giữ nguyên giá trị cũ.

3. **Định dạng hiển thị** (`src/lib/format.ts`)
   - Thêm `formatDuration(ms)` → `mm:ss.mmm`, và bộ nhận đầu vào linh hoạt: nếu không có `time_ms` thì suy ra từ `time_seconds` và hiển thị `mm:ss.000`.
   - Có kiểm thử đơn vị (vitest) cho các mốc: 0, dưới 1 giây, đúng phút, hơn 60 phút.

4. **Cập nhật giao diện** (chỉ đổi phần hiển thị)
   - Bảng xếp hạng (`src/routes/bang-xep-hang.tsx`), `Podium`, `AwardsBoard`/`awards.ts` (kỷ lục tốc độ), Lịch sử (`lich-su.tsx`), Nhân vật (`nhan-vat.tsx`), Admin `ResultManager`, `EmployeeHistoryManager`.
   - Cột xuất Excel thêm giá trị mili-giây để đối chiếu.
   - Nơi nào chật chỗ (thẻ mobile) vẫn dùng `mm:ss`, phần mili-giây hiển thị nhỏ hơn hoặc trong tooltip.

5. **Xếp hạng** (`src/lib/leaderboard.ts`, `champions.ts`)
   - Phá hoà theo `time_ms` khi có, ngược lại `time_seconds * 1000`. Cập nhật/bổ sung test hiện có.

## Ghi chú kỹ thuật
- Truy vấn ở `leaderboard.functions.ts`, `history.server.ts`, `ResultManager`, `EmployeeHistoryManager` cần thêm `time_ms` vào danh sách cột `select`.
- Không đổi thứ tự sắp xếp phía SQL (`order("time_seconds")`) để tránh ảnh hưởng hiệu năng; việc phá hoà chi tiết làm ở tầng xếp hạng trong ứng dụng.
- Độ chính xác thực tế phụ thuộc mốc `started_at`/thời điểm nộp trên máy chủ, nên mili-giây mang tính so sánh tương đối, không phải đồng hồ bấm giờ tuyệt đối.
