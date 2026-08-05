/**
 * Cloudflare Turnstile phía trình duyệt — captcha VÔ HÌNH (không bắt giải đố).
 *
 * SDK tự phân tích độ rung chuột, gia tốc, sự kiện DOM, mạng và hạ tầng rồi cấp
 * một token dùng một lần; máy chủ đổi token đó lấy điểm rủi ro. Nếu chưa cấu
 * hình khoá công khai thì hàm trả về undefined và luồng thi chạy như cũ.
 */

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  execute: (id: string) => void;
  reset: (id: string) => void;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/** Khoá công khai (site key) của widget Turnstile — không phải bí mật. */
const DEFAULT_SITE_KEY = "0x4AAAAAAEF4VZi22tNPzGJj";

export function turnstileSiteKey(): string {
  const fromEnv = (import.meta.env["VITE_TURNSTILE_SITE_KEY"] as string | undefined)?.trim();
  return fromEnv || DEFAULT_SITE_KEY;
}

let scriptPromise: Promise<TurnstileApi | null> | null = null;

function loadScript(): Promise<TurnstileApi | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<TurnstileApi | null>((resolve) => {
    const el = document.createElement("script");
    el.src = SCRIPT_URL;
    el.async = true;
    el.defer = true;
    el.onload = () => resolve(window.turnstile ?? null);
    el.onerror = () => resolve(null);
    document.head.appendChild(el);
  });
  return scriptPromise;
}

/** Nạp sẵn SDK để lúc bấm "Vào thi" không phải chờ. */
export function preloadTurnstile(): void {
  if (turnstileSiteKey()) void loadScript();
}

/**
 * Lấy token xác minh vô hình.
 * @returns token, hoặc undefined khi chưa bật/không lấy được (không chặn thí sinh).
 */
export async function getTurnstileToken(action = "start-exam", timeoutMs = 10000): Promise<string | undefined> {
  const sitekey = turnstileSiteKey();
  if (!sitekey) return undefined;
  const api = await loadScript();
  if (!api) return undefined;

  const holder = document.createElement("div");
  holder.style.position = "fixed";
  holder.style.bottom = "-9999px";
  holder.style.left = "-9999px";
  document.body.appendChild(holder);

  return new Promise<string | undefined>((resolve) => {
    let done = false;
    let widgetId: string | undefined;
    const finish = (token?: string) => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      try {
        if (widgetId) api.remove(widgetId);
      } catch {
        /* bỏ qua */
      }
      holder.remove();
      resolve(token);
    };
    const timer = window.setTimeout(() => finish(undefined), timeoutMs);

    try {
      widgetId = api.render(holder, {
        sitekey,
        action,
        size: "invisible",
        appearance: "interaction-only",
        execution: "execute",
        callback: (token: string) => finish(token),
        "error-callback": () => finish(undefined),
        "timeout-callback": () => finish(undefined),
      });
      api.execute(widgetId);
    } catch {
      finish(undefined);
    }
  });
}
