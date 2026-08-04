/**
 * "Biến đổi ngẫu nhiên" phương án trả lời (Randomized Payload & Layout).
 *
 * Mục tiêu: làm script cào/chọn tự động bị loạn.
 *  1. Mỗi lần hiển thị một câu, mỗi phương án được gán một TOKEN dùng một lần
 *     (tok_xxxxxxxx). Token không cố định theo ngân hàng câu hỏi nên script
 *     không thể tra sẵn "token nào là đáp án đúng".
 *  2. Thứ tự các thẻ HTML trong DOM bị tráo ngẫu nhiên; vị trí nhìn thấy được
 *     khôi phục bằng CSS `order`. Script đọc DOM theo thứ tự sẽ chọn sai.
 *  3. Chèn thêm các thẻ mồi (honeypot) mang đáp án giả, người thật không thể
 *     chạm tới (kích thước 1px, trong suốt, pointer-events: none, aria-hidden).
 *     Script quét DOM cẩu thả sẽ bấm vào mồi -> lộ diện ngay lập tức.
 *
 * Module thuần tuý (không phụ thuộc React/DOM) để test được.
 */

export type CloakSlot = {
  /** Khoá React, ngẫu nhiên theo lần hiển thị. */
  key: string;
  /** Token dùng một lần, đặt vào thuộc tính data-opt của thẻ. */
  token: string;
  /** Thẻ thật hay thẻ mồi. */
  kind: "real" | "trap";
  /** Chỉ số phương án thật (thẻ mồi = -1). */
  index: number;
  /** Vị trí hiển thị (CSS order) — giữ nguyên thứ tự thí sinh nhìn thấy. */
  visual: number;
  /** Nội dung hiển thị của thẻ. */
  text: string;
};

export type Cloak = {
  /** Danh sách thẻ theo THỨ TỰ DOM (đã tráo). */
  slots: CloakSlot[];
  /** Tra token của một phương án thật. */
  tokenOf: (index: number) => string;
};

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

function defaultRng(): number {
  const c = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (c?.getRandomValues) {
    const buf = new Uint32Array(1);
    c.getRandomValues(buf);
    return (buf[0] as number) / 2 ** 32;
  }
  return Math.random();
}

/** Sinh token dùng một lần dạng `tok_xxxxxxxx`. */
export function randomToken(rng: () => number = defaultRng): string {
  let out = "";
  for (let i = 0; i < 8; i += 1) {
    out += ALPHABET[Math.floor(rng() * ALPHABET.length)] ?? "x";
  }
  return `tok_${out}`;
}

/** Tráo mảng theo Fisher–Yates. */
export function shuffled<T>(items: readonly T[], rng: () => number = defaultRng): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j] as T, arr[i] as T];
  }
  return arr;
}

/** Nội dung mồi: lấy từ một phương án thật rồi biến đổi nhẹ để trông "hợp lý". */
function decoyText(options: readonly string[], rng: () => number): string {
  const base = options[Math.floor(rng() * options.length)] ?? "";
  return base.length > 4 ? base.slice(0, Math.max(4, base.length - 1)) : `${base} `;
}

/**
 * Dựng lớp nguỵ trang cho danh sách phương án của MỘT lần hiển thị câu hỏi.
 * @param trapCount số thẻ mồi chèn thêm (mặc định 2, tối đa 4).
 */
export function buildCloak(
  options: readonly string[],
  opts: { trapCount?: number; rng?: () => number } = {},
): Cloak {
  const rng = opts.rng ?? defaultRng;
  const trapCount = Math.max(0, Math.min(4, opts.trapCount ?? 2));

  const tokens = options.map(() => randomToken(rng));
  const real: CloakSlot[] = options.map((text, i) => ({
    key: `r-${tokens[i]}`,
    token: tokens[i] as string,
    kind: "real",
    index: i,
    visual: i,
    text,
  }));

  const traps: CloakSlot[] = Array.from({ length: options.length ? trapCount : 0 }, () => {
    const token = randomToken(rng);
    return {
      key: `t-${token}`,
      token,
      kind: "trap" as const,
      index: -1,
      visual: Math.floor(rng() * Math.max(1, options.length)),
      text: decoyText(options, rng),
    };
  });

  return {
    slots: shuffled([...real, ...traps], rng),
    tokenOf: (index: number) => tokens[index] ?? "",
  };
}
