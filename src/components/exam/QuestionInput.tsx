import { ArrowDown, ArrowUp, Check, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { AnswerValue, QuestionKind } from "@/lib/questionKinds";
import { cn } from "@/lib/utils";

export type QuestionInputProps = {
  kind: QuestionKind;
  options: string[];
  matchLeft: string[];
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
  /** Các phương án bị loại bởi trợ giúp 50:50. */
  removed?: number[];
  disabled?: boolean;
  /** Phản hồi tức thì: đáp án đã chốt đúng hay sai. */
  feedback?: "correct" | "wrong" | null;
};

const LETTER = (i: number) => String.fromCharCode(65 + i);

/** Khung chọn đáp án dùng chung cho mọi loại câu hỏi. */
export function QuestionInput({
  kind,
  options,
  matchLeft,
  value,
  onChange,
  removed = [],
  disabled,
  feedback = null,
}: QuestionInputProps) {
  if (kind === "fill_blank") {
    return (
      <div className="mt-4">
        <Input
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder="Nhập đáp án của bạn..."
          aria-label="Đáp án"
          className="h-12 rounded-xl text-base"
        />
        <p className="type-meta mt-2">Không phân biệt chữ hoa/thường và dấu.</p>
      </div>
    );
  }

  if (kind === "matching") {
    const map = (typeof value === "object" && !Array.isArray(value) ? value : {}) as Record<string, number>;
    return (
      <div className="stagger mt-4 space-y-2">
        {matchLeft.map((left, i) => (
          <div
            key={i}
            className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] items-center gap-2 rounded-xl border border-border bg-card p-2.5"
          >
            <span className="min-w-0 text-sm font-semibold">{left}</span>
            <select
              disabled={disabled}
              value={map[String(i)] ?? ""}
              onChange={(e) => onChange({ ...map, [String(i)]: Number(e.target.value) })}
              aria-label={`Chọn mục nối với ${left}`}
              className="h-10 w-full min-w-0 truncate rounded-lg border border-border bg-background px-2 text-sm"
            >
              <option value="">— chọn —</option>
              {options.map((opt, j) => (
                <option key={j} value={j}>
                  {LETTER(j)}. {opt}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    );
  }

  if (kind === "ordering") {
    const order = Array.isArray(value) && value.length === options.length ? (value as number[]) : options.map((_, i) => i);
    const move = (pos: number, dir: -1 | 1) => {
      const next = [...order];
      const target = pos + dir;
      if (target < 0 || target >= next.length) return;
      [next[pos], next[target]] = [next[target], next[pos]];
      onChange(next);
    };
    return (
      <div className="stagger mt-4 space-y-2">
        {order.map((optIndex, pos) => (
          <div key={optIndex} className="flex items-center gap-2 rounded-xl border border-border bg-card p-2.5">
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-secondary text-xs font-extrabold">
              {pos + 1}
            </span>
            <span className="min-w-0 flex-1 text-sm">{options[optIndex]}</span>
            <Button variant="ghost" size="icon" className="size-8 shrink-0" disabled={disabled || pos === 0} onClick={() => move(pos, -1)} aria-label="Lên trên">
              <ArrowUp className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              disabled={disabled || pos === order.length - 1}
              onClick={() => move(pos, 1)}
              aria-label="Xuống dưới"
            >
              <ArrowDown className="size-4" />
            </Button>
          </div>
        ))}
      </div>
    );
  }

  const multi = kind === "multi";
  const selected = multi
    ? new Set(Array.isArray(value) ? (value as number[]) : [])
    : new Set(typeof value === "number" ? [value] : []);

  const toggle = (i: number) => {
    if (!multi) return onChange(i);
    const next = new Set(selected);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    onChange([...next].sort((a, b) => a - b));
  };

  return (
    <div className="stagger mt-5 space-y-2.5">
      {multi ? <p className="type-meta">Có thể chọn nhiều phương án.</p> : null}
      {options.map((opt, i) => {
        const isRemoved = removed.includes(i);
        const active = selected.has(i);
        const state = active && feedback ? feedback : null;
        return (
          <button
            key={i}
            type="button"
            disabled={disabled || isRemoved}
            onClick={() => toggle(i)}
            className={cn(
              "group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border-2 p-3.5 text-left transition-all duration-200 sm:p-4",
              state === "correct"
                ? "border-success bg-success/12"
                : state === "wrong"
                  ? "border-destructive bg-destructive/12"
                  : active
                    ? "animate-tap-shake border-primary bg-primary/10 shadow-[var(--shadow-ring)]"
                    : "border-border bg-card hover:-translate-y-0.5 hover:border-accent/60 hover:bg-secondary active:scale-[0.99]",
              isRemoved && "pointer-events-none opacity-35 line-through",
              disabled && !active && "opacity-60",
            )}
          >
            <span
              className={cn(
                "relative z-10 grid size-9 shrink-0 place-items-center text-sm font-extrabold transition-colors",
                multi ? "rounded-lg" : "rounded-xl",
                state === "correct"
                  ? "bg-success text-primary-foreground"
                  : state === "wrong"
                    ? "bg-destructive text-destructive-foreground"
                    : active
                      ? "surface-gold"
                      : "bg-secondary text-secondary-foreground",
              )}
            >
              {state === "correct" ? (
                <Check className="size-4" />
              ) : state === "wrong" ? (
                <X className="size-4" />
              ) : active && multi ? (
                <Check className="size-4" />
              ) : (
                LETTER(i)
              )}
            </span>
            <span className="relative z-10 min-w-0 flex-1 text-[0.95rem] font-medium leading-snug">{opt}</span>
            {active && !feedback ? (
              <>
                <span className="pointer-events-none absolute inset-0 z-0 animate-answer-ping rounded-2xl bg-primary/15" />
                <span className="tap-flash z-0 rounded-2xl" aria-hidden />
              </>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

