/**
 * Trợ giúp phía máy chủ cho màn "Theo dõi trực tiếp".
 * Mục tiêu: ít truy vấn (không N+1), có bộ nhớ đệm ngắn để nhiều người xem
 * cùng lúc không tạo tải trùng lặp, và trả về "vân tay" dữ liệu để client
 * chỉ cập nhật khi thực sự có thay đổi.
 */

const MONITOR_ROLES = ["admin", "staff", "editor"] as const;

/** Kiểm tra quyền bằng MỘT truy vấn thay vì gọi has_role nhiều lần. */
export async function assertMonitorRole(supabase: {
  from: (t: string) => any;
}, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", MONITOR_ROLES as unknown as string[])
    .limit(1);
  if (error) throw new Error("Không kiểm tra được quyền theo dõi kỳ thi.");
  if (!data || data.length === 0) throw new Error("Tài khoản không có quyền theo dõi kỳ thi.");
}

/** Hàm băm FNV-1a nhỏ gọn, đủ để phát hiện thay đổi. */
export function fingerprint(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

type CacheEntry = { at: number; value: unknown };
const cache = new Map<string, CacheEntry>();
/** Đệm 4 giây: nhiều quản trị viên cùng mở bảng chỉ tốn 1 lượt truy vấn. */
const CACHE_TTL_MS = 4_000;

export async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  const now = Date.now();
  if (hit && now - hit.at < CACHE_TTL_MS) return hit.value as T;
  const value = await load();
  cache.set(key, { at: now, value });
  if (cache.size > 50) {
    for (const [k, v] of cache) if (now - v.at > CACHE_TTL_MS) cache.delete(k);
  }
  return value;
}

/** Cửa sổ theo dõi: 2 giờ gần nhất. */
export function monitorSince() {
  return new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
}

import type { LivePage, LiveSession, SessionAnswer, SessionDetail } from "@/lib/monitorTypes";

/**
 * Nạp một trang phiên thi. Tất cả dữ liệu lấy bằng 4 truy vấn cố định
 * (danh sách + 2 bộ đếm + 1 truy vấn tên cuộc thi theo lô), không phụ thuộc
 * số dòng nên không có N+1.
 */
export async function loadLivePage(limit: number, offset: number): Promise<Omit<LivePage, "changed">> {
  return cached(`live:${limit}:${offset}`, async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = monitorSince();
    const nowIso = new Date().toISOString();

    const [page, activeCount, submittedCount] = await Promise.all([
      supabaseAdmin
        .from("exam_sessions")
        .select(
          "id, quiz_id, candidate_name, unit, started_at, expires_at, submitted_at, status, answers, question_ids",
        )
        .gte("started_at", since)
        .order("started_at", { ascending: false })
        .range(offset, offset + limit), // lấy dư 1 dòng để biết còn dữ liệu nữa không
      supabaseAdmin
        .from("exam_sessions")
        .select("id", { count: "exact", head: true })
        .gte("started_at", since)
        .is("submitted_at", null)
        .gt("expires_at", nowIso),
      supabaseAdmin
        .from("exam_sessions")
        .select("id", { count: "exact", head: true })
        .gte("started_at", since)
        .not("submitted_at", "is", null),
    ]);

    if (page.error) throw new Error(page.error.message);
    const all = page.data ?? [];
    const hasMore = all.length > limit;
    const slice = hasMore ? all.slice(0, limit) : all;

    const quizIds = [...new Set(slice.map((s) => s.quiz_id))];
    const titles = new Map<string, string>();
    if (quizIds.length) {
      const { data: quizzes } = await supabaseAdmin.from("quizzes").select("id, title").in("id", quizIds);
      for (const q of quizzes ?? []) titles.set(q.id, q.title);
    }

    const rows: LiveSession[] = slice.map((s) => ({
      id: s.id,
      quizId: s.quiz_id,
      quizTitle: titles.get(s.quiz_id) ?? "—",
      candidateName: s.candidate_name,
      unit: s.unit ?? "",
      startedAt: s.started_at,
      expiresAt: s.expires_at,
      submittedAt: s.submitted_at,
      status: s.status,
      answered: Object.keys((s.answers ?? {}) as Record<string, unknown>).length,
      total: (s.question_ids ?? []).length,
    }));

    const version = fingerprint(
      rows.map((r) => `${r.id}:${r.answered}:${r.status}:${r.submittedAt ?? ""}`).join("|") +
        `#${activeCount.count ?? 0}/${submittedCount.count ?? 0}`,
    );

    return {
      version,
      rows,
      hasMore,
      activeCount: activeCount.count ?? 0,
      submittedCount: submittedCount.count ?? 0,
      serverNow: nowIso,
    };
  });
}

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

