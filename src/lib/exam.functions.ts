import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const credentialSchema = z.object({
  name: z.string().min(2).max(120),
  credential: z.string().min(4).max(20),
  extraCredential: z.string().max(20).optional(),
});

const startSchema = credentialSchema.extend({
  quizId: z.string().uuid(),
  roomPassword: z.string().max(60).optional(),
  /** Mã thiết bị (localStorage) dùng để chống thi hộ. */
  deviceId: z.string().max(80).optional(),
  /** Token Turnstile (captcha vô hình) để chống script tạo phiên hàng loạt. */
  captchaToken: z.string().max(4000).optional(),
});

/** Đáp án có thể là số, mảng số, chuỗi hoặc bảng ánh xạ (tuỳ loại câu hỏi). */
const answerSchema = z.union([
  z.number().int().min(0).max(50),
  z.array(z.number().int().min(0).max(50)).max(20),
  z.string().max(200),
  z.record(z.string(), z.number().int().min(0).max(50)),
]);

/** Bằng chứng thao tác thật (isTrusted) kèm theo mỗi đáp án — chống gửi đáp án bằng script. */
const proofSchema = z.record(
  z.string(),
  z.object({
    trusted: z.boolean(),
    via: z.enum(["pointer", "key", "none"]).optional(),
    ageMs: z.number().optional(),
    at: z.number().optional(),
  }),
);

const submitSchema = z.object({
  sessionId: z.string().uuid(),
  submitToken: z.string().uuid(),
  answers: z.record(z.string(), answerSchema),
  proofs: proofSchema.optional(),
  disqualified: z.boolean().optional(),
  disqualifyReason: z.string().max(300).optional(),
});

/** Lưu tạm đáp án giữa giờ (autosave). clientSeq tăng dần để chống ghi lùi. */
const progressSchema = z.object({
  sessionId: z.string().uuid(),
  submitToken: z.string().uuid(),
  answers: z.record(z.string(), answerSchema),
  proofs: proofSchema.optional(),
  clientSeq: z.number().int().min(0),
  /** Mắt xích chuỗi băm: mã băm máy chủ đã xác nhận ở gói trước. */
  chainPrev: z.string().length(64).optional(),
  /** Mã băm của chính gói này (băm mắt xích trước + seq + đáp án). */
  chainHash: z.string().length(64).optional(),
  /** Chữ ký gói bằng khoá liveness (ECDSA P-256 không xuất được) của thiết bị đang thi. */
  signature: z.string().min(16).max(500).optional(),
  /** Mốc thời gian máy khách (ms) đã được ký kèm — chống phát lại. */
  at: z.number().int().positive().optional(),
});

export const saveProgress = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => progressSchema.parse(input))
  .handler(async ({ data }) => {
    const { saveExamProgress } = await import("@/lib/exam.server");
    return saveExamProgress(data);
  });

/** Đọc đáp án đã lưu trên máy chủ (không kèm thông tin đúng/sai) để khôi phục bài làm. */
export const loadProgress = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ sessionId: z.string().uuid(), submitToken: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { getExamProgress } = await import("@/lib/exam.server");
    return getExamProgress(data);
  });

const fiftyFiftySchema = z.object({
  sessionId: z.string().uuid(),
  submitToken: z.string().uuid(),
  index: z.number().int().min(0).max(500),
});

export const requestFiftyFifty = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => fiftyFiftySchema.parse(input))
  .handler(async ({ data }) => {
    const { useFiftyFifty } = await import("@/lib/exam.server");
    return useFiftyFifty(data);
  });

/** Vật phẩm X2: nhân đôi điểm của câu đang làm (một lần mỗi lượt thi). */
export const requestDoublePoints = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => fiftyFiftySchema.parse(input))
  .handler(async ({ data }) => {
    const { useDoublePoints } = await import("@/lib/exam.server");
    return useDoublePoints(data);
  });

/** Thoát phòng thi giữa chừng (không chấm điểm). */
export const abandonExam = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ sessionId: z.string().uuid(), submitToken: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { abandonExamSession } = await import("@/lib/exam.server");
    return abandonExamSession(data);
  });

/** Chấm ngay một câu ở chế độ phản hồi tức thì. */
export const checkAnswer = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        sessionId: z.string().uuid(),
        submitToken: z.string().uuid(),
        index: z.number().int().min(0).max(500),
        value: answerSchema,
        proof: z
          .object({
            trusted: z.boolean(),
            via: z.enum(["pointer", "key", "none"]).optional(),
            ageMs: z.number().optional(),
            at: z.number().optional(),
          })
          .optional(),
        signature: z.string().min(16).max(500).optional(),
        at: z.number().int().positive().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { checkExamAnswer } = await import("@/lib/exam.server");
    return checkExamAnswer(data);
  });

export const getServerTime = createServerFn({ method: "GET" }).handler(async () => ({
  now: new Date().toISOString(),
}));

export const startExam = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => startSchema.parse(input))
  .handler(async ({ data }) => {
    const { startExamSession } = await import("@/lib/exam.server");
    return startExamSession(data);
  });

export const submitExam = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => submitSchema.parse(input))
  .handler(async ({ data }) => {
    const { submitExamSession } = await import("@/lib/exam.server");
    return submitExamSession(data);
  });

export const getExamHistory = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => credentialSchema.parse(input))
  .handler(async ({ data }) => {
    const { getExamHistoryFor } = await import("@/lib/exam.server");
    return getExamHistoryFor(data);
  });

/** Ghi nhận sự kiện hành vi trong phòng thi (client KHÔNG tự quyết định huỷ bài). */
export const reportEvent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        sessionId: z.string().uuid(),
        submitToken: z.string().uuid(),
        kind: z.string().max(40),
        detail: z.record(z.string(), z.unknown()).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { reportExamEvent } = await import("@/lib/exam.server");
    return reportExamEvent(data);
  });

/** Đăng ký khoá công khai liveness của thiết bị đang thi (chống thay người giữa chừng). */
export const livenessRegister = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        sessionId: z.string().uuid(),
        submitToken: z.string().uuid(),
        publicJwk: z.record(z.string(), z.unknown()),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { registerLivenessKey } = await import("@/lib/exam/liveness.server");
    return registerLivenessKey(data);
  });

/** Lấy thử thách liveness (nonce ngẫu nhiên, hết hạn sau 2 phút). */
export const livenessChallenge = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ sessionId: z.string().uuid(), submitToken: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { issueLivenessChallenge } = await import("@/lib/exam/liveness.server");
    return issueLivenessChallenge(data);
  });

/** Nộp chữ ký trả lời thử thách liveness. */
export const livenessAnswer = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        sessionId: z.string().uuid(),
        submitToken: z.string().uuid(),
        nonce: z.string().min(8).max(120),
        signature: z.string().min(16).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { answerLivenessChallenge } = await import("@/lib/exam/liveness.server");
    return answerLivenessChallenge(data);
  });
