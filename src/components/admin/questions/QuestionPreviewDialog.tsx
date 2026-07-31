import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { QuestionInput } from "@/components/exam/QuestionInput";
import { questionImageSrc } from "@/lib/questionImage";
import { shuffle } from "@/lib/grading";
import type { AnswerValue } from "@/lib/questionKinds";

import type { QuestionRow } from "./types";

/**
 * Xem trước câu hỏi ĐÚNG như thí sinh nhìn thấy: tái sử dụng QuestionInput của
 * trang thi và trộn phương án để kiểm tra câu sắp xếp / nối cặp hiển thị đúng.
 */
export function QuestionPreviewDialog({
  question,
  onClose,
}: {
  question: QuestionRow | null;
  onClose: () => void;
}) {
  const [seed, setSeed] = useState(0);
  const [value, setValue] = useState<AnswerValue | undefined>(undefined);

  const view = useMemo(() => {
    if (!question) return null;
    const kind = question.kind ?? "single";
    const pairs = Array.isArray(question.pairs) ? question.pairs : [];
    if (kind === "matching") {
      return { kind, options: shuffle(pairs.map((p) => p.right)), matchLeft: pairs.map((p) => p.left) };
    }
    const opts = question.options ?? [];
    // Đúng/Sai giữ nguyên trật tự như trang thi; các loại khác được trộn.
    return {
      kind,
      options: kind === "true_false" || kind === "fill_blank" ? opts : shuffle(opts),
      matchLeft: [] as string[],
    };
    // seed dùng để ép trộn lại khi bấm "Trộn lại".
  }, [question, seed]);

  const src = question ? questionImageSrc(question.image_url) : null;

  return (
    <Dialog
      open={Boolean(question)}
      onOpenChange={(o) => {
        if (!o) {
          setValue(undefined);
          onClose();
        }
      }}
    >
      <DialogContent className="overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Xem trước như thí sinh</DialogTitle>
          <DialogDescription>
            Giao diện dưới đây giống hệt trang thi. Phương án đã được trộn ngẫu nhiên.
          </DialogDescription>
        </DialogHeader>
        {question && view ? (
          <div className="card-elevated p-4">
            <p className="text-base font-semibold leading-relaxed">{question.question}</p>
            {src ? (
              <img
                src={src}
                alt="Ảnh minh hoạ câu hỏi"
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
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" className="rounded-full" onClick={() => setSeed((s) => s + 1)}>
            <RefreshCw className="size-4" /> Trộn lại
          </Button>
          <Button className="rounded-full" onClick={onClose}>
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
