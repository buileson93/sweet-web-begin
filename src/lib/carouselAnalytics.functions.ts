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
};

const str = (v: unknown, max: number) => String(v ?? "").slice(0, max);
const int = (v: unknown, max = 100000) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(Math.max(Math.round(n), -1), max) : 0;
};

/** Ghi nhận hành vi vuốt dải thẻ (số thẻ đã xem, thời gian dừng, có bấm không). */
export const recordCarouselEvent = createServerFn({ method: "POST" })
  .inputValidator((data: CarouselEventInput) => data)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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
      visitor_key: str(data.visitor_key, 64),
    });
    if (error) {
      console.error("record carousel event failed:", error.message);
      return { ok: false };
    }
    return { ok: true };
  });
