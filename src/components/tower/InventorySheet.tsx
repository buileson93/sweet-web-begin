import { Backpack, Coins, Skull, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { HpBar } from "@/components/tower/HpBar";
import { curseById } from "@/lib/tower/curses";
import { activeSets, ELEMENT_LABEL, RARITY_LABEL, relicById, relicTotals, SET_BONUS } from "@/lib/tower/relics";
import type { TowerRun } from "@/lib/tower/engine";

/** Diễn giải chỉ số cộng dồn thành câu tiếng Việt dễ hiểu. */
function totalsLines(run: TowerRun): string[] {
  const t = relicTotals(run.relics);
  const out: string[] = [];
  if (t.damageBonus) out.push(`+${t.damageBonus} sát thương mỗi câu đúng`);
  if (t.comboDamage) out.push(`+${t.comboDamage} sát thương mỗi bậc combo`);
  if (t.hardBonus) out.push(`+${t.hardBonus} sát thương ở câu Khó`);
  if (t.timePct) out.push(`${t.timePct > 0 ? "+" : ""}${Math.round(t.timePct * 100)}% thời gian mỗi câu`);
  if (t.damageReducePct) out.push(`−${Math.round(t.damageReducePct * 100)}% sát thương nhận`);
  if (t.reflectPct) out.push(`Phản ${Math.round(t.reflectPct * 100)}% sát thương`);
  if (t.blockPerFloor) out.push(`Chặn ${t.blockPerFloor} đòn mỗi tầng`);
  if (t.revivePct) out.push(`Hồi sinh ${Math.round(t.revivePct * 100)}% máu một lần`);
  if (t.lowHpRagePct) out.push(`Dưới 30% máu: sát thương +${Math.round(t.lowHpRagePct * 100)}%`);
  if (t.coinPct) out.push(`+${Math.round(t.coinPct * 100)}% xu nhặt được`);
  if (t.minRoll > 1) out.push(`Xúc xắc tính tối thiểu ${t.minRoll} mặt`);
  return out;
}

/**
 * Hành trang — bảng trạng thái hiện tại của hành trình: máu, khiên, xu,
 * danh sách di vật kèm mô tả đầy đủ, thưởng bộ đang kích hoạt và lời nguyền đang mang.
 * Dạng ngăn kéo để trên điện thoại chỉ tốn một nút bấm.
 */
export function InventorySheet({ run }: { run: TowerRun }) {
  const sets = activeSets(run.relics);
  const lines = totalsLines(run);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="sm" variant="outline" className="h-8 gap-1.5 rounded-full px-3">
          <Backpack className="size-4" />
          <span className="text-xs font-semibold">
            Hành trang {run.relics.length}
            {run.curses.length ? ` · ${run.curses.length} nguyền` : ""}
          </span>
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85svh] overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]">
        <SheetHeader className="text-left">
          <SheetTitle>Hành trang hành trình</SheetTitle>
          <SheetDescription>Toàn bộ di vật, thưởng bộ và lời nguyền đang có hiệu lực.</SheetDescription>
        </SheetHeader>

        <div className="mt-3 space-y-4">
          <div className="rounded-xl border bg-background/60 p-3">
            <HpBar hp={run.hp} max={run.maxHp} shield={run.shield} />
            <p className="type-meta mt-2 inline-flex items-center gap-1">
              <Coins className="size-3.5 text-amber-500" /> {run.coins} xu · Tầng {run.floor}
            </p>
          </div>

          <section>
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
              <Sparkles className="size-4 text-amber-500" /> Di vật ({run.relics.length})
            </p>
            {run.relics.length ? (
              <ul className="grid gap-2 sm:grid-cols-2">
                {run.relics.map((id) => {
                  const r = relicById(id);
                  if (!r) return null;
                  return (
                    <li key={id} className="rounded-xl border bg-card/60 p-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-lg" aria-hidden>
                          {r.icon}
                        </span>
                        <span className="text-sm font-semibold">{r.name}</span>
                      </div>
                      <p className="type-meta mt-0.5">{r.desc}</p>
                      <p className="type-meta opacity-70">
                        {RARITY_LABEL[r.rarity]} · {ELEMENT_LABEL[r.element]}
                      </p>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="type-meta">Chưa có di vật nào — vượt phòng để nhận ban phước.</p>
            )}
          </section>

          {sets.length ? (
            <section>
              <p className="mb-2 text-sm font-semibold">Thưởng bộ đang kích hoạt</p>
              <ul className="space-y-1">
                {sets.map((el) => (
                  <li key={el} className="rounded-lg border border-primary/40 bg-primary/5 p-2 text-sm">
                    <span className="font-semibold">{SET_BONUS[el].name}</span> — {SET_BONUS[el].desc}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section>
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
              <Skull className="size-4 text-destructive" /> Lời nguyền ({run.curses.length})
            </p>
            {run.curses.length ? (
              <ul className="space-y-1">
                {run.curses.map((id) => {
                  const c = curseById(id);
                  if (!c) return null;
                  return (
                    <li key={id} className="rounded-lg border border-destructive/40 bg-destructive/5 p-2 text-sm">
                      <span className="font-semibold">
                        {c.icon} {c.name}
                      </span>{" "}
                      — {c.desc} <span className="type-meta">(bậc {c.rank})</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="type-meta">Chưa mang lời nguyền nào.</p>
            )}
          </section>

          {lines.length ? (
            <section>
              <p className="mb-2 text-sm font-semibold">Tổng hiệu ứng đang có</p>
              <ul className="grid gap-1 sm:grid-cols-2">
                {lines.map((l) => (
                  <li key={l} className="type-meta rounded-lg bg-muted/60 px-2 py-1">
                    {l}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
