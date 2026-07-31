import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { FieldMessage } from "./FieldMessage";
import type { EditorProps } from "./types";

/** Câu nối cặp: các cặp vế trái - vế phải. */
export function MatchingEditor({ form, setForm, errors, warnings }: EditorProps) {
  return (
    <div className="space-y-2">
      <Label>Các cặp cần nối</Label>
      {form.pairs.map((p, i) => (
        <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2">
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
        onClick={() => setForm({ ...form, pairs: [...form.pairs, { left: "", right: "" }] })}
      >
        <Plus className="size-4" /> Thêm cặp
      </Button>
    </div>
  );
}
