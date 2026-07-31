import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { loadProgress } from "@/lib/exam.functions";
import type { StartExamResult } from "@/lib/exam.server";
import { mergeAnswers, restoreExamSession } from "@/lib/examSession";
import { seqKey } from "@/hooks/useExamAutosave";
import type { AnswerValue } from "@/lib/questionKinds";

/** Khoá lưu đáp án tạm trên máy (giữ bài khi F5 hoặc mất mạng). */
export const localAnswersKey = (sessionId: string) => "exam:answers:" + sessionId;

/**
 * Khôi phục phiên thi: đọc phiên từ sessionStorage, hợp nhất đáp án lưu trên máy
 * với đáp án đã autosave trên máy chủ, và tiếp tục lưu tạm khi người thi trả lời.
 */
export function useExamRestore(finished: boolean) {
  const navigate = useNavigate();
  const runLoadProgress = useServerFn(loadProgress);

  const [session, setSession] = useState<StartExamResult | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  /** Seq autosave lấy từ máy chủ sau khi khôi phục bài làm. */
  const [serverSeq, setServerSeq] = useState(0);
  const autosaveAckRef = useRef<{ answers: Record<string, AnswerValue>; seq: number } | null>(null);

  useEffect(() => {
    const restored = restoreExamSession(
      typeof window === "undefined" ? null : window.sessionStorage,
    );
    if (!restored) {
      navigate({ to: "/" });
      return;
    }
    setSession(restored);

    // Khôi phục bài làm: hợp nhất đáp án lưu trên máy với đáp án đã autosave trên máy chủ,
    // bên nào có seq lớn hơn thì thắng ở những câu bị trùng.
    let localAnswers: Record<string, AnswerValue> = {};
    let localSeq = 0;
    try {
      const raw = window.sessionStorage.getItem(localAnswersKey(restored.sessionId));
      if (raw) localAnswers = JSON.parse(raw) as Record<string, AnswerValue>;
      localSeq = Number(window.sessionStorage.getItem(seqKey(restored.sessionId)) ?? 0) || 0;
    } catch {
      /* bỏ qua khi dữ liệu hỏng */
    }
    if (Object.keys(localAnswers).length > 0) setAnswers(localAnswers);

    void (async () => {
      try {
        const server = await runLoadProgress({
          data: { sessionId: restored.sessionId, submitToken: restored.submitToken },
        });
        const merged = mergeAnswers<AnswerValue>(
          localAnswers,
          server.answers as Record<string, AnswerValue>,
          localSeq,
          server.seq,
        );
        setAnswers(merged.answers);
        setServerSeq(merged.seq);
        autosaveAckRef.current = {
          answers: (server.answers as Record<string, AnswerValue>) ?? {},
          seq: server.seq,
        };
      } catch (error) {
        // Phiên đã bị đóng (hết giờ, mở lượt mới ở nơi khác, đã nộp): dọn sạch dấu vết
        // trên máy và đưa thí sinh về trang chủ thay vì để kẹt trong phòng thi lỗi.
        const message = error instanceof Error ? error.message : "";
        if (/không hợp lệ|hết giờ/i.test(message)) {
          try {
            window.sessionStorage.removeItem("exam:" + restored.sessionId);
            window.sessionStorage.removeItem("exam:current");
            window.sessionStorage.removeItem(localAnswersKey(restored.sessionId));
            window.sessionStorage.removeItem(seqKey(restored.sessionId));
          } catch {
            /* bỏ qua khi trình duyệt chặn lưu trữ */
          }
          toast.warning(
            message.includes("hết giờ")
              ? "Lượt thi đã hết giờ. Bạn có thể bắt đầu lượt thi mới."
              : "Lượt thi này đã kết thúc hoặc bạn đã mở lượt thi khác. Vui lòng vào lại phòng thi.",
          );
          navigate({ to: "/" });
          return;
        }
        /* mất mạng: vẫn thi tiếp bằng bản lưu trên máy */
      }
    })();

  }, [navigate, runLoadProgress]);

  // Lưu đáp án xuống sessionStorage mỗi khi thay đổi (chống mất bài khi F5).
  useEffect(() => {
    if (!session || finished) return;
    try {
      window.sessionStorage.setItem(localAnswersKey(session.sessionId), JSON.stringify(answers));
    } catch {
      /* bỏ qua khi trình duyệt chặn lưu trữ */
    }
  }, [answers, session, finished]);

  /** Xoá mọi dấu vết của phiên thi trên máy (sau khi nộp hoặc thoát phòng thi). */
  const clearLocal = useCallback((sessionId: string) => {
    sessionStorage.removeItem("exam:" + sessionId);
    sessionStorage.removeItem("exam:current");
    sessionStorage.removeItem(localAnswersKey(sessionId));
    sessionStorage.removeItem(seqKey(sessionId));
  }, []);

  return { session, setSession, answers, setAnswers, serverSeq, autosaveAckRef, clearLocal };
}
