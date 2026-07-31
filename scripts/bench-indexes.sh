#!/usr/bin/env bash
# =============================================================================
# Đo hiệu năng 10 truy vấn nóng nhất bằng EXPLAIN (ANALYZE, BUFFERS).
# Lấy thời gian tốt nhất trong 5 lần chạy để loại nhiễu cache.
#
#   scripts/bench-indexes.sh            # dùng biến môi trường PG* sẵn có
#   scripts/bench-indexes.sh "<DSN>"    # hoặc chỉ định chuỗi kết nối
#
# CHỈ ĐỌC — không ghi gì vào CSDL.
#
# Lưu ý: CSDL sản xuất hiện có rất ít dòng nên mọi truy vấn đều dưới 2 ms và
# planner thường chọn Seq Scan. Muốn đánh giá đúng tác dụng của chỉ mục, hãy
# dựng CSDL thử bằng db/baseline.sql rồi sinh dữ liệu giả quy mô lớn
# (~200k results / 240k exam_sessions) trước khi chạy script này.
# =============================================================================
set -euo pipefail

DSN="${1:-}"
PSQL=(psql -X)
[[ -n "$DSN" ]] && PSQL=(psql -X "$DSN")

QID=$("${PSQL[@]}" -Atc "SELECT id FROM quizzes ORDER BY created_at LIMIT 1")
EID=$("${PSQL[@]}" -Atc "SELECT id FROM employees WHERE is_active LIMIT 1")
[[ -z "$QID" || -z "$EID" ]] && { echo "Cần ít nhất 1 cuộc thi và 1 nhân viên."; exit 1; }

run() {
  local name="$1" sql="$2" best="" plan=""
  for _ in 1 2 3 4 5; do
    plan=$("${PSQL[@]}" -c "EXPLAIN (ANALYZE, BUFFERS, COSTS OFF) $sql")
    local t
    t=$(echo "$plan" | grep 'Execution Time' | grep -oE '[0-9.]+')
    best=$(python3 -c "print(min(x for x in ['${best:-}','$t'] if x))")
  done
  printf '### %-32s %8s ms\n' "$name" "$best"
  echo "$plan" | grep -E 'Scan on|Scan using|Bitmap Index|Sort Method|Buffers: shared hit' | head -4 | sed 's/^/    /'
}

run "Q1 dem luot + bestPercent"  "SELECT score,total FROM results WHERE quiz_id='$QID' AND employee_id='$EID' AND disqualified=false"
run "Q2 bang xep hang"           "SELECT candidate_name,score,time_seconds FROM results WHERE quiz_id='$QID' AND disqualified=false ORDER BY score DESC, time_seconds ASC LIMIT 50"
run "Q3 loadLivePage danh sach"  "SELECT id,quiz_id,candidate_name,started_at FROM exam_sessions WHERE started_at >= now()-interval '2 hours' ORDER BY started_at DESC LIMIT 21"
run "Q3b loadLivePage dem"       "SELECT count(*) FROM exam_sessions WHERE started_at >= now()-interval '2 hours' AND submitted_at IS NULL AND expires_at > now()"
run "Q4 verifyEmployee"          "SELECT id,full_name FROM employees WHERE name_key=(SELECT name_key FROM employees WHERE id='$EID') AND is_active=true"
run "Q4b chong do mat khau"      "SELECT created_at FROM employee_login_attempts WHERE name_key=(SELECT name_key FROM employees WHERE id='$EID') AND success=false AND created_at >= now()-interval '15 minutes' ORDER BY created_at DESC LIMIT 10"
run "Q5 pool cau hoi"            "SELECT id,question FROM questions WHERE quiz_id='$QID' AND is_archived=false ORDER BY order_index, created_at"
run "Q6 phien theo NV+trangthai" "SELECT id FROM exam_sessions WHERE employee_id='$EID' AND status='active'"
run "Q7 auto-submit cron"        "SELECT id FROM exam_sessions WHERE status='active' AND expires_at < now() LIMIT 100"
run "Q8 ket qua theo phien"      "SELECT id,disqualified FROM results WHERE session_id=(SELECT id FROM exam_sessions ORDER BY started_at DESC LIMIT 1)"
