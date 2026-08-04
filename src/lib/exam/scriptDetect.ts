/**
 * Phát hiện script / trình duyệt tự động hoá trong phòng thi.
 * Toàn bộ là logic thuần tuý để test được; phần đọc môi trường có kiểm tra an toàn.
 */

export type ProofLike = { trusted?: boolean; via?: string; ageMs?: number; at?: number };

/** Những câu MỚI không có bằng chứng thao tác thật (script gửi thẳng API). */
export function unprovenKeys(keys: string[], proofs?: Record<string, ProofLike>): string[] {
  if (!proofs) return [];
  return keys.filter((key) => proofs[key]?.trusted !== true);
}

/** Số mẫu tối thiểu để kết luận nhịp bấm "máy móc". */
export const ROBOTIC_MIN_SAMPLES = 5;
/** Hệ số biến thiên dưới mức này là nhịp đều bất thường (người thật luôn lệch nhiều hơn). */
export const ROBOTIC_CV = 0.06;

/** Hệ số biến thiên = độ lệch chuẩn / trung bình. */
export function coefficientOfVariation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  if (mean <= 0) return 0;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}

/** Nhịp trả lời đều như máy (khoảng cách giữa các câu gần như bằng nhau). */
export function isRoboticTiming(timestamps: number[]): boolean {
  const sorted = [...timestamps].filter((t) => Number.isFinite(t)).sort((a, b) => a - b);
  if (sorted.length < ROBOTIC_MIN_SAMPLES + 1) return false;
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i += 1) gaps.push(sorted[i]! - sorted[i - 1]!);
  if (gaps.some((g) => g <= 0)) return true; // nhiều đáp án cùng một mốc thời gian
  return coefficientOfVariation(gaps) < ROBOTIC_CV;
}

export type AutomationEnv = {
  webdriver?: boolean;
  userAgent?: string;
  languages?: readonly string[];
  plugins?: number;
  /** Có biến toàn cục do công cụ điều khiển trình duyệt để lại (Selenium / CDP). */
  driverGlobals?: string[];
  /** Có API tự động hoá (Puppeteer/Playwright bơm vào). */
  automationApis?: string[];
};

/** Danh sách dấu hiệu tự động hoá phát hiện được. */
export function automationSignals(env: AutomationEnv): string[] {
  const out: string[] = [];
  if (env.webdriver === true) out.push("webdriver");
  const ua = (env.userAgent ?? "").toLowerCase();
  if (/headless|phantomjs|electron\/|puppeteer|playwright|selenium/.test(ua)) out.push("ua");
  if (Array.isArray(env.languages) && env.languages.length === 0) out.push("no_languages");
  if ((env.driverGlobals?.length ?? 0) > 0) out.push("driver_globals");
  if ((env.automationApis?.length ?? 0) > 0) out.push("automation_api");
  return out;
}

/** Đọc môi trường trình duyệt hiện tại (chỉ chạy phía máy khách). */
export function collectAutomationEnv(): AutomationEnv {
  if (typeof navigator === "undefined" || typeof window === "undefined") return {};
  const w = window as unknown as Record<string, unknown>;
  const driverGlobals = Object.keys(w).filter((k) =>
    /^(cdc_|\$cdc_|__webdriver|__selenium|__nightmare|__fxdriver|_phantom|callPhantom|domAutomation)/i.test(
      k,
    ),
  );
  const automationApis = [
    "__playwright",
    "__pw_manual",
    "__puppeteer_evaluation_script__",
    "_Selenium_IDE_Recorder",
  ].filter((k) => k in w);
  return {
    webdriver: Boolean((navigator as Navigator & { webdriver?: boolean }).webdriver),
    userAgent: navigator.userAgent,
    languages: navigator.languages ?? [],
    plugins: navigator.plugins?.length ?? 0,
    driverGlobals,
    automationApis,
  };
}
