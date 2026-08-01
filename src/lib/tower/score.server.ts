/**
 * Bảng xếp hạng hành trình Leo Tháp (trụ cột 8).
 *
 * Điểm được TÍNH LẠI ở máy chủ từ dữ liệu hành trình gửi lên, không tin điểm của máy khách.
 * Hai bảng: hạt hằng ngày (mọi người cùng bản đồ) và hạt tự do.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { vnDayKey } from "@/lib/arena/rules";
import { verifyEmployee } from "@/lib/employees.server";
import { FLOORS } from "@/lib/tower/map";
import { runScore, type Board } from "@/lib/tower/score";

export type SubmitRunInput = {
  name: string;
  credential: string;
  extraCredential?: string;
  seed: string;
  daily: boolean;
  floors: number;
  hp: number;
  relics: string[];
  curses: string[];
  ascension: number;
  win: boolean;
};

export async function submitRunScore(input: SubmitRunInput) {
  const emp = await verifyEmployee({
    name: input.name,
    credential: input.credential,
    ...(input.extraCredential ? { extraCredential: input.extraCredential } : {}),
  });

  const floors = Math.max(0, Math.min(FLOORS, Math.round(input.floors)));
  const score = runScore({
    floorsCleared: floors,
    hp: Math.max(0, Math.round(input.hp)),
    relics: input.relics.slice(0, 20),
    curses: input.curses.slice(0, 10),
    ascension: input.ascension,
  });
  const board: Board = input.daily ? "hang-ngay" : "tu-do";

  const { error } = await supabaseAdmin.from("tower_scores").insert({
    employee_id: emp.id,
    display_name: emp.fullName,
    unit: emp.unitName ?? "Chưa cập nhật",
    board,
    day_key: vnDayKey(Date.now()),
    seed: input.seed.slice(0, 80),
    score,
    floors,
    hp: Math.max(0, Math.round(input.hp)),
    relics: input.relics.slice(0, 20),
    curses: input.curses.slice(0, 10),
    ascension: Math.max(0, Math.min(10, Math.round(input.ascension))),
    win: input.win,
  });
  if (error) throw new Error("Không ghi được điểm hành trình.");
  return { score, board, floors };
}

export type BoardRow = {
  rank: number;
  name: string;
  unit: string;
  score: number;
  floors: number;
  relics: number;
  curses: number;
  ascension: number;
  win: boolean;
};

/** Bảng xếp hạng: lấy lượt tốt nhất của mỗi người, tối đa 20 dòng. */
export async function readTowerBoard(board: Board, limit = 20): Promise<BoardRow[]> {
  let query = supabaseAdmin
    .from("tower_scores")
    .select("employee_id, display_name, unit, score, floors, relics, curses, ascension, win")
    .eq("board", board)
    .order("score", { ascending: false })
    .limit(200);
  if (board === "hang-ngay") query = query.eq("day_key", vnDayKey(Date.now()));

  const { data, error } = await query;
  if (error) throw new Error("Không đọc được bảng xếp hạng Leo Tháp.");

  const best = new Map<string, BoardRow>();
  for (const r of data ?? []) {
    if (best.has(r.employee_id)) continue; // đã sắp xếp giảm dần nên dòng đầu là tốt nhất
    best.set(r.employee_id, {
      rank: 0,
      // Che bớt danh tính: chỉ hiện họ tên rút gọn, không kèm dữ liệu nhạy cảm khác.
      name: r.display_name,
      unit: r.unit,
      score: r.score,
      floors: r.floors,
      relics: (r.relics ?? []).length,
      curses: (r.curses ?? []).length,
      ascension: r.ascension,
      win: r.win,
    });
  }
  return [...best.values()].slice(0, limit).map((row, i) => ({ ...row, rank: i + 1 }));
}
