import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyEmployee } from "@/lib/employees.server";
import { normalizeText, type AnswerValue, type Blueprint, type Difficulty, type QuestionKind } from "@/lib/questionKinds";

export type ExamQuestion = {
  id: string;
  kind: QuestionKind;
  question: string;
  /** Phương án hiển thị (đã trộn). Với "matching" đây là cột phải, với "ordering" là các mục cần sắp xếp. */
  options: string[];
  /** Cột trái của câu nối cặp. */
  matchLeft: string[];
  imageUrl: string | null;
  points: number;
  difficulty: Difficulty;
  timeLimitSeconds: number | null;
};

export type ExamSettings = {
  instantFeedback: boolean;
  allowFiftyFifty: boolean;
  allowSkip: boolean;
  streakBonus: boolean;
  showQuestionMap: boolean;
  passScore: number;
};

export type StartExamResult = {
  sessionId: string;
  /** Mã nộp bài dùng một lần — bắt buộc khi nộp, hết hiệu lực ngay sau đó. */
  submitToken: string;
  /** Lần thi thứ mấy của nhân viên này ở cuộc thi này */
  attempt: number;
  /** Điểm phần trăm cao nhất đã đạt trước đó (0 nếu chưa thi) */
  bestPercent: number;
  candidateName: string;
  unit: string;
  quizTitle: string;
  durationMinutes: number;
  expiresAt: string;
  serverNow: string;
  settings: ExamSettings;
  maxPoints: number;
  questions: ExamQuestion[];
};

export type ReviewItem = {
  kind: QuestionKind;
  question: string;
  options: string[];
  matchLeft: string[];
  imageUrl: string | null;
  correct: boolean;
  answered: boolean;
  /** Mô tả đáp án người thi đã chọn, dạng chữ. */
  chosenText: string;
  correctText: string;
  explanation: string;
  points: number;
};

/** Tỷ lệ điểm tối thiểu để được công nhận "Đạt" khi cuộc thi không cấu hình riêng. */
export const PASS_RATIO = 0.5;

export type SubmitExamResult = {
  score: number;
  total: number;
  points: number;
  maxPoints: number;
  bestStreak: number;
  passed: boolean;
  passRatio: number;
  timeSeconds: number;
  disqualified: boolean;
  quizId: string;
  quizTitle: string;
  previousBestPercent: number;
  improved: boolean;
  review: ReviewItem[];
};

type QuestionRow = {
  id: string;
  question: string;
  options: string[];
  correct_index: number;
  image_url: string | null;
  kind: QuestionKind;
  correct_indices: number[];
  accepted_answers: string[];
  pairs: unknown;
  correct_order: number[];
  difficulty: Difficulty;
  tags: string[];
  points: number;
  explanation: string;
  time_limit_seconds: number | null;
};

const QUESTION_COLUMNS =
  "id, question, options, correct_index, image_url, kind, correct_indices, accepted_answers, pairs, correct_order, difficulty, tags, points, explanation, time_limit_seconds";

const QUIZ_COLUMNS =
  "id, title, is_active, start_time, end_time, question_count, duration_minutes, shuffle_options, shuffle_questions, pass_score, room_password, max_attempts, instant_feedback, allow_fifty_fifty, allow_skip, streak_bonus, show_question_map, negative_marking, blueprint";

function shuffle<T>(input: T[]): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function percentOf(score: number, total: number) {
  return total > 0 ? Math.round((score / total) * 100) : 0;
}

function pairsOf(row: Pick<QuestionRow, "pairs">): { left: string; right: string }[] {
  const raw = row.pairs;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((p) => (p && typeof p === "object" ? (p as { left?: unknown; right?: unknown }) : {}))
    .map((p) => ({ left: String(p.left ?? ""), right: String(p.right ?? "") }))
    .filter((p) => p.left || p.right);
}

/** Danh sách phương án hiển thị gốc (chưa trộn) tuỳ theo loại câu hỏi. */
function baseOptions(row: QuestionRow): string[] {
  if (row.kind === "matching") return pairsOf(row).map((p) => p.right);
  if (row.kind === "true_false") return row.options.length >= 2 ? row.options : ["Đúng", "Sai"];
  return row.options;
}

