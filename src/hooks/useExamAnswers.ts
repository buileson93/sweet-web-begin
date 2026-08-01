import { useCallback, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { checkAnswer, requestDoublePoints, requestFiftyFifty } from "@/lib/exam.functions";
import type { StartExamResult } from "@/lib/exam.server";
import { COMBO_MIN } from "@/lib/comboFx";
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
  const { session, current, setAnswers } = opts;
  const runFifty = useServerFn(requestFiftyFifty);
  const runX2 = useServerFn(requestDoublePoints);
  const runCheck = useServerFn(checkAnswer);

  const [fifty, setFifty] = useState<Record<string, number[]>>({});
  const [fiftyBusy, setFiftyBusy] = useState(false);
  /** Chỉ số câu đã đặt vật phẩm X2 (mỗi lượt thi một lần). */
  const [x2Index, setX2Index] = useState<number | null>(null);
  const [x2Busy, setX2Busy] = useState(false);
  /** Phản hồi tức thì cho từng câu (chỉ ở chế độ chốt đáp án một lần). */
  const [feedback, setFeedback] = useState<Record<string, "correct" | "wrong">>({});
  /** Đáp án đúng + giải thích do máy chủ trả về sau khi chốt (chế độ chấm ngay). */
  const [feedbackInfo, setFeedbackInfo] = useState<
    Record<string, { correctText: string; explanation: string }>
  >({});
  /** Sự kiện hiệu ứng đúng/sai (like bay lên hoặc mặt buồn). */
  const [answerFx, setAnswerFx] = useState<{ id: number; correct: boolean } | null>(null);
  const [combo, setCombo] = useState(0);
  /** Sự kiện kích hoạt hiệu ứng combo (mỗi lần trả lời đúng liên tiếp). */
  const [comboEvent, setComboEvent] = useState<{ id: number; combo: number } | null>(null);


  const fiftyLeft = 2 - Object.keys(fifty).length;
  const requestFifty = useCallback(async () => {
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

  const requestX2 = useCallback(async () => {
    if (!session || x2Index !== null) return;
    setX2Busy(true);
    try {
      const res = await runX2({
        data: { sessionId: session.sessionId, submitToken: session.submitToken, index: current },
      });
      setX2Index(res.index);
      toast.success("Đã kích hoạt X2 — câu này được nhân đôi điểm!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không dùng được X2.");
    } finally {
      setX2Busy(false);
    }
  }, [current, runX2, session, x2Index]);

  const instant = Boolean(session?.settings?.instantFeedback);
  const locked = (idx: number) => instant && feedback[String(idx)] !== undefined;

  const handleAnswer = useCallback(
    async (idx: number, value: AnswerValue, opt?: { confirm?: boolean; kind?: string }) => {
      if (locked(idx)) return;
      setAnswers((a) => ({ ...a, [String(idx)]: value }));
      if (!instant || !session) return;
      // Câu nhiều lựa chọn / điền / nối / sắp xếp chỉ chấm khi thí sinh bấm "Chốt đáp án",
      // tránh bị khoá ngay lần bấm đầu tiên.
      const kind = opt?.kind ?? session.questions[idx]?.kind;
      const needsConfirm = kind !== "single" && kind !== "true_false";
      if (needsConfirm && !opt?.confirm) return;
      try {
        const res = await runCheck({
          data: {
            sessionId: session.sessionId,
            submitToken: session.submitToken,
            index: idx,
            value,
          },
        });
        // Phòng trường hợp máy chủ trả về dữ liệu rỗng: báo lỗi rõ ràng thay vì vỡ giao diện.
        if (!res || typeof res.correct !== "boolean") {
          throw new Error("Máy chủ không trả về kết quả chấm. Vui lòng thử lại.");
        }
        const isCorrect = res.correct;
        setFeedback((f) => ({ ...f, [String(idx)]: isCorrect ? "correct" : "wrong" }));
        setFeedbackInfo((f) => ({
          ...f,
          [String(idx)]: {
            correctText: res.correctText ?? "",
            explanation: res.explanation ?? "",
          },
        }));
        setAnswerFx({ id: Date.now() + idx, correct: isCorrect });
        setCombo((c) => {
          const next = isCorrect ? c + 1 : 0;
          if (isCorrect && next >= COMBO_MIN) {
            setComboEvent({ id: Date.now() + idx, combo: next });
          } else {
            setComboEvent(null);
          }
          return next;
        });
        // KHÔNG tự chuyển câu: thí sinh tự bấm "Câu tiếp" sau khi đọc xong phản hồi.
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Không chấm được câu này.");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [instant, feedback, runCheck, session, setAnswers],
  );


  /** Dọn trạng thái khi mở lượt thi mới. */
  const resetHelpers = useCallback(() => {
    setFifty({});
    setX2Index(null);
    setFeedback({});
    setFeedbackInfo({});
    setAnswerFx(null);
    setCombo(0);
    setComboEvent(null);
  }, []);

  return {
    fifty,
    fiftyBusy,
    fiftyLeft,
    requestFifty,
    x2Index,
    x2Busy,
    x2Left: x2Index === null ? 1 : 0,
    requestX2,
    feedback,
    feedbackInfo,
    answerFx,
    combo,
    comboEvent,
    instant,
    locked,
    handleAnswer,
    resetHelpers,
  };

}
