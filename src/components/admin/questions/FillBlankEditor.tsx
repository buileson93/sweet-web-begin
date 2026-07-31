import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { FieldMessage } from "./FieldMessage";
import type { EditorProps } from "./types";

/** Câu điền khuyết: danh sách đáp án được chấp nhận, mỗi dòng một đáp án. */
export function FillBlankEditor({ form, setForm, errors, warnings }: EditorProps) {
  return (
    <div className="space-y-2">
      <Label>Các đáp án được chấp nhận (mỗi dòng một đáp án)</Label>
      <Textarea
        rows={3}
        value={form.accepted_answers}
        onChange={(e) => setForm({ ...form, accepted_answers: e.target.value })}
        placeholder={"Hà Nội\nHa Noi"}
      />
      <FieldMessage error={errors?.accepted_answers} warning={warnings?.accepted_answers} />
    </div>
  );
}