/** Chấm một câu. `order` là ánh xạ vị trí hiển thị -> vị trí gốc. */
function gradeOne(row: QuestionRow, order: number[], value: AnswerValue | undefined): boolean {
  if (value === undefined || value === null) return false;
  switch (row.kind) {
    case "multi": {
      if (!Array.isArray(value)) return false;
      const chosen = new Set(
        (value as number[]).filter((i) => Number.isInteger(i) && i >= 0 && i < order.length).map((i) => order[i]),
      );
      const expected = new Set(row.correct_indices ?? []);
      if (chosen.size === 0 || chosen.size !== expected.size) return false;
      for (const i of expected) if (!chosen.has(i)) return false;
      return true;
    }
    case "fill_blank": {
      if (typeof value !== "string") return false;
      const answer = normalizeText(value);
      if (!answer) return false;
      return (row.accepted_answers ?? []).some((a) => normalizeText(a) === answer);
    }
    case "matching": {
      if (typeof value !== "object" || Array.isArray(value)) return false;
      const pairs = pairsOf(row);
      if (pairs.length === 0) return false;
      return pairs.every((_, leftIndex) => {
        const display = (value as Record<string, number>)[String(leftIndex)];
        return Number.isInteger(display) && display >= 0 && display < order.length && order[display] === leftIndex;
      });
    }
    case "ordering": {
      if (!Array.isArray(value)) return false;
      const expected =
        row.correct_order && row.correct_order.length === order.length
          ? row.correct_order
          : order.map((_, i) => i).sort((a, b) => a - b);
      const chosen = (value as number[]).map((i) => order[i]);
      if (chosen.length !== expected.length) return false;
      return chosen.every((v, i) => v === expected[i]);
    }
    default: {
      if (typeof value !== "number") return false;
      return value >= 0 && value < order.length && order[value] === row.correct_index;
    }
  }
}

/** Mô tả đáp án đúng dưới dạng chữ để hiển thị khi xem lại. */
function correctTextOf(row: QuestionRow): string {
  switch (row.kind) {
    case "multi":
      return (row.correct_indices ?? []).map((i) => row.options[i]).filter(Boolean).join(" · ");
    case "fill_blank":
      return (row.accepted_answers ?? []).join(" / ");
    case "matching":
      return pairsOf(row)
        .map((p) => `${p.left} → ${p.right}`)
        .join(" · ");
    case "ordering": {
      const expected = row.correct_order?.length ? row.correct_order : row.options.map((_, i) => i);
      return expected.map((i) => row.options[i]).filter(Boolean).join(" → ");
    }
    default:
      return row.options[row.correct_index] ?? "";
  }
}

function chosenTextOf(row: QuestionRow, order: number[], value: AnswerValue | undefined): string {
  const display = baseOptions(row);
  if (value === undefined || value === null) return "";
  switch (row.kind) {
    case "multi":
      return Array.isArray(value) ? (value as number[]).map((i) => display[order[i]]).filter(Boolean).join(" · ") : "";
    case "fill_blank":
      return typeof value === "string" ? value : "";
    case "matching": {
      if (typeof value !== "object" || Array.isArray(value)) return "";
      const pairs = pairsOf(row);
      return pairs
        .map((p, i) => {
          const d = (value as Record<string, number>)[String(i)];
          const right = Number.isInteger(d) ? display[order[d]] : "(chưa nối)";
          return `${p.left} → ${right ?? "(chưa nối)"}`;
        })
        .join(" · ");
    }
    case "ordering":
      return Array.isArray(value) ? (value as number[]).map((i) => display[order[i]]).filter(Boolean).join(" → ") : "";
    default:
      return typeof value === "number" ? (display[order[value]] ?? "") : "";
  }
}

/** Bốc đề theo công thức: ưu tiên tỉ lệ độ khó, phần còn lại lấy ngẫu nhiên. */
function pickByBlueprint(pool: QuestionRow[], wanted: number, blueprint: Blueprint): QuestionRow[] {
  const picked: QuestionRow[] = [];
  const used = new Set<string>();
  const takeFrom = (rows: QuestionRow[], count: number) => {
    for (const row of shuffle(rows)) {
      if (picked.length >= wanted || count <= 0) break;
      if (used.has(row.id)) continue;
      used.add(row.id);
      picked.push(row);
      count--;
    }
  };

  for (const level of ["easy", "medium", "hard"] as Difficulty[]) {
    const count = Number(blueprint?.[level] ?? 0);
    if (count > 0) takeFrom(pool.filter((r) => r.difficulty === level), count);
  }
  for (const [tag, count] of Object.entries(blueprint?.tags ?? {})) {
    if (Number(count) > 0) takeFrom(pool.filter((r) => (r.tags ?? []).includes(tag)), Number(count));
  }
  if (picked.length < wanted) takeFrom(pool.filter((r) => !used.has(r.id)), wanted - picked.length);
  return shuffle(picked).slice(0, wanted);
}

