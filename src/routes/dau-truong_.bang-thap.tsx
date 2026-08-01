import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Crown, Loader2, Trophy } from "lucide-react";

import { ArenaHero, ArenaPage } from "@/components/arena/ArenaPage";
import { Button } from "@/components/ui/button";
import { getTowerBoardDetailFn } from "@/lib/tower.functions";
import { BOARD_LABEL, type Board } from "@/lib/tower/score";
import { relicById } from "@/lib/tower/relics";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dau-truong_/bang-thap")({
  head: () => ({
    meta: [
      { title: "Bảng xếp hạng Tháp Không Lưu | VATM" },
      {
        name: "description",
        content: "Bảng xếp hạng hành trình Leo Tháp: xem theo ngày, lọc theo bậc thăng thiên và soi từng lượt leo.",
      },
      { property: "og:title", content: "Bảng xếp hạng Tháp Không Lưu" },
      {
        property: "og:description",
        content: "So tài leo tháp theo hạt hằng ngày và hạt tự do, lọc theo bậc thăng thiên.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TowerBoardPage,
});

type Row = Awaited<ReturnType<typeof getTowerBoardDetailFn>>["rows"][number];

function TowerBoardPage() {
  const fetchBoard = useServerFn(getTowerBoardDetailFn);
  const [board, setBoard] = useState<Board>("hang-ngay");
  const [dayKey, setDayKey] = useState<string>("");
  const [asc, setAsc] = useState<number | "all">("all");
  const [rows, setRows] = useState<Row[]>([]);
  const [days, setDays] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    fetchBoard({
      data: {
        board,
        ...(dayKey ? { dayKey } : {}),
        ...(asc === "all" ? {} : { ascension: asc }),
      },
    })
      .then((res) => {
        if (!alive) return;
        setRows(res.rows);
        setDays(res.days);
      })
      .catch(() => alive && setError("Không tải được bảng xếp hạng. Thử lại sau ít phút."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [fetchBoard, board, dayKey, asc]);

  const top = useMemo(() => rows.slice(0, 3), [rows]);

  return (
    <ArenaPage>
      <ArenaHero
        icon={Trophy}
        title="Bảng xếp hạng Tháp Không Lưu"
        description="Xem theo ngày, lọc theo bậc thăng thiên và soi kỹ từng hành trình."
      />

      <section className="space-y-3 rounded-2xl border bg-card/70 p-4 sm:p-5">
        <div className="flex flex-wrap gap-2">
          {(["hang-ngay", "tu-do"] as Board[]).map((b) => (
            <Button
              key={b}
              size="sm"
              variant={board === b ? "default" : "outline"}
              onClick={() => {
                setBoard(b);
                setDayKey("");
              }}
            >
              {BOARD_LABEL[b]}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="type-meta" htmlFor="twr-day">
            Ngày
          </label>
          <select
            id="twr-day"
            value={dayKey}
            onChange={(e) => setDayKey(e.target.value)}
            className="h-9 rounded-md border bg-background px-2 text-sm"
          >
            <option value="">{board === "hang-ngay" ? "Hôm nay" : "Tất cả các ngày"}</option>
            {days.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          <label className="type-meta ml-2" htmlFor="twr-asc">
            Thăng thiên
          </label>
          <select
            id="twr-asc"
            value={String(asc)}
            onChange={(e) => setAsc(e.target.value === "all" ? "all" : Number(e.target.value))}
            className="h-9 rounded-md border bg-background px-2 text-sm"
          >
            <option value="all">Mọi bậc</option>
            {Array.from({ length: 11 }, (_, i) => (
              <option key={i} value={i}>
                Bậc {i}
              </option>
            ))}
          </select>
        </div>
      </section>

      {loading ? (
        <div className="flex items-center gap-2 rounded-2xl border bg-card/70 p-5 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Đang tải bảng xếp hạng…
        </div>
      ) : error ? (
        <p className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">{error}</p>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border bg-card/70 p-5 text-sm text-muted-foreground">
          Chưa có hành trình nào khớp bộ lọc. Hãy là người đầu tiên leo tháp hôm nay.
        </p>
      ) : (
        <>
          <section className="grid gap-2 sm:grid-cols-3">
            {top.map((r) => (
              <div
                key={`${r.rank}-${r.name}`}
                className={cn(
                  "rounded-2xl border p-3",
                  r.rank === 1 ? "border-amber-400/70 bg-amber-400/10" : "bg-card/70",
                )}
              >
                <div className="flex items-center gap-1.5 text-sm font-bold">
                  {r.rank === 1 && <Crown className="size-4 text-amber-500" />}#{r.rank} {r.name}
                </div>
                <div className="type-meta">{r.unit}</div>
                <div className="mt-1 text-2xl font-bold tabular-nums">{r.score}</div>
                <div className="type-meta">
                  {r.floors} tầng · {r.hp} an toàn · thăng thiên {r.ascension}
                </div>
              </div>
            ))}
          </section>

          <section className="overflow-x-auto rounded-2xl border bg-card/70">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-2">#</th>
                  <th className="p-2">Người chơi</th>
                  <th className="p-2">Điểm</th>
                  <th className="p-2">Tầng</th>
                  <th className="p-2">An toàn</th>
                  <th className="p-2">TT</th>
                  <th className="p-2">Trang bị</th>
                  <th className="p-2">Hạt</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.rank}-${r.name}`} className="border-t">
                    <td className="p-2 font-mono tabular-nums">{r.rank}</td>
                    <td className="p-2">
                      <div className="font-medium">
                        {r.name} {r.win && <span title="Chinh phục đỉnh tháp">👑</span>}
                      </div>
                      <div className="type-meta">{r.unit}</div>
                    </td>
                    <td className="p-2 font-semibold tabular-nums">{r.score}</td>
                    <td className="p-2 tabular-nums">{r.floors}</td>
                    <td className="p-2 tabular-nums">{r.hp}</td>
                    <td className="p-2 tabular-nums">{r.ascension}</td>
                    <td className="p-2">
                      <span className="text-base" title={r.relicIds.map((id) => relicById(id)?.name ?? id).join(", ")}>
                        {r.relicIds.slice(0, 5).map((id) => relicById(id)?.icon ?? "•").join(" ")}
                      </span>
                      {r.curses > 0 && <span className="type-meta ml-1">· {r.curses} yếu tố bất lợi</span>}
                    </td>
                    <td className="p-2 font-mono text-xs opacity-70">{r.seed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link to="/dau-truong/leo-thap">Vào tháp huấn luyện</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link to="/dau-truong/thong-ke-thap">Thống kê hành trình của tôi</Link>
        </Button>
      </div>
    </ArenaPage>
  );
}
