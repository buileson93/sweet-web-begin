import { useState } from "react";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  value: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
  /** Các thẻ đang có trong kho câu hỏi, dùng để gợi ý. */
  suggestions: string[];
};

/** Công thức bốc đề theo THẺ: mỗi dòng là "thẻ + số câu". */
export function TagBlueprintEditor({ value, onChange, suggestions }: Props) {
  const [tag, setTag] = useState("");
  const [count, setCount] = useState(1);
  const rows = Object.entries(value);

  function add(name: string, n: number) {
    const key = name.trim();
    if (!key || n <= 0) return;
    onChange({ ...value, [key]: n });
    setTag("");
    setCount(1);
  }

  function remove(key: string) {
    const next = { ...value };
    delete next[key];
    onChange(next);
  }

  return (
    <div className="rounded-xl border border-border p-3">
      <p className="text-sm font-semibold">Công thức bốc đề theo thẻ</p>
      <p className="text-xs text-muted-foreground">
        Ví dụ: 5 câu thẻ &quot;an toàn bay&quot;. Phần còn thiếu vẫn được bốc ngẫu nhiên.
      </p>

      {rows.length > 0 && (
        <div className="mt-3 space-y-2">
          {rows.map(([key, n]) => (
            <div key={key} className="flex items-center gap-2">
              <span className="status-pill flex-1 justify-start bg-secondary text-secondary-foreground">{key}</span>
              <Input
                type="number"
                min={1}
                className="h-9 w-24"
                value={n}
                onChange={(e) => onChange({ ...value, [key]: Math.max(1, Number(e.target.value) || 1) })}
              />
              <Button size="icon" variant="ghost" className="rounded-full" onClick={() => remove(key)}>
                <X className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div className="min-w-[10rem] flex-1 space-y-1">
          <Label className="text-xs">Thẻ</Label>
          <Input
            list="quiz-tag-suggestions"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            placeholder="Nhập hoặc chọn thẻ"
            className="h-9"
          />
          <datalist id="quiz-tag-suggestions">
            {suggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
        <div className="w-24 space-y-1">
          <Label className="text-xs">Số câu</Label>
          <Input
            type="number"
            min={1}
            className="h-9"
            value={count}
            onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))}
          />
        </div>
        <Button variant="secondary" className="h-9 rounded-full" onClick={() => add(tag, count)}>
          <Plus className="size-4" /> Thêm
        </Button>
      </div>

      {suggestions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {suggestions.slice(0, 10).map((s) => (
            <button
              key={s}
              type="button"
              className="status-pill bg-secondary text-muted-foreground hover:text-foreground"
              onClick={() => setTag(s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