export async function startExamSession(input: {
  quizId: string;
  name: string;
  credential: string;
  extraCredential?: string;
  roomPassword?: string;
}): Promise<StartExamResult> {
  // Bắt buộc đối chiếu danh bạ nhân viên: sai thông tin thì không ghi nhận lượt thi.
  const employee = await verifyEmployee({
    name: input.name,
    credential: input.credential,
    extraCredential: input.extraCredential,
  });
  const name = employee.fullName;
  const birthYear = employee.birthYear;
  const unit = employee.unitName ?? "";

  const { data: quiz, error: quizError } = await supabaseAdmin
    .from("quizzes")
    .select(QUIZ_COLUMNS)
    .eq("id", input.quizId)
    .maybeSingle();

  if (quizError) throw new Error(quizError.message);
  if (!quiz) throw new Error("Không tìm thấy cuộc thi.");
  if (!quiz.is_active) throw new Error("Cuộc thi này hiện đang tạm dừng.");

  const now = new Date();
  if (quiz.start_time && now < new Date(quiz.start_time)) {
    throw new Error("Cuộc thi chưa đến giờ mở.");
  }
  if (quiz.end_time && now > new Date(quiz.end_time)) {
    throw new Error("Cuộc thi đã kết thúc.");
  }
  if (quiz.room_password && quiz.room_password !== (input.roomPassword ?? "")) {
    throw new Error("Mật khẩu phòng thi không đúng.");
  }

  // Khuyến khích thi lại nhiều lần: luôn cho phép, chỉ ghi nhận thành tích tốt nhất.
  const { data: previous } = await supabaseAdmin
    .from("results")
    .select("score, total")
    .eq("quiz_id", quiz.id)
    .eq("employee_id", employee.id)
    .eq("disqualified", false);

  const attempts = previous?.length ?? 0;
  const bestPercent = (previous ?? []).reduce((max, r) => Math.max(max, percentOf(r.score, r.total)), 0);
  if (quiz.max_attempts && attempts >= quiz.max_attempts) {
    throw new Error(`Cuộc thi này chỉ cho phép tối đa ${quiz.max_attempts} lượt thi.`);
  }

  // Khoá luồng làm bài: mọi phiên cũ chưa nộp của người này đều bị vô hiệu hoá.
  await supabaseAdmin
    .from("exam_sessions")
    .update({ status: "abandoned", submitted_at: now.toISOString() })
    .eq("employee_id", employee.id)
    .eq("status", "active")
    .is("submitted_at", null);

  const { data: poolRaw, error: poolError } = await supabaseAdmin
    .from("questions")
    .select(QUESTION_COLUMNS)
    .eq("quiz_id", quiz.id)
    .eq("is_archived", false);

  if (poolError) throw new Error(poolError.message);
  const pool = (poolRaw ?? []) as unknown as QuestionRow[];

  const wanted = Math.max(1, quiz.question_count);
  if (pool.length < wanted) {
    throw new Error(
      `Ngân hàng câu hỏi hiện có ${pool.length} câu, cần tối thiểu ${wanted} câu. Vui lòng báo quản trị viên bổ sung.`,
    );
  }

  const blueprint = (quiz.blueprint ?? {}) as Blueprint;
  const picked = pickByBlueprint(pool, wanted, blueprint);
  const ordered = quiz.shuffle_questions ? picked : picked;

  const optionOrders: number[][] = [];
  const questions: ExamQuestion[] = ordered.map((q) => {
    const display = baseOptions(q);
    const indexes = display.map((_, i) => i);
    // Câu sắp xếp và nối cặp luôn trộn để tránh lộ thứ tự đúng.
    const mustShuffle = q.kind === "ordering" || q.kind === "matching";
    const order = quiz.shuffle_options || mustShuffle ? shuffle(indexes) : indexes;
    optionOrders.push(order);
    return {
      id: q.id,
      kind: q.kind,
      question: q.question,
      options: order.map((i) => display[i]),
      matchLeft: q.kind === "matching" ? pairsOf(q).map((p) => p.left) : [],
      imageUrl: q.image_url ?? null,
      points: q.points || 1,
      difficulty: q.difficulty,
      timeLimitSeconds: q.time_limit_seconds ?? null,
    };
  });

  const expiresAt = new Date(now.getTime() + quiz.duration_minutes * 60_000);

  const { data: session, error: sessionError } = await supabaseAdmin
    .from("exam_sessions")
    .insert({
      quiz_id: quiz.id,
      candidate_name: name,
      birth_year: birthYear || undefined,
      unit: unit || "Chưa cập nhật",
      employee_id: employee.id,
      question_ids: ordered.map((q) => q.id),
      option_orders: optionOrders,
      expires_at: expiresAt.toISOString(),
    })
    .select("id, submit_token")
    .single();

  if (sessionError) throw new Error(sessionError.message);

  return {
    sessionId: session.id,
    submitToken: session.submit_token as string,
    attempt: attempts + 1,
    bestPercent,
    candidateName: name,
    unit: unit || "Chưa cập nhật",
    quizTitle: quiz.title,
    durationMinutes: quiz.duration_minutes,
    expiresAt: expiresAt.toISOString(),
    serverNow: now.toISOString(),
    maxPoints: questions.reduce((sum, q) => sum + q.points, 0),
    settings: {
      instantFeedback: quiz.instant_feedback,
      allowFiftyFifty: quiz.allow_fifty_fifty,
      allowSkip: quiz.allow_skip,
      streakBonus: quiz.streak_bonus,
      showQuestionMap: quiz.show_question_map,
      passScore: quiz.pass_score ?? 0,
    },
    questions,
  };
}

