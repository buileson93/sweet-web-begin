import { useQuery } from "@tanstack/react-query";
import { MousePointerClick, Timer, LayoutGrid } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AdminSection, EmptyState, ListSkeleton, QueryState } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";

type Row = {
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
  created_at: string;
};

/** Thống kê hành vi vuốt dải thẻ ngang (trang chủ) để tinh chỉnh bố cục. */
export function CarouselStats() {
  const query = useQuery({
    queryKey: ["carousel-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("carousel_events")
        .select("label, path, total_cards, viewed_cards, max_index, swipes, dwell_ms, clicked, clicked_index, device_type, created_at")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
    staleTime: 60_000,
  });

  const rows = query.data ?? [];
  const total = rows.length;
  const avgViewed = total ? rows.reduce((s, r) => s + r.viewed_cards, 0) / total : 0;
  const avgDwell = total ? rows.reduce((s, r) => s + r.dwell_ms, 0) / total : 0;
  const clickRate = total ? (rows.filter((r) => r.clicked).length / total) * 100 : 0;

  // Tỉ lệ người xem tới từng vị trí thẻ
  const maxCards = rows.reduce((m, r) => Math.max(m, r.total_cards), 0);
  const reach = Array.from({ length: Math.min(maxCards, 10) }, (_, i) => ({
    name: `Thẻ ${i + 1}`,
    "Đã xem (%)": total ? Math.round((rows.filter((r) => r.max_index >= i).length / total) * 100) : 0,
    "Đã bấm": rows.filter((r) => r.clicked && r.clicked_index === i).length,
  }));

  return (
    <AdminSection title="Hành vi vuốt dải thẻ" description="Người dùng đi qua bao nhiêu thẻ, dừng bao lâu và bấm vào thẻ nào.">
      <QueryState query={query} loading={<ListSkeleton rows={4} />}>
        {total === 0 ? (
          <EmptyState icon={LayoutGrid} title="Chưa có dữ liệu" description="Số liệu sẽ xuất hiện khi người dùng vuốt dải thẻ ở trang chủ." />
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <StatTile icon={LayoutGrid} label="Số thẻ xem trung bình" value={`${avgViewed.toFixed(1)} / ${maxCards}`} />
              <StatTile icon={Timer} label="Thời gian dừng trung bình" value={`${(avgDwell / 1000).toFixed(1)} giây`} />
              <StatTile icon={MousePointerClick} label="Tỉ lệ bấm vào thẻ" value={`${clickRate.toFixed(1)}%`} />
            </div>

            <div className="h-64 w-full rounded-2xl border border-border bg-card p-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={reach}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="Đã xem (%)" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Đã bấm" fill="var(--accent)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <p className="text-xs text-muted-foreground">
              Dựa trên {total} lượt tương tác gần nhất. Nếu tỉ lệ xem tới thẻ 3–4 quá thấp, nên rút ngắn danh sách hoặc đưa cuộc thi quan trọng lên đầu.
            </p>
          </div>
        )}
      </QueryState>
    </AdminSection>
  );
}

function StatTile({ icon: Icon, label, value }: { icon: typeof Timer; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-lg font-bold">{value}</p>
      </div>
    </div>
  );
}
