# Sửa lỗi trùng hàm khoá thiết bị thi

## Lỗi là gì

Trong cơ sở dữ liệu hiện đang tồn tại **hai phiên bản** của cùng một hàm `claim_exam_device`:

- Bản cũ: 4 tham số (mã thiết bị, nhân viên, tên thí sinh, thời gian nguội)
- Bản mới: 6 tham số, thêm địa chỉ IP và trình duyệt — nhưng hai tham số này có giá trị mặc định

Khi mã nguồn gọi hàm với đúng 4 tham số, cơ sở dữ liệu không biết chọn bản nào (bản 6 tham số cũng khớp nhờ giá trị mặc định), nên báo "Could not choose the best candidate function". Hậu quả: thí sinh có thể không vào được phòng thi vì bước khoá thiết bị thất bại.

## Cách khắc phục

1. Xoá bản cũ 4 tham số, chỉ giữ lại bản 6 tham số (đầy đủ IP + trình duyệt, chống gian lận tốt hơn).
2. Cập nhật nơi gọi trong `src/lib/exam/session.server.ts` để truyền thêm IP và trình duyệt (lấy từ request headers phía máy chủ), tránh phụ thuộc vào giá trị mặc định.

## Chi tiết kỹ thuật

- Migration: `DROP FUNCTION public.claim_exam_device(text, uuid, text, integer);` (chỉ bản 4 tham số).
- `startExamSession` truyền `p_ip` và `p_ua` lấy từ header của request (`x-forwarded-for`, `user-agent`) khi gọi RPC.
- Kiểu dữ liệu Supabase sẽ được tạo lại sau migration; điều chỉnh lời gọi RPC theo chữ ký mới.
- Không thay đổi giao diện.