/**
 * Trợ giúp 50:50 — máy chủ loại bớt 2 phương án sai (không bao giờ trả về đáp án đúng).
 * Chỉ áp dụng cho câu một đáp án / đúng-sai và chỉ khi cuộc thi bật tính năng này.
 */
export async function useFiftyFifty(input: {
  sessionId: string;
  submitToken: string;
  index: number;
}): Promise<{ removed: number[] }> {
  const { data: session } = await supabaseAdmin
    .from("exam_sessions")
    .select("id, quiz_id, question_ids, option_orders, status, submit_token, helpers")
    .eq("id", input.sessionId)
    .maybeSingle();

  if (!session || session.status !== "active" || session.submit_token !== input.submitToken) {
    throw new Error("Phiên thi không hợp lệ.");
  }

  const { data: quiz } = await supabaseAdmin
    .from("quizzes")
    .select("allow_fifty_fifty")
    .eq("id", session.quiz_id)
    .maybeSingle();
  if (!quiz?.allow_fifty_fifty) throw new Error("Cuộc thi này không bật trợ giúp 50:50.");

  const helpers = (session.helpers ?? {}) as Record<string, unknown>;
  const usedList = Array.isArray(helpers.fiftyFifty) ? (helpers.fiftyFifty as number[]) : [];
  if (usedList.length >= 2) throw new Error("Bạn đã dùng hết lượt trợ giúp 50:50.");

  const qid = (session.question_ids as string[])[input.index];
  const { data: rowRaw } = await supabaseAdmin.from("questions").select(QUESTION_COLUMNS).eq("id", qid).maybeSingle();
  const row = rowRaw as unknown as QuestionRow | null;
  if (!row) throw new Error("Không tìm thấy câu hỏi.");
  if (row.kind !== "single" && row.kind !== "true_false") throw new Error("Câu hỏi này không hỗ trợ 50:50.");

  const order = ((session.option_orders as unknown as number[][]) ?? [])[input.index] ?? [];
  const wrong = order.map((orig, display) => ({ orig, display })).filter((o) => o.orig !== row.correct_index);
  const removed = shuffle(wrong).slice(0, Math.max(1, Math.min(2, wrong.length - 1))).map((o) => o.display);

  await supabaseAdmin
    .from("exam_sessions")
    .update({ helpers: { ...helpers, fiftyFifty: [...usedList, input.index] } as never })
    .eq("id", session.id);

  return { removed };
}

/** Người thi chủ động thoát khỏi phòng thi (không tính điểm, không ghi bảng xếp hạng). */
export async function abandonExamSession(input: { sessionId: string; submitToken: string }) {
  const { error } = await supabaseAdmin
    .from("exam_sessions")
    .update({ status: "abandoned", submitted_at: new Date().toISOString(), submit_token: crypto.randomUUID() })
    .eq("id", input.sessionId)
    .eq("submit_token", input.submitToken)
    .eq("status", "active");
  if (error) throw new Error(error.message);
  return { ok: true };
}

