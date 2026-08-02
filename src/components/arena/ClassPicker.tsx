import { useCallback, useEffect, useState } from "react";

import { ClassSprite } from "@/components/arena/ClassSprite";
import { CLASSES, classById, DEFAULT_CLASS, type ClassId } from "@/lib/arena/classes";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
    <section className="rounded-2xl border border-border bg-card p-3 sm:p-4">
      <div className="mb-2 flex items-baseline justify-between gap-2 sm:mb-3">
        <h2 className="text-sm font-bold uppercase tracking-wide">Chọn lớp chiến binh</h2>
        <p className="hidden text-[11px] text-muted-foreground sm:block">
          Kiếm sĩ ▸ Pháp sư ▸ Vệ binh ▸ Kiếm sĩ (khắc chế vòng tròn)
        </p>
      </div>
      {/* Điện thoại: 3 thẻ vuông gọn, chi tiết nằm trong tooltip để không phải cuộn. */}
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Lớp chiến binh">
        {CLASSES.map((c) => {
          const active = c.id === value;
          return (
            <Tooltip key={c.id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(c.id)}
                  role="radio"
                  aria-checked={active}
                  aria-label={`${c.name} — ${c.tagline}`}
                  className={cn(
                    "group relative overflow-hidden rounded-xl border p-2 text-left transition sm:p-3",
                    "hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-60",
                    active
                      ? "border-primary bg-primary/10 shadow-md ring-2 ring-primary/40"
                      : "border-border bg-background",
                  )}
                >
                  <div className="flex flex-col items-center gap-0.5 sm:flex-row sm:items-center sm:gap-1">
                    <ClassSprite
                      classId={c.id}
                      action="idle"
                      size={56}
                      className="-my-1 shrink-0 sm:-my-2 sm:size-auto"
                    />
                    <p className="truncate text-xs font-bold sm:text-sm">{c.name}</p>
                  </div>
                  <p className="hidden text-[11px] leading-snug text-muted-foreground sm:block">
                    {c.tagline}
                  </p>
                  <div className="mt-2 hidden flex-wrap gap-1 text-[10px] sm:flex">
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
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-56 sm:hidden">
                <p className="font-semibold">{c.name}</p>
                <p>{c.tagline}</p>
                <p className="text-[11px]">▲ {c.strength} · ▼ {c.weakness}</p>
              </TooltipContent>
            </Tooltip>
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
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex cursor-help items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground",
            className,
          )}
        >
          <span aria-hidden>{c.icon}</span>
          {c.name}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-56">
        <p className="font-semibold">{c.name}</p>
        <p>{c.tagline}</p>
        <p className="text-[11px]">▲ {c.strength} · ▼ {c.weakness}</p>
      </TooltipContent>
    </Tooltip>
  );
}
