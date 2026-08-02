import { createServerFn } from "@tanstack/react-start";

export type CarouselEventInput = {
  label: string;
  path: string;
  total_cards: number;
  viewed_cards: number;
  max_index: number;
  swipes: number;
  dwell_ms: number;
  clicked: boolean;
  clicked_index: number;
  device_type: string;
  visitor_key: string;
  /** Tên các thẻ hiển thị theo đúng thứ tự (ví dụ tên cuộc thi). */
  card_labels?: string[];
  /** Tên thẻ được bấm, nếu có. */
  clicked_label?: string;
};

const str = (v: unknown, max: number) => String(v ?? "").slice(0, max);
const int = (v: unknown, max = 100000) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(Math.max(Math.round(n), -1), max) : 0;
};

/** Trần số bản ghi cho mỗi người truy cập trong một giờ (chống spam làm phình dữ liệu). */
const MAX_EVENTS_PER_HOUR = 40;
/** Số thẻ tối đa được lưu tên, tránh payload khổng lồ. */
const MAX_LABELS = 30;

/** Ghi nhận hành vi vuốt dải thẻ (số thẻ đã xem, thời gian dừng, có bấm không). */
export const recordCarouselEvent = createServerFn({ method: "POST" })
  .inputValidator((data: CarouselEventInput) => data)
  .handler(async ({ data }) => {
    const visitorKey = str(data.visitor_key, 64);
    // Khoá cứng: thiếu định danh phiên thì không ghi, tránh rác vô danh không kiểm soát được.
    if (visitorKey.length < 8) return { ok: false, reason: "invalid_visitor" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Chống lạm dụng: giới hạn tần suất theo người truy cập trong 1 giờ gần nhất.
    const since = new Date(Date.now() - 3_600_000).toISOString();
    const { count } = await supabaseAdmin
      .from("carousel_events")
      .select("id", { count: "exact", head: true })
      .eq("visitor_key", visitorKey)
      .gte("created_at", since);
    if ((count ?? 0) >= MAX_EVENTS_PER_HOUR) return { ok: false, reason: "rate_limited" as const };

    const labels = Array.isArray(data.card_labels)
      ? data.card_labels.slice(0, MAX_LABELS).map((l) => str(l, 120))
      : [];

    const { error } = await supabaseAdmin.from("carousel_events").insert({
      label: str(data.label, 80),
      path: str(data.path, 200),
      total_cards: int(data.total_cards, 500),
      viewed_cards: int(data.viewed_cards, 500),
      max_index: int(data.max_index, 500),
      swipes: int(data.swipes, 5000),
      dwell_ms: int(data.dwell_ms, 3600000),
      clicked: Boolean(data.clicked),
      clicked_index: int(data.clicked_index, 500),
      device_type: str(data.device_type, 20),
      visitor_key: visitorKey,
      card_labels: labels,
      clicked_label: str(data.clicked_label, 120),
    });
    if (error) {
      console.error("record carousel event failed:", error.message);
      return { ok: false, reason: "insert_failed" as const };
    }
    return { ok: true };
  });