/** Chi tiết một phiên thi: 3 truy vấn cố định, câu hỏi lấy theo lô. */
export async function loadSessionDetail(sessionId: string): Promise<SessionDetail> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: session, error } = await supabaseAdmin
    .from("exam_sessions")
    .select(
      "id, quiz_id, employee_id, candidate_name, unit, started_at, expires_at, submitted_at, status, answers, question_ids, option_orders, points, best_streak, integrity_score",
    )
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!session) throw new Error("Không tìm thấy phiên thi.");

  const [{ data: quiz }, { data: questions }, { data: employee }, { data: visits }] = await Promise.all([
    supabaseAdmin.from("quizzes").select("title").eq("id", session.quiz_id).maybeSingle(),
    supabaseAdmin
      .from("questions")
      .select("id, question, options, correct_index")
      .in("id", session.question_ids ?? []),
    session.employee_id
      ? supabaseAdmin
          .from("employees")
          .select("full_name, position, unit_name, birth_date, phone_last4")
          .eq("id", session.employee_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    session.employee_id
      ? supabaseAdmin
          .from("device_visits")
          .select(
            "ip, browser, browser_version, os, os_version, device_type, device_model, screen_w, screen_h, network_type, language, timezone, is_pwa, user_agent, created_at",
          )
          .eq("employee_id", session.employee_id)
          .order("created_at", { ascending: false })
          .limit(1)
      : Promise.resolve({ data: null }),
  ]);

  const visit = (visits ?? [])[0] ?? null;


  const byId = new Map((questions ?? []).map((q) => [q.id, q]));
  const rawAnswers = (session.answers ?? {}) as Record<string, number | number[] | string>;
  const orders = (session.option_orders ?? []) as number[][];

  const answers: SessionAnswer[] = (session.question_ids ?? []).map((qid: string, index: number) => {
    const q = byId.get(qid);
    const order = Array.isArray(orders[index]) ? orders[index] : null;
    const options = q ? (order ? order.map((i) => q.options[i] ?? "") : q.options) : [];
    const correctPos = q ? (order ? order.indexOf(q.correct_index) : q.correct_index) : -1;
    const picked = rawAnswers[String(index)] ?? rawAnswers[qid];
    const pickedPos = typeof picked === "number" ? picked : Array.isArray(picked) ? picked[0] : undefined;
    const answered = pickedPos !== undefined && pickedPos !== null && pickedPos >= 0;
    return {
      index,
      questionId: qid,
      question: q?.question ?? "(câu hỏi đã bị xoá)",
      options,
      answered,
      answerLabel: answered ? `${LETTERS[pickedPos!] ?? "?"}. ${options[pickedPos!] ?? ""}` : "Chưa trả lời",
      correctLabel: correctPos >= 0 ? `${LETTERS[correctPos] ?? "?"}. ${options[correctPos] ?? ""}` : "—",
      isCorrect: answered && pickedPos === correctPos,
    };
  });

  return {
    id: session.id,
    candidateName: session.candidate_name,
    unit: session.unit ?? "",
    quizTitle: quiz?.title ?? "—",
    startedAt: session.started_at,
    expiresAt: session.expires_at,
    submittedAt: session.submitted_at,
    status: session.status,
    points: session.points ?? 0,
    bestStreak: session.best_streak ?? 0,
    answers,
  };
}
