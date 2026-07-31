import { useCallback, useEffect, useState } from "react";

import { CLASSES, classById, DEFAULT_CLASS, type ClassId } from "@/lib/arena/classes";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "arena.class";

/** Đọc / ghi lớp chiến binh đã chọn (nhớ giữa các lần vào sân). */
export function useWarriorClass() {
  const [classId, setClassId] = useState<ClassId>(DEFAULT_CLASS);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setClassId(classById(saved).id);
    } catch {
      /* bỏ qua khi trình duyệt chặn lưu trữ */
    }
  }, []);

  const choose = useCallback((id: ClassId) => {
    setClassId(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* bỏ qua */
    }
  }, []);

  return { classId, choose };
}

/** Thẻ chọn lớp chiến binh trước khi vào trận. */
export function ClassPicker({
  value,
  onChange,
  disabled,
}: {
  value: ClassId;
  onChange: (id: ClassId) => void;
  disabled?: boolean;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide">Chọn lớp chiến binh</h2>
        <p className="text-[11px] text-muted-foreground">
          Kiếm sĩ ▸ Pháp sư ▸ Vệ binh ▸ Kiếm sĩ (khắc chế vòng tròn)
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {CLASSES.map((c) => {
          const active = c.id === value;
          return (
            <button
              key={c.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(c.id)}
              aria-pressed={active}
              className={cn(
                "group relative overflow-hidden rounded-xl border p-3 text-left transition",
                "hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-60",
                active
                  ? "border-primary bg-primary/10 shadow-md ring-2 ring-primary/40"
                  : "border-border bg-background",
              )}
            >
              <span className="text-2xl" aria-hidden>
                {c.icon}
              </span>
              <p className="mt-1 text-sm font-bold">{c.name}</p>
              <p className="text-[11px] leading-snug text-muted-foreground">{c.tagline}</p>
              <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
                <span className="rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">
                  ▲ {c.strength}
                </span>
                <span className="rounded-full bg-destructive/10 px-2 py-0.5 font-semibold text-destructive">
                  ▼ {c.weakness}
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5 font-semibold text-muted-foreground">
                  khắc chế {classById(c.beats).name}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** Nhãn nhỏ hiện lớp chiến binh trong sân đấu. */
export function ClassChip({ classId, className }: { classId?: string | null; className?: string }) {
  const c = classById(classId);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground",
        className,
      )}
      title={`${c.name} — ${c.tagline}`}
    >
      <span aria-hidden>{c.icon}</span>
      {c.name}
    </span>
  );
}
