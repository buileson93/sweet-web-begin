import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { QuestionInput } from "@/components/exam/QuestionInput";
import { RichText } from "@/components/RichText";
import { questionImageSrc } from "@/lib/questionImage";
import { shuffle } from "@/lib/grading";
import type { AnswerValue } from "@/lib/questionKinds";

import type { QuestionFormState } from "./types";

/**
 * Khung xem trước trực tiếp: dựng đúng giao diện thí sinh nhìn thấy từ trạng thái
 * biểu mẫu đang soạn. Dùng seed để trộn ổn định — gõ chữ không làm phương án nhảy loạn.
 */
export function QuestionLivePreview({ form }: { form: QuestionFormState }) {
  const [seed, setSeed] = useState(1);
  const [value, setValue] = useState<AnswerValue | undefined>(undefined);

  const view = useMemo(() => {
    const kind = form.kind;
    if (kind === "matching") {
      const pairs = form.pairs.filter((p) => p.left.trim() || p.right.trim());
      return {
        kind,
        options: shuffle(
          pairs.map((p) => p.right),
          seed,
        ),
        matchLeft: pairs.map((p) => p.left),
      };
    }
    const opts = form.options.filter((o) => o.trim());
    return {
      kind,
      options:
        kind === "true_false" || kind === "fill_blank" ? form.options : shuffle(opts, seed),
      matchLeft: [] as string[],
    };
  }, [form, seed]);

  const src = questionImageSrc(form.image_url);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="type-meta">Xem trước như thí sinh — cập nhật ngay khi bạn gõ.</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="rounded-full"
          onClick={() => setSeed((s) => s + 1)}
        >
          <RefreshCw className="size-4" /> Trộn lại
        </Button>
      </div>
      <div className="card-elevated p-4">
        <div className="text-base font-semibold leading-relaxed">
          {form.question.trim() ? (
            <RichText>{form.question}</RichText>
          ) : (
            "Nội dung câu hỏi sẽ hiện ở đây..."
          )}
        </div>
        {src ? (
          <img
            src={src}
            alt={form.image_alt || "Ảnh minh hoạ câu hỏi"}
            className="mt-3 max-h-56 rounded-xl border border-border object-contain"
          />
        ) : null}
        <QuestionInput
          kind={view.kind}
          options={view.options}
          matchLeft={view.matchLeft}
          value={value}
          onChange={setValue}
        />
        {form.explanation.trim() ? (
          <div className="mt-3 rounded-xl bg-secondary px-3 py-2 text-sm">
            <span className="font-semibold">Giải thích: </span>
            <RichText inline>{form.explanation}</RichText>
          </div>
        ) : null}
        {form.option_explanations.some((t) => (t ?? "").trim()) ? (
          <ul className="mt-2 space-y-1 rounded-xl border border-border px-3 py-2">
            {form.options.map((opt, i) =>
              (form.option_explanations[i] ?? "").trim() ? (
                <li key={i} className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    {String.fromCharCode(65 + i)}. {opt || "(chưa có nội dung)"}:{" "}
                  </span>
                  <RichText inline>{form.option_explanations[i]}</RichText>
                </li>
              ) : null,
            )}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