/** Chấm ngay một câu (chế độ phản hồi tức thì): chốt đáp án, trả kết quả đúng/sai. */
export async function checkExamAnswer(input: {
  sessionId: string;
  submitToken: string;
  index: number;
  value: AnswerValue;
}) {
  const { data: session, error } = await supabaseAdmin
    .from("exam_sessions")
    .select("id, question_ids, option_orders, status, submit_token, answers")
    .eq("id", input.sessionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!session || session.status !== "active" || session.submit_token !== input.submitToken) {
    throw new Error("Phiên thi không hợp lệ.");
  }
  const qid = (session.question_ids as string[])[input.index];
  if (!qid) throw new Error("Câu hỏi không tồn tại.");

  const { data: rowRaw } = await supabaseAdmin.from("questions").select(QUESTION_COLUMNS).eq("id", qid).maybeSingle();
  const row = rowRaw as unknown as QuestionRow | null;
  if (!row) throw new Error("Câu hỏi không tồn tại.");

  const display = baseOptions(row);
  const orders = (session.option_orders as unknown as number[][]) ?? [];
  const order = orders[input.index] ?? display.map((_, i) => i);
  const correct = gradeOne(row, order, input.value);

  const answers = { ...((session.answers as Record<string, AnswerValue>) ?? {}), [String(input.index)]: input.value };
  await supabaseAdmin.from("exam_sessions").update({ answers: answers as never }).eq("id", session.id);

  return { correct, correctText: correctTextOf(row), explanation: row.explanation ?? "" };
}

