import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, Gem, Skull, Trash2 } from "lucide-react";

import { ArenaHero, ArenaPage } from "@/components/arena/ArenaPage";
import { RunTimeline } from "@/components/tower/RunTimeline";
import { ScoreSources } from "@/components/tower/ScoreSources";
import { SectionHeading } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { clearHistory, frequency, historySummary, readHistory, type RunRecord } from "@/lib/tower/history";
import { curseById } from "@/lib/tower/curses";
import { relicById } from "@/lib/tower/relics";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dau-truong_/thong-ke-thap")({
  head: () => ({
    meta: [
      { title: "Thống kê hành trình Leo Tháp | VATM" },
      {
        name: "description",
        content:
          "Xem nguồn gốc điểm theo từng lượt leo tháp, tần suất di vật và lời nguyền, và xem lại diễn biến theo hạt.",
      },
      { property: "og:title", content: "Thống kê hành trình Leo Tháp" },
      { property: "og:description", content: "Nguồn gốc điểm, tần suất di vật và màn xem lại từng hành trình." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TowerStatsPage,
});

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

function TowerStatsPage() {
  const [rows, setRows] = useState<RunRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");

  useEffect(() => {
    const data = readHistory();
    setRows(data);
    setSelectedId(data[0]?.id ?? "");
  }, []);

  const stats = useMemo(() => historySummary(rows), [rows]);
  const relicFreq = useMemo(() => frequency(rows, "relics").slice(0, 8), [rows]);
  const curseFreq = useMemo(() => frequency(rows, "curses").slice(0, 8), [rows]);
  const selected = useMemo(() => rows.find((r) => r.id === selectedId), [rows, selectedId]);

  return (
    <ArenaPage>
      <ArenaHero
        icon={BarChart3}
        title="Thống kê hành trình Leo Tháp"
        description="Toàn bộ dữ liệu lưu ngay tại máy bạn — xem được cả khi mất mạng."
      />

      {rows.length === 0 ? (
        <section className="space-y-3 rounded-2xl border bg-card/70 p-5">
          <p className="text-sm text-muted-foreground">
            Chưa có hành trình nào được ghi lại. Hoàn thành một lượt leo tháp là dữ liệu sẽ hiện ở đây.
          </p>
          <Button asChild>
            <Link to="/dau-truong/leo-thap">Vào tháp tu luyện</Link>
          </Button>
        </section>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: "Số hành trình", value: stats.runs },
              { label: "Tỉ lệ chinh phục", value: `${stats.winRate}%` },
              { label: "Tầng trung bình", value: stats.avgFloors },
              { label: "Độ chính xác", value: `${stats.accuracy}%` },
              { label: "Điểm cao nhất", value: stats.bestScore },
              { label: "Lượt đã lưu", value: `${rows.length}/20` },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border bg-card/70 p-3 text-center">
                <div className="text-xl font-bold tabular-nums">{s.value}</div>
                <div className="type-meta">{s.label}</div>
              </div>
            ))}
          </section>

          <section className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border bg-card/70 p-4">
              <SectionHeading title="Di vật hay gặp" />
              <ul className="mt-2 space-y-1.5">
                {relicFreq.map((f) => {
                  const relic = relicById(f.id);
                  const pct = Math.round((f.count / Math.max(1, rows.length)) * 100);
                  return (
                    <li key={f.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5">
                          <Gem className="size-3 opacity-60" />
                          {relic?.icon} {relic?.name ?? f.id}
                        </span>
                        <span className="font-mono tabular-nums">{f.count} lượt · {pct}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-fuchsia-500" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
                {!relicFreq.length && <li className="type-meta">Chưa nhặt được di vật nào.</li>}
              </ul>
            </div>

            <div className="rounded-2xl border bg-card/70 p-4">
              <SectionHeading title="Lời nguyền đã gánh" />
              <ul className="mt-2 space-y-1.5">
                {curseFreq.map((f) => {
                  const curse = curseById(f.id);
                  const pct = Math.round((f.count / Math.max(1, rows.length)) * 100);
                  return (
                    <li key={f.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5">
                          <Skull className="size-3 opacity-60" />
                          {curse?.icon} {curse?.name ?? f.id}
                        </span>
                        <span className="font-mono tabular-nums">{f.count} lượt · {pct}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-destructive" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
                {!curseFreq.length && <li className="type-meta">Bạn chưa nhận lời nguyền nào.</li>}
              </ul>
            </div>
          </section>

          <section className="space-y-3 rounded-2xl border bg-card/70 p-4">
            <SectionHeading title="Chọn hành trình để xem lại" />
            <div className="flex gap-2 overflow-x-auto pb-1">
              {rows.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedId(r.id)}
                  className={cn(
                    "min-w-[150px] shrink-0 rounded-xl border p-2 text-left text-xs transition hover:border-primary",
                    r.id === selectedId && "border-primary bg-primary/5 ring-2 ring-primary/25",
                  )}
                >
                  <div className="font-semibold">
                    {r.win ? "👑 " : ""}
                    {r.score} điểm
                  </div>
                  <div className="type-meta">
                    {r.floors} tầng · {mmss(r.seconds)} · TT{r.ascension}
                  </div>
                  <div className="type-meta opacity-70">{new Date(r.finishedAt).toLocaleString("vi-VN")}</div>
                </button>
              ))}
            </div>
          </section>

          {selected && (
            <section className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-2xl border bg-card/70 p-4">
                <SectionHeading title="Nguồn gốc điểm" />
                <div className="mt-2">
                  <ScoreSources
                    input={{
                      floorsCleared: selected.floors,
                      hp: selected.hp,
                      relics: selected.relics,
                      curses: selected.curses,
                      ascension: selected.ascension,
                    }}
                  />
                </div>
                <p className="type-meta mt-2">
                  Hạt: <span className="font-mono">{selected.seed}</span> ·{" "}
                  {selected.daily ? "hạt hằng ngày" : "hạt tự do"} · {selected.correct}/{selected.answered} câu đúng
                </p>
              </div>
              <div className="rounded-2xl border bg-card/70 p-4">
                <SectionHeading title="Diễn biến hành trình" />
                <div className="mt-2 max-h-96 overflow-y-auto pr-1">
                  <RunTimeline log={selected.log} />
                </div>
              </div>
            </section>
          )}

          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/dau-truong/bang-thap">Bảng xếp hạng tháp</Link>
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                clearHistory();
                setRows([]);
                setSelectedId("");
              }}
            >
              <Trash2 className="mr-2 size-4" /> Xoá lịch sử tại máy
            </Button>
          </div>
        </>
      )}
    </ArenaPage>
  );
}
