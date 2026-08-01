import { useEffect, useState } from "react";
import { Loader2, Target } from "lucide-react";

import { readExamEntry } from "@/lib/examSession";
import { getSkillMapFn } from "@/lib/tower.functions";
import { MASTERY_LABEL, type Mastery } from "@/lib/tower/topics";
import { cn } from "@/lib/utils";

type SkillMap = Awaited<ReturnType<typeof getSkillMapFn>>;

const TONE: Record<Mastery, string> = {
  moi: "border-muted-foreground/30 bg-muted/40 text-muted-foreground",
  "dang-hoc": "border-destructive/40 bg-destructive/10 text-destructive",
  kha: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  "thanh-thao": "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
};

/**
 * Bản đồ năng lực theo chủ đề — một khối trong trang Thống kê sẵn có,
 * dữ liệu chỉ đọc từ Elo chủ đề, không liên quan kết quả kỳ thi.
 */
export function SkillMapPanel() {
  const [data, setData] = useState<SkillMap | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "empty">("loading");

  useEffect(() => {
    const entry = readExamEntry(window.sessionStorage);
    if (!entry) {
      setState("empty");
      return;
    }
    let alive = true;
    getSkillMapFn({
      data: {
        name: entry.name,
        credential: entry.credential,
        ...(entry.extraCredential ? { extraCredential: entry.extraCredential } : {}),
      },
    })
      .then((res) => {
        if (!alive) return;
        setData(res);
        setState(res.topics.length ? "ready" : "empty");
      })
      .catch(() => alive && setState("empty"));
    return () => {
      alive = false;
    };
  }, []);

  if (state === "loading")
    return (
      <div className="grid place-items-center rounded-2xl border bg-card/70 p-8">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );

  if (state === "empty" || !data)
    return (
      <div className="rounded-2xl border bg-card/70 p-6 text-center text-sm text-muted-foreground">
        Bản đồ năng lực sẽ hiện sau vài ca trực Tháp Không Lưu hoặc bài thi có gắn chủ đề.
      </div>
    );

  return (
    <section className="space-y-4 rounded-2xl border bg-card/70 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <Target className="size-5 text-primary" />
        <h3 className="text-sm font-semibold">Bản đồ năng lực theo chủ đề</h3>
        <span className="ml-auto text-xs text-muted-foreground">
          Thành thạo {data.mastered}/{data.topics.length} chủ đề
        </span>
      </div>

      <div className="rounded-xl border bg-background/60 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Dự báo sẵn sàng thi</span>
          <span className="text-lg font-bold tabular-nums">{data.readiness}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${data.readiness}%` }} />
        </div>
        <p className="type-meta mt-2">
          Con số tham khảo dựa trên mức thành thạo hiện tại, không thay cho kết quả kỳ thi.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {data.topics.map((t) => (
          <div key={t.tag} className={cn("rounded-xl border p-3", TONE[t.mastery])}>
            <div className="truncate text-sm font-semibold" title={t.tag}>
              {t.tag}
            </div>
            <div className="mt-1 flex items-center justify-between text-xs">
              <span>{MASTERY_LABEL[t.mastery]}</span>
              <span className="tabular-nums">
                {t.accuracy}% · {t.games} lượt
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
