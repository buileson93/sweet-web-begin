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
  card_labels: string[] | null;
  clicked_label: string | null;
};

/** Thống kê hành vi vuốt dải thẻ ngang (trang chủ) để tinh chỉnh bố cục. */
export function CarouselStats() {
  const query = useQuery({
    queryKey: ["carousel-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("carousel_events")
        .select(
          "label, path, total_cards, viewed_cards, max_index, swipes, dwell_ms, clicked, clicked_index, device_type, created_at, card_labels, clicked_label",
        )
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

  // Tên thẻ phổ biến nhất ở từng vị trí, để biểu đồ hiện đúng tên cuộc thi.
  const maxCards = rows.reduce((m, r) => Math.max(m, r.total_cards), 0);
  const nameAt = (i: number) => {
    const tally = new Map<string, number>();
    rows.forEach((r) => {
      const name = r.card_labels?.[i];
      if (name) tally.set(name, (tally.get(name) ?? 0) + 1);
    });
    const best = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    return best ? `${i + 1}. ${best}` : `Thẻ ${i + 1}`;
  };

  const reach = Array.from({ length: Math.min(maxCards, 10) }, (_, i) => ({
    name: nameAt(i),
    "Đã xem (%)": total ? Math.round((rows.filter((r) => r.max_index >= i).length / total) * 100) : 0,
    "Đã bấm": rows.filter((r) => r.clicked && r.clicked_index === i).length,
  }));

  // Xếp hạng thẻ được bấm nhiều nhất theo tên (không phụ thuộc vị trí).
  const clickedTally = new Map<string, number>();
  rows.forEach((r) => {
    if (!r.clicked) return;
    const name = r.clicked_label || r.card_labels?.[r.clicked_index] || `Thẻ ${r.clicked_index + 1}`;
    clickedTally.set(name, (clickedTally.get(name) ?? 0) + 1);
  });
  const topClicked = [...clickedTally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);


  return (
    <AdminSection title="Hành vi vuốt dải thẻ" description="Người dùng đi qua bao nhiêu thẻ, dừng bao lâu và bấm vào thẻ nào.">
      <QueryState
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        isFetching={query.isFetching}
        onRetry={() => void query.refetch()}
        isEmpty={total === 0}
        skeleton={<ListSkeleton rows={4} />}
        empty={
          <EmptyState
            icon={LayoutGrid}
            title="Chưa có dữ liệu"
            description="Số liệu sẽ xuất hiện khi người dùng vuốt dải thẻ ở trang chủ."
          />
        }
      >
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
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} height={64} angle={-18} textAnchor="end" />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="Đã xem (%)" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Đã bấm" fill="var(--accent)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {topClicked.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-3">
                <p className="mb-2 text-sm font-semibold">Thẻ được bấm nhiều nhất</p>
                <ul className="space-y-1.5">
                  {topClicked.map(([name, n]) => (
                    <li key={name} className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate">{name}</span>
                      <span className="shrink-0 font-bold text-primary">{n} lượt</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Dựa trên {total} lượt tương tác gần nhất. Mỗi người chỉ được ghi tối đa 40 lượt/giờ và dữ liệu tự xoá sau 90 ngày để tránh phình cơ sở dữ liệu.
            </p>

          </div>


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