export async function submitExamSession(input: {
  sessionId: string;
  submitToken: string;
  answers: Record<string, AnswerValue>;
  disqualified?: boolean;
  disqualifyReason?: string;
}): Promise<SubmitExamResult> {
  const { data: session, error: sessionError } = await supabaseAdmin
    .from("exam_sessions")
    .select("*")
    .eq("id", input.sessionId)
    .maybeSingle();

  if (sessionError) throw new Error(sessionError.message);
  if (!session) throw new Error("Phiên thi không tồn tại.");

  // Đã nộp rồi (bấm nộp hai lần, mạng chập chờn, hết giờ trùng lúc bấm nộp):
  // chấm lại từ đáp án đã lưu và trả về kết quả cũ thay vì báo lỗi.
  const alreadyDone = Boolean(session.submitted_at) || session.status !== "active";
  if (!alreadyDone && (!session.submit_token || session.submit_token !== input.submitToken)) {
    throw new Error("Mã nộp bài không hợp lệ. Vui lòng bắt đầu lượt thi mới.");
  }

  if (!alreadyDone) {
    const { data: locked, error: lockError } = await supabaseAdmin
      .from("exam_sessions")
      .update({ status: "grading" })
      .eq("id", session.id)
      .eq("submit_token", input.submitToken)
      .eq("status", "active")
      .select("id");
    if (lockError) throw new Error(lockError.message);
    if (!locked || locked.length === 0) {
      // Một tiến trình khác vừa chấm xong — đọc lại và trả kết quả đã có.
      const { data: fresh } = await supabaseAdmin.from("exam_sessions").select("*").eq("id", session.id).maybeSingle();
      if (fresh) Object.assign(session, fresh);
    }
  }

  const replay = alreadyDone || session.status !== "active";
  const answersToGrade = replay
    ? ((session.answers as Record<string, AnswerValue>) ?? input.answers)
    : { ...((session.answers as Record<string, AnswerValue>) ?? {}), ...input.answers };

  // Tải song song để rút ngắn thời gian chấm bài.
  const [quizRes, rowsRes, historyRes, existingRes] = await Promise.all([
    supabaseAdmin
      .from("quizzes")
      .select("title, pass_score, negative_marking, streak_bonus")
      .eq("id", session.quiz_id)
      .maybeSingle(),
    supabaseAdmin.from("questions").select(QUESTION_COLUMNS).in("id", session.question_ids),
    supabaseAdmin
      .from("results")
      .select("score, total")
      .eq("quiz_id", session.quiz_id)
      .eq("employee_id", session.employee_id ?? "00000000-0000-0000-0000-000000000000")
      .eq("disqualified", false),
    supabaseAdmin.from("results").select("id, disqualified, time_seconds").eq("session_id", session.id).maybeSingle(),
  ]);

  const quiz = quizRes.data;
  if (rowsRes.error) throw new Error(rowsRes.error.message);
  const rows = (rowsRes.data ?? []) as unknown as QuestionRow[];
  const history = historyRes.data;
  const existing = existingRes.data;


  const byId = new Map(rows.map((r) => [r.id, r]));
  const orders = (session.option_orders as unknown as number[][]) ?? [];

  let score = 0;
  let points = 0;
  let streak = 0;
  let bestStreak = 0;
  const review: ReviewItem[] = [];
  const storedAnswers: Record<string, AnswerValue> = {};

  session.question_ids.forEach((qid: string, idx: number) => {
    const row = byId.get(qid);
    if (!row) return;
    const display = baseOptions(row);
    const order = orders[idx] ?? display.map((_, i) => i);
    const value = answersToGrade[String(idx)];
    const answered = value !== undefined && value !== null && value !== "";
    if (answered) storedAnswers[String(idx)] = value;

    const correct = gradeOne(row, order, value);
    if (correct) {
      score++;
      streak++;
      bestStreak = Math.max(bestStreak, streak);
      const bonus = quiz?.streak_bonus && streak >= 3 ? 1 : 0;
      points += (row.points || 1) + bonus;
    } else {
      streak = 0;
      if (answered) points -= Number(quiz?.negative_marking ?? 0) * (row.points || 1);
    }

    review.push({
      kind: row.kind,
      question: row.question,
      options: order.map((i) => display[i]),
      matchLeft: row.kind === "matching" ? pairsOf(row).map((p) => p.left) : [],
      imageUrl: row.image_url ?? null,
      correct,
      answered,
      chosenText: chosenTextOf(row, order, value),
      correctText: correctTextOf(row),
      explanation: row.explanation ?? "",
      points: row.points || 1,
    });
  });

  const now = new Date();
  const startedAt = new Date(session.started_at);
  const expiresAt = new Date(session.expires_at);
  const endMoment = now > expiresAt ? expiresAt : now;
  const timeSeconds =
    replay && existing
      ? existing.time_seconds
      : Math.max(0, Math.round((endMoment.getTime() - startedAt.getTime()) / 1000));
  const disqualified = replay && existing ? existing.disqualified : Boolean(input.disqualified);
  const total = session.question_ids.length;
  const finalScore = disqualified ? 0 : score;
  const finalPoints = disqualified ? 0 : Math.max(0, Math.round(points));
  const maxPoints = review.reduce((sum, r) => sum + r.points, 0);
  const passScore = quiz?.pass_score ?? 0;
  const passed = disqualified
    ? false
    : passScore > 0
      ? finalScore >= passScore
      : total > 0 && finalScore / total >= PASS_RATIO;

  const previousBestPercent = (history ?? []).reduce((max, r) => Math.max(max, percentOf(r.score, r.total)), 0);

  if (!replay) {
    await supabaseAdmin
      .from("exam_sessions")
      .update({
        submitted_at: now.toISOString(),
        status: disqualified ? "disqualified" : "submitted",
        answers: storedAnswers as never,
        best_streak: bestStreak,
        points: finalPoints,
        // Vô hiệu hoá mã nộp bài sau khi dùng.
        submit_token: crypto.randomUUID(),
      })
      .eq("id", session.id);

    const { error: insertError } = await supabaseAdmin.from("results").insert({
      session_id: session.id,
      quiz_id: session.quiz_id,
      quiz_title: quiz?.title ?? "",
      candidate_name: session.candidate_name,
      birth_year: session.birth_year,
      unit: session.unit,
      employee_id: session.employee_id,
      score: finalScore,
      total,
      points: finalPoints,
      max_points: maxPoints,
      best_streak: bestStreak,
      passed,
      time_seconds: timeSeconds,
      disqualified,
      disqualify_reason: input.disqualifyReason ?? null,
      submitted_at: now.toISOString(),
    });

    if (insertError && !insertError.message.includes("duplicate")) throw new Error(insertError.message);
  }


  return {
    score: finalScore,
    total,
    points: finalPoints,
    maxPoints,
    bestStreak,
    passed,
    passRatio: PASS_RATIO,
    timeSeconds,
    disqualified,
    quizId: session.quiz_id,
    quizTitle: quiz?.title ?? "",
    previousBestPercent,
    improved: !disqualified && percentOf(finalScore, total) > previousBestPercent,
    review,
  };
}

