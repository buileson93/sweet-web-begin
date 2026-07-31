# Kho lưu trữ migration (trước baseline)

Đây là **bản sao** của 24 file trong `supabase/migrations/` tính đến 2026-07-31,
được giữ lại làm tư liệu lịch sử. Toàn bộ nội dung của chúng đã được gộp vào
`db/baseline.sql`.

> Thư mục `supabase/migrations/` do nền tảng quản lý nên không thể xoá/di chuyển
> file trực tiếp từ mã nguồn. Các file gốc vẫn nằm nguyên tại đó và **đã được
> đánh dấu là đã áp dụng** trên CSDL hiện tại, nên chúng sẽ không chạy lại.
> Baseline là *nguồn sự thật duy nhất* khi dựng môi trường mới.

## Quy tắc sử dụng

| Tình huống | Việc cần làm |
|---|---|
| Môi trường **đã deploy** (production hiện tại) | **KHÔNG** chạy `baseline.sql`. Schema đã đúng trạng thái. Nếu dùng `supabase db` bên ngoài, đánh dấu baseline là đã áp dụng: `supabase migration repair --status applied 00000000000000` |
| Môi trường **mới hoàn toàn** | Chỉ chạy `db/baseline.sql`. Không chạy lại các file trong thư mục này. |
| Thay đổi schema **về sau** | Tạo migration mới qua công cụ migration của nền tảng. Không sửa `baseline.sql`. |

## Vì sao cần baseline

18+ file migration cũ chứa các cặp trùng lặp gần như y hệt do một lượt chạy
thất bại rồi chạy lại:

| File chạy hỏng (bỏ) | File thực sự có hiệu lực |
|---|---|
| `20260731053118_*` | `20260731071734_*` (giống hệt từng byte) |
| `20260731053259_*`, `20260731053538_*`, `20260731061051_*` | `20260731071858_*` (gộp cả ba) |
| `20260731062903_*`, `20260731063327_*` | `20260731071938_*` (gộp cả hai) |

Các file này **không idempotent** (`CREATE TYPE`, `CREATE TABLE`, `CREATE POLICY`
không có `IF NOT EXISTS`), nên chạy tuần tự trên một DB trống sẽ lỗi ngay ở file
thứ hai. Ngoài ra 4 file rỗng hoàn toàn (`053146`, `062832`, `071803`, `071916`).

## Những thứ chỉ có trong DB, không có trong file migration

Baseline bổ sung các mục sau vì chúng được tạo qua công cụ quản trị chứ không
qua migration — nếu dựng môi trường mới chỉ bằng các file cũ sẽ thiếu:

- Giá trị `staff`, `editor` của enum `app_role`
- Policy `results staff read`, `Admins and staff can read audit logs`,
  `Staff and admins can view employees` và nhóm policy `employees`
- Ba trigger `quizzes_touch`, `questions_touch`, `update_employees_updated_at`
- Storage bucket riêng tư `question-images` cùng 4 policy trên `storage.objects`
- Chỉ mục duy nhất từng phần `results_session_id_unique`

## Bổ sung trong baseline

- `CHECK (pass_percent BETWEEN 0 AND 100)` trên `quizzes`
- Toàn bộ chỉ mục hiệu năng (Prompt 11) và các chỉ mục thêm sau đó
- Ghi rõ ba bảng **cố ý không có policy** (`exam_sessions`, `exam_events`,
  `employee_login_attempts`) — chỉ truy cập qua server function bằng service role
