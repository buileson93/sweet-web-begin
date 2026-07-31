import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock3, Search, Users } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { getQuizParticipation } from "@/lib/participation.functions";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Danh sách nhân viên đã dự thi / chưa dự thi để nhắc nhở. */
export function QuizParticipation({ quizId }: { quizId: string }) {
  const [tab, setTab] = useState<"pending" | "done">("pending");
  const [keyword, setKeyword] = useState("");

  const query = useQuery({
    queryKey: ["participation", quizId],
    queryFn: () => getQuizParticipation({ data: { quizId } }),
    staleTime: 60_000,
  });

  const data = query.data;

  const rows = useMemo(() => {
    if (!data) return [];
    const kw = keyword.trim().toLowerCase();
    const list = tab === "done" ? data.done : data.pending;
    if (!kw) return list;
    return list.filter((r) => r.name.toLowerCase().includes(kw) || r.unit.toLowerCase().includes(kw));
  }, [data, tab, keyword]);

  if (query.isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }
  if (!data) return null;

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        <Stat icon={<Users className="size-4" />} value={data.totalCount} label="Thuộc diện thi" />
        <Stat icon={<CheckCircle2 className="size-4" />} value={data.doneCount} label="Đã thi" tone="success" />
        <Stat icon={<Clock3 className="size-4" />} value={data.pendingCount} label="Chưa thi" tone="warn" />
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary" aria-hidden>
        <div
          className="h-full rounded-full bg-success transition-[width] duration-700"
          style={{ width: `${data.percent}%` }}
        />
      </div>
      <p className="type-meta mt-1.5">Tỉ lệ tham gia {data.percent}%</p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="inline-flex rounded-full bg-secondary p-1">
          {(["pending", "done"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors",
                tab === k ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {k === "pending" ? <Clock3 className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
              {k === "pending" ? `Chưa thi (${data.pendingCount})` : `Đã thi (${data.doneCount})`}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Tìm theo tên hoặc đơn vị"
            className="h-9 rounded-full pl-9"
          />
        </div>
      </div>

      <div className="mt-3 max-h-80 overflow-y-auto rounded-2xl border border-border">
        {rows.length === 0 ? (
          <p className="type-meta p-4 text-center">Không có nhân viên phù hợp.</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{r.name}</span>
                  <span className="type-meta block truncate">{r.unit}</span>
                </span>
                {"bestScore" in r ? (
                  <span className="shrink-0 text-right">
                    <span className="font-heading block text-sm font-extrabold text-primary">
                      {r.bestScore}/{r.total}
                    </span>
                    <span className="type-meta block">
                      {r.attempts} lượt • {formatDateTime(r.lastAt)}
                    </span>
                  </span>
                ) : (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gold/20 px-2.5 py-1 text-[0.7rem] font-bold text-gold-foreground">
                    <Clock3 className="size-3.5" /> Chưa thi
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({
  icon,
  value,
  label,
  tone,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  tone?: "success" | "warn";
}) {
  return (
    <div className="rounded-2xl border border-border bg-card/70 p-3 text-center">
      <span
        className={cn(
          "mx-auto grid size-8 place-items-center rounded-xl",
          tone === "success"
            ? "bg-success/15 text-success"
            : tone === "warn"
              ? "bg-gold/25 text-gold-foreground"
              : "bg-secondary text-primary",
        )}
      >
        {icon}
      </span>
      <span className="font-heading mt-1.5 block text-lg font-extrabold tabular-nums">{value}</span>
      <span className="type-meta block">{label}</span>
    </div>
  );
}
