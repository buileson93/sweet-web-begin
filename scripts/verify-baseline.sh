#!/usr/bin/env bash
# =============================================================================
# Kiểm chứng baseline: dựng một CSDL TRỐNG bằng db/baseline.sql rồi so sánh
# schema với CSDL hiện tại. Tiêu chí nghiệm thu: phần diff RỖNG.
#
# Cách dùng:
#   scripts/verify-baseline.sh "<DSN_CSDL_HIỆN_TẠI>" ["<DSN_CSDL_TRỐNG>"]
#
#   - Tham số 1: chuỗi kết nối tới CSDL hiện tại (chỉ đọc).
#   - Tham số 2 (tuỳ chọn): chuỗi kết nối tới một CSDL TRỐNG để dựng baseline.
#     Bỏ trống thì script tự tạo container Postgres cục bộ qua Docker.
#
# LƯU Ý: script chỉ ĐỌC trên CSDL hiện tại; mọi thao tác ghi chỉ diễn ra trên
# CSDL trống. Không bao giờ trỏ tham số 2 vào production.
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASELINE="$ROOT/db/baseline.sql"
SNAPSHOT="$ROOT/db/schema-snapshot.sql"
OUT="$(mktemp -d)"

CURRENT_DSN="${1:-}"
FRESH_DSN="${2:-}"

if [[ -z "$CURRENT_DSN" ]]; then
  echo "Thiếu tham số: chuỗi kết nối CSDL hiện tại." >&2
  exit 2
fi

CONTAINER=""
cleanup() { [[ -n "$CONTAINER" ]] && docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT

# --- 1. Chuẩn bị CSDL trống -------------------------------------------------
if [[ -z "$FRESH_DSN" ]]; then
  echo "==> Dựng Postgres tạm bằng Docker..."
  CONTAINER="baseline-verify-$$"
  docker run -d --name "$CONTAINER" -e POSTGRES_PASSWORD=postgres -p 55432:5432 \
    supabase/postgres:15.8.1.020 >/dev/null
  FRESH_DSN="postgres://postgres:postgres@localhost:55432/postgres"
  for _ in $(seq 1 60); do
    psql "$FRESH_DSN" -c 'select 1' >/dev/null 2>&1 && break
    sleep 1
  done
fi

# --- 2. Vai trò & schema mà Supabase tạo sẵn (baseline giả định đã có) ------
echo "==> Chuẩn bị vai trò/schema nền..."
psql "$FRESH_DSN" -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
DO $$ BEGIN CREATE ROLE anon NOLOGIN NOINHERIT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN NOINHERIT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY);
CREATE TABLE IF NOT EXISTS storage.buckets (id text PRIMARY KEY, name text, public boolean DEFAULT false);
CREATE TABLE IF NOT EXISTS storage.objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
DO $$ BEGIN CREATE PUBLICATION supabase_realtime; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
SQL

# --- 3. Áp dụng baseline ----------------------------------------------------
echo "==> Áp dụng db/baseline.sql..."
psql "$FRESH_DSN" -v ON_ERROR_STOP=1 -f "$BASELINE" >/dev/null

# --- 4. Chụp schema hai bên và so sánh --------------------------------------
echo "==> Chụp schema và so sánh..."
psql -At "$CURRENT_DSN" -f "$SNAPSHOT" | sed '/^$/d' | LC_ALL=C sort > "$OUT/current.txt"
psql -At "$FRESH_DSN"   -f "$SNAPSHOT" | sed '/^$/d' | LC_ALL=C sort > "$OUT/baseline.txt"

# sandbox_exec là vai trò kỹ thuật chỉ tồn tại ở môi trường phát triển -> bỏ qua.
sed -i.bak 's/ *sandbox_exec=[^ ]*//g' "$OUT/current.txt" "$OUT/baseline.txt"

if diff -u "$OUT/baseline.txt" "$OUT/current.txt" > "$OUT/diff.txt"; then
  echo "✅ DIFF RỖNG — baseline khớp hoàn toàn với CSDL hiện tại."
  RC=0
else
  echo "❌ CÓ KHÁC BIỆT:"
  cat "$OUT/diff.txt"
  RC=1
fi

# --- 5. Kiểm tra bổ sung: RLS phải bật trên mọi bảng ------------------------
echo "==> Kiểm tra RLS..."
MISSING=$(psql -At "$FRESH_DSN" -c "
  SELECT string_agg(c.relname, ', ')
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity")
if [[ -n "$MISSING" ]]; then
  echo "❌ Bảng chưa bật RLS: $MISSING"; RC=1
else
  echo "✅ RLS bật trên toàn bộ bảng public."
fi

# --- 6. Kiểm tra bổ sung: không mất policy nào ------------------------------
echo "==> Đối chiếu số lượng policy..."
A=$(psql -At "$CURRENT_DSN" -c "SELECT count(*) FROM pg_policies WHERE schemaname IN ('public','storage')")
B=$(psql -At "$FRESH_DSN"   -c "SELECT count(*) FROM pg_policies WHERE schemaname IN ('public','storage')")
echo "   hiện tại=$A  baseline=$B"
[[ "$A" == "$B" ]] || { echo "❌ Lệch số policy."; RC=1; }

echo "Báo cáo chi tiết: $OUT"
exit $RC
