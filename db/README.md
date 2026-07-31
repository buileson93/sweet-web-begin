# Baseline schema

| File | Vai trò |
|---|---|
| `baseline.sql` | Toàn bộ schema production trong MỘT file: extension, enum, bảng, ràng buộc, chỉ mục, hàm, trigger, RLS, GRANT, policy, storage bucket, publication realtime. |
| `schema-snapshot.sql` | Truy vấn chỉ-đọc, xuất ảnh chụp schema dạng văn bản chuẩn hoá để so sánh hai CSDL. |
| `_archive/` | Bản sao 24 migration cũ + giải thích (xem `_archive/README.md`). |
| `../scripts/verify-baseline.sh` | Script kiểm chứng tự động. |

## Chạy ở đâu

- **Môi trường đã deploy**: KHÔNG chạy `baseline.sql`. Schema đã đúng.
- **Môi trường mới**: chỉ chạy `baseline.sql` (yêu cầu sẵn có vai trò
  `anon` / `authenticated` / `service_role`, schema `auth` / `storage` /
  `extensions`, hàm `auth.uid()` và publication `supabase_realtime` — Supabase
  tạo sẵn những thứ này).
- **Thay đổi về sau**: tạo migration mới, không sửa `baseline.sql`.

## Kiểm chứng

```bash
scripts/verify-baseline.sh "<DSN_CSDL_HIỆN_TẠI>" ["<DSN_CSDL_TRỐNG>"]
```

Hoặc thủ công:

```bash
# 1. Dựng Postgres trống, tạo vai trò/schema nền, rồi:
psql "$FRESH" -v ON_ERROR_STOP=1 -f db/baseline.sql

# 2. Chụp và so sánh
psql -At "$CURRENT" -f db/schema-snapshot.sql | sort > /tmp/current.txt
psql -At "$FRESH"   -f db/schema-snapshot.sql | sort > /tmp/baseline.txt
diff /tmp/baseline.txt /tmp/current.txt   # phải RỖNG
```

`pg_dump --schema-only` cũng dùng được để so sánh, nhưng nó bỏ sót quyền cấp
theo cột và nội dung `storage.buckets`, đồng thời thêm nhiều nhiễu về thứ tự và
comment. `schema-snapshot.sql` chuẩn hoá sẵn nên diff sạch hơn.

## Kết quả kiểm chứng lần chạy 2026-07-31

Đã dựng Postgres trống, áp dụng `baseline.sql` không lỗi, so sánh với CSDL hiện tại:

```
329 dòng ảnh chụp (baseline)  ==  329 dòng ảnh chụp (hiện tại)
diff  ->  RỖNG
```

Bao gồm khớp tuyệt đối: 11 bảng, 25 ràng buộc, 46 chỉ mục, 24 policy public +
4 policy storage, ACL bảng và ACL theo cột, 4 hàm (so bằng md5 của
`pg_get_functiondef`), 3 trigger, bucket `question-images`, publication realtime
lọc cột trên `results`, và RLS bật trên **toàn bộ 11 bảng** của schema `public`.

Vai trò kỹ thuật `sandbox_exec` (chỉ có ở môi trường phát triển) được lọc khỏi
phép so sánh.
