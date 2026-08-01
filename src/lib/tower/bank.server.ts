/**
 * Bộ gói đề Leo Tháp — máy chủ chỉ làm việc này MỘT LẦN cho mỗi phiên bản đề.
 *
 * Kiến trúc nhẹ máy chủ: trình duyệt tải gói một lần, lưu IndexedDB, rồi tự
 * chấm và tự lên lịch ôn. Máy chủ không tham gia từng câu, từng chặng.
 *
 * CẢNH BÁO: gói này CÓ đáp án. Chỉ trả về sau khi xác thực nhân viên và chỉ
 * dùng cho Leo Tháp (ôn tập). Kỳ thi chính thức vẫn chấm hoàn toàn ở máy chủ.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyEmployee } from "@/lib/employees.server";
import type { QuestionBank, BankQuestion } from "@/lib/tower/bank";

type VerifyInput = { name: string; credential: string; extraCredential?: string };

const BANK_LIMIT = 1500;

/** Phiên bản gói = mốc sửa đổi mới nhất + số câu. Đổi đề là đổi phiên bản. */
export async function getBankVersion(): Promise<number> {
  const [{ data: latest }, { count }] = await Promise.all([
    supabaseAdmin
      .from("questions")
      .select("updated_at")
      .eq("is_archived", false)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("is_archived", false),
  ]);
  const stamp = latest?.updated_at ? Math.floor(new Date(latest.updated_at).getTime() / 1000) : 0;
  return stamp * 100000 + (count ?? 0);
}

/** Kiểm tra khoá Leo Tháp (ưu tiên tài nguyên cho kỳ thi chính thức). */
export async function assertTowerOpen(): Promise<void> {
  const { data: settings } = await supabaseAdmin
    .from("arena_settings")
    .select("tower_enabled, tower_locked_until")
    .maybeSingle();
  const lockedUntil = settings?.tower_locked_until ? new Date(settings.tower_locked_until) : null;
  if (settings?.tower_enabled === false || (lockedUntil && lockedUntil > new Date()))
    throw new Error("Leo Tháp đang tạm khoá để ưu tiên tài nguyên cho kỳ thi. Bạn quay lại sau nhé.");
}

/** Tải toàn bộ gói đề (một truy vấn, không N+1). */
export async function buildQuestionBank(input: VerifyInput): Promise<QuestionBank> {
  await verifyEmployee(input);
  await assertTowerOpen();

  const { data, error } = await supabaseAdmin
    .from("questions")
    .select(
      "id, kind, question, options, option_images, image_url, image_alt, explanation, tags, difficulty, correct_index, correct_indices, accepted_answers, pairs, correct_order",
    )
    .eq("is_archived", false)
    .order("id", { ascending: true })
    .limit(BANK_LIMIT);
  if (error) throw new Error("Không tải được ngân hàng câu hỏi ôn tập.");

  const questions: BankQuestion[] = (data ?? []).map((row) => ({
    id: row.id,
    kind: row.kind,
    question: row.question,
    options: row.options ?? [],
    optionImages: row.option_images ?? [],
    imageUrl: row.image_url ?? null,
    imageAlt: row.image_alt ?? "",
    explanation: row.explanation ?? "",
    tags: row.tags ?? [],
    difficulty: row.difficulty,
    answerIndex: row.correct_index ?? 0,
    answerIndices: row.correct_indices ?? [],
    accepted: row.accepted_answers ?? [],
    pairs: Array.isArray(row.pairs)
      ? (row.pairs as { left?: string; right?: string }[]).map((p) => ({
          left: String(p?.left ?? ""),
          right: String(p?.right ?? ""),
        }))
      : [],
    correctOrder: row.correct_order ?? [],
  }));

  return { version: await getBankVersion(), builtAt: new Date().toISOString(), questions };
}
