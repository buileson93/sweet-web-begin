import { GripVertical, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { FieldMessage } from "./FieldMessage";
import { useDragList } from "./useDragList";
import { newPairId } from "./types";
import type { EditorProps } from "./types";

/**
 * Câu nối cặp: các cặp vế trái - vế phải.
 * Mỗi cặp có `id` riêng làm khoá React — xoá một cặp ở giữa sẽ KHÔNG làm
 * nhảy con trỏ hay mất focus như khi dùng chỉ số mảng làm khoá.
 */
export function MatchingEditor({ form, setForm, errors, warnings }: EditorProps) {
  const move = (from: number, to: number) => {
    const next = [...form.pairs];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setForm({ ...form, pairs: next });
  };
  const drag = useDragList(move);

  return (
    <div className="space-y-2">
      <Label>Các cặp cần nối</Label>
      <p className="type-meta">Kéo biểu tượng ⠿ để đổi thứ tự các cặp.</p>
      {form.pairs.map((p, i) => (
        <div
          key={p.id ?? `pair-${i}`}
          draggable
          onDragStart={() => drag.onDragStart(i)}
          onDragOver={(e) => drag.onDragOver(e, i)}
          onDrop={() => drag.onDrop(i)}
          onDragEnd={drag.onDragEnd}
          className={`grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2 rounded-xl transition-colors ${
            drag.overIndex === i ? "bg-primary/10 ring-1 ring-primary/40" : ""
          }`}
        >
          <span
            className="cursor-grab px-1 text-muted-foreground active:cursor-grabbing"
            aria-label={`Kéo để đổi thứ tự cặp ${i + 1}`}
            role="button"
            tabIndex={-1}
          >
            <GripVertical className="size-4" />
          </span>
          <Input
            value={p.left}
            placeholder="Vế trái"
            onChange={(e) => {
              const next = [...form.pairs];
              next[i] = { ...next[i], left: e.target.value };
              setForm({ ...form, pairs: next });
            }}
          />
          <Input
            value={p.right}
            placeholder="Vế phải"
            onChange={(e) => {
              const next = [...form.pairs];
              next[i] = { ...next[i], right: e.target.value };
              setForm({ ...form, pairs: next });
            }}
          />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Xoá cặp"
            onClick={() => setForm({ ...form, pairs: form.pairs.filter((_, j) => j !== i) })}
          >
            <X className="size-4" />
          </Button>
        </div>
      ))}
      <FieldMessage error={errors?.pairs} warning={warnings?.pairs} />
      <Button
        variant="outline"
        size="sm"
        className="rounded-full"
        onClick={() =>
          setForm({ ...form, pairs: [...form.pairs, { id: newPairId(), left: "", right: "" }] })
        }
      >
        <Plus className="size-4" /> Thêm cặp
      </Button>
    </div>
  );
}