export type HistoryQuestion = {
  question: string;
  correct: boolean;
  answered: boolean;
  chosenText: string | null;
  correctText: string;
};

export type HistoryAttempt = {
  sessionId: string;
  quizTitle: string;
  startedAt: string;
  finishedAt: string | null;
  status: "submitted" | "disqualified" | "abandoned" | "active";
  score: number;
  total: number;
  percent: number;
  passed: boolean;
  timeSeconds: number;
  questions: HistoryQuestion[];
};

export type ExamHistory = {
  candidateName: string;
  unitName: string | null;
  attempts: HistoryAttempt[];
  bestPercent: number;
  passedCount: number;
};

/** Lịch sử làm bài của một nhân viên (sau khi đã xác thực danh tính). */
export async function getExamHistoryFor(input: {
  name: string;
  credential: string;
  extraCredential?: string;
}): Promise<ExamHistory> {
  const employee = await verifyEmployee(input);

  const { data: sessions, error } = await supabaseAdmin
    .from("exam_sessions")
    .select("id, quiz_id, started_at, submitted_at, status, question_ids, option_orders, answers")
    .eq("employee_id", employee.id)
    .order("started_at", { ascending: false })
    .limit(30);

  if (error) throw new Error(error.message);

  const list = sessions ?? [];
  if (list.length === 0) {
    return { candidateName: employee.fullName, unitName: employee.unitName, attempts: [], bestPercent: 0, passedCount: 0 };
  }

  const questionIds = [...new Set(list.flatMap((s) => s.question_ids as string[]))];
  const [{ data: questionRows }, { data: resultRows }, { data: quizRows }] = await Promise.all([
    supabaseAdmin.from("questions").select(QUESTION_COLUMNS).in("id", questionIds),
    supabaseAdmin
      .from("results")
      .select("session_id, score, total, time_seconds, disqualified, submitted_at, quiz_title")
      .in(
        "session_id",
        list.map((s) => s.id),
      ),
    supabaseAdmin
      .from("quizzes")
      .select("id, title")
      .in("id", [...new Set(list.map((s) => s.quiz_id))]),
  ]);

  const questionById = new Map(((questionRows ?? []) as unknown as QuestionRow[]).map((q) => [q.id, q]));
  const resultBySession = new Map((resultRows ?? []).map((r) => [r.session_id, r]));
  const quizTitleById = new Map((quizRows ?? []).map((q) => [q.id, q.title]));

  const attempts: HistoryAttempt[] = list.map((s) => {
    const answers = (s.answers ?? {}) as Record<string, AnswerValue>;
    const orders = (s.option_orders as unknown as number[][]) ?? [];
    const result = resultBySession.get(s.id);

    const questions: HistoryQuestion[] = (s.question_ids as string[]).map((qid, idx) => {
      const row = questionById.get(qid);
      if (!row) {
        return { question: "(Câu hỏi đã bị xoá)", correct: false, answered: false, chosenText: null, correctText: "" };
      }
      const display = baseOptions(row);
      const order = orders[idx] ?? display.map((_, i) => i);
      const value = answers[String(idx)];
      const answered = value !== undefined && value !== null && value !== "";
      return {
        question: row.question,
        correct: gradeOne(row, order, value),
        answered,
        chosenText: answered ? chosenTextOf(row, order, value) : null,
        correctText: correctTextOf(row),
      };
    });

    const total = result?.total ?? (s.question_ids as string[]).length;
    const score = result?.score ?? questions.filter((q) => q.correct).length;
    const percent = percentOf(score, total);

    return {
      sessionId: s.id,
      quizTitle: result?.quiz_title || quizTitleById.get(s.quiz_id) || "Cuộc thi",
      startedAt: s.started_at,
      finishedAt: result?.submitted_at ?? s.submitted_at ?? null,
      status: (s.status as HistoryAttempt["status"]) ?? "submitted",
      score,
      total,
      percent,
      passed: !result?.disqualified && total > 0 && score / total >= PASS_RATIO,
      timeSeconds: result?.time_seconds ?? 0,
      questions,
    };
  });

  const scored = attempts.filter((a) => a.status === "submitted");
  return {
    candidateName: employee.fullName,
    unitName: employee.unitName,
    attempts,
    bestPercent: scored.reduce((max, a) => Math.max(max, a.percent), 0),
    passedCount: scored.filter((a) => a.passed).length,
  };
}
