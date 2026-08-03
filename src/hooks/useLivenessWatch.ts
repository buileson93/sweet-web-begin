import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";

import { livenessAnswer, livenessChallenge, livenessRegister } from "@/lib/exam.functions";
import { LIVENESS_INTERVAL_MS } from "@/lib/exam/livenessVerify";
import { ensureLivenessKey, signLivenessChallenge } from "@/lib/exam/liveness";

/**
 * Kiểm tra liveness liên tục: đầu giờ đăng ký khoá của thiết bị đang thi,
 * sau đó cứ mỗi 90 giây lấy một thử thách và ký lại bằng khoá không xuất được.
 * Trả lời sai / không trả lời được = dấu hiệu thay người hoặc gọi API bằng script.
 */
export function useLivenessWatch(opts: {
  sessionId: string | null | undefined;
  submitToken: string | null | undefined;
  active: boolean;
}) {
  const { sessionId, submitToken, active } = opts;
  const runRegister = useServerFn(livenessRegister);
  const runChallenge = useServerFn(livenessChallenge);
  const runAnswer = useServerFn(livenessAnswer);
  const busyRef = useRef(false);

  useEffect(() => {
    if (!active || !sessionId || !submitToken) return;
    let stopped = false;

    const tick = async () => {
      if (stopped || busyRef.current) return;
      busyRef.current = true;
      try {
        const { nonce } = await runChallenge({ data: { sessionId, submitToken } });
        if (!nonce || stopped) return;
        const signature = await signLivenessChallenge(sessionId, nonce);
        if (!signature || stopped) return;
        await runAnswer({ data: { sessionId, submitToken, nonce, signature } });
      } catch {
        /* mất mạng: bỏ qua nhịp này, nhịp sau thử lại */
      } finally {
        busyRef.current = false;
      }
    };

    void (async () => {
      const key = await ensureLivenessKey(sessionId);
      if (!key || stopped) return;
      try {
        await runRegister({ data: { sessionId, submitToken, publicJwk: key.publicJwk } });
      } catch {
        return;
      }
      void tick();
    })();

    const timer = setInterval(() => void tick(), LIVENESS_INTERVAL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [active, runAnswer, runChallenge, runRegister, sessionId, submitToken]);
}
