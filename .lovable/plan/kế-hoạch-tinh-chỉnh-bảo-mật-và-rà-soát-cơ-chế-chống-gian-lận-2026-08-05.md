# Kế hoạch tinh chỉnh bảo mật và rà soát cơ chế chống gian lận

Dựa trên lo ngại "sợ tinh chỉnh lại lộ kẽ hở cho gian lận", tôi sẽ thực hiện một kế hoạch cân bằng: vừa giảm tỷ lệ báo cáo "oan" do lỗi mạng, vừa thắt chặt các biện pháp kỹ thuật ngầm để đảm bảo không một script nào có thể lợi dụng kẽ hở.

## Các biện pháp thắt chặt bảo mật (Không lộ kẽ hở)

### 1. Giữ nguyên tính "Fail-Closed" đối với script thật
- **Token Liveness**: Vẫn bắt buộc phải có chữ ký từ khoá riêng trong trình duyệt (không thể giả mạo bằng script ngoài trang).
- **Honeypot (Mồi ẩn)**: Vẫn giữ nguyên mức phạt nặng nhất vì chỉ script quét DOM mới bấm trúng.

### 2. Tinh chỉnh Cloudflare Turnstile (Chỉ nới lỏng lỗi hạ tầng)
- Chỉ bỏ qua khi xác nhận lỗi là do **mạng (network error)** từ phía thí sinh đến Cloudflare.
- Nếu thí sinh gửi token sai hoặc token hết hạn, hệ thống vẫn sẽ từ chối và yêu cầu xác minh lại.

### 3. Cập nhật giao diện thông báo
- Cập nhật Header Bảng xếp hạng để khẳng định: Hệ thống được tinh chỉnh để bảo vệ thí sinh thật nhưng vẫn duy trì các chốt chặn nghiêm ngặt nhất đối với mọi hành vi gian lận kỹ thuật.

## Các bước thực hiện

1. **Chỉnh sửa `src/routes/bang-xep-hang.tsx`**: Cập nhật đoạn văn header để khẳng định cam kết bảo mật tuyệt đối, không tạo kẽ hở cho gian lận.
2. **Chỉnh sửa `src/lib/turnstile.server.ts`**: Đảm bảo logic `skipped` chỉ áp dụng cho lỗi hạ tầng mạng, không áp dụng cho trường hợp cố tình gửi token sai.
3. **Chỉnh sửa `src/lib/integrity.ts`**: Giữ nguyên trọng số cao cho các hành vi chắc chắn là script (như `honeypot_hit` và `untrusted_input`).

Kế hoạch này đảm bảo hệ thống vẫn là "pháo đài" chống gian lận nhưng thông minh hơn trong việc nhận diện thí sinh thật gặp sự cố mạng.
