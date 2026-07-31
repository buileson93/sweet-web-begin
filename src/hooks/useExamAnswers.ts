import { useCallback, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { checkAnswer, requestFiftyFifty } from "@/lib/exam.functions";
import type { StartExamResult } from "@/lib/exam.server";
import type { AnswerValue } from "@/lib/questionKinds";

/**
 * Ghi nhận đáp án, trợ giúp 50:50 và phản hồi tức thì.
 * Ở chế độ tức thì, mỗi câu chỉ được chốt một lần rồi tự chuyển sang câu sau.
 */
export function useExamAnswers(opts: {
  session: StartExamResult | null;
  current: number;
  setCurrent: (updater: (c: number) => number) => void;
  setAnswers: (updater: (a: Record<string, AnswerValue>) => Record<string, AnswerValue>) => void;
}) {
  const { session, current, setCurrent, setAnswers } = opts;
  const runFifty = useServerFn(requestFiftyFifty);
  const runCheck = useServerFn(checkAnswer);

  const [fifty, setFifty] = useState<Record<string, number[]>>({});
  const [fiftyBusy, setFiftyBusy] = useState(false);
  /** Phản hồi tức thì cho từng câu (chỉ ở chế độ chốt đáp án một lần). */
  const [feedback, setFeedback] = useState<Record<string, "correct" | "wrong">>({});
  const [combo, setCombo] = useState(0);

  const fiftyLeft = 2 - Object.keys(fifty).length;
  const useFifty = useCallback(async () => {
    if (!session) return;
    setFiftyBusy(true);
    try {
      const res = await runFifty({
        data: { sessionId: session.sessionId, submitToken: session.submitToken, index: current },
      });
      setFifty((f) => ({ ...f, [String(current)]: res.removed }));
      toast.success("Đã loại 2 phương án sai.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không dùng được trợ giúp.");
    } finally {
      setFiftyBusy(false);
    }
  }, [current, runFifty, session]);

  const instant = Boolean(session?.settings?.instantFeedback);
  const locked = (idx: number) => instant && feedback[String(idx)] !== undefined;

  const handleAnswer = useCallback(
    async (idx: number, value: AnswerValue) => {
      if (locked(idx)) return;
      setAnswers((a) => ({ ...a, [String(idx)]: value }));
      if (!instant || !session) return;
      try {
        const res = await runCheck({
          data: {
            sessionId: session.sessionId,
            submitToken: session.submitToken,
            index: idx,
            value,
          },
        });
        setFeedback((f) => ({ ...f, [String(idx)]: res.correct ? "correct" : "wrong" }));
        setCombo((c) => {
          const next = res.correct ? c + 1 : 0;
          if (res.correct && next >= 3) toast.success(`Combo x${next}! Điểm thưởng đang tăng.`);
          return next;
        });
        setTimeout(() => {
          setCurrent((c) => (c < session.questions.length - 1 ? c + 1 : c));
        }, 1100);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Không chấm được câu này.");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [instant, feedback, runCheck, session, setAnswers, setCurrent],
  );

  /** Dọn trạng thái khi mở lượt thi mới. */
  const resetHelpers = useCallback(() => {
    setFifty({});
    setFeedback({});
    setCombo(0);
  }, []);

  return {
    fifty,
    fiftyBusy,
    fiftyLeft,
    useFifty,
    feedback,
    combo,
    instant,
    locked,
    handleAnswer,
    resetHelpers,
  };
}
