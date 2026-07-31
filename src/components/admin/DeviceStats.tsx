import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download, Inbox, Laptop, MonitorSmartphone, Smartphone, Tablet } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AdminSection, EmptyState, ListSkeleton, QueryState } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { screenBucket } from "@/lib/deviceInfo";

const RANGES = [
  { value: "7", label: "7 ngày gần nhất" },
  { value: "30", label: "30 ngày gần nhất" },
  { value: "90", label: "90 ngày gần nhất" },
  { value: "all", label: "Tất cả" },
];

const DEVICE_LABEL: Record<string, string> = {
  mobile: "Điện thoại",
  tablet: "Máy tính bảng",
  desktop: "Máy tính",
};

const DEVICE_ICON: Record<string, typeof Smartphone> = {
  mobile: Smartphone,
  tablet: Tablet,
  desktop: Laptop,
};

const SLICE_COLORS = ["var(--primary)", "var(--accent)", "var(--chart-3, #f59e0b)", "var(--chart-4, #10b981)", "var(--muted-foreground)"];

type Visit = {
  browser: string;
  browser_version: string;
  os: string;
  os_version: string;
  device_type: string;
  screen_w: number;
  screen_h: number;
  viewport_w: number;
  language: string;
  timezone: string;
  is_pwa: boolean;
  is_touch: boolean;
  referrer_host: string;
  visitor_key: string;
  path: string;
  ip: string;
  created_at: string;
};

function tally(rows: Visit[], pick: (r: Visit) => string) {
  const map = new Map<string, { count: number; visitors: Set<string> }>();
  for (const r of rows) {
    const key = pick(r) || "Không rõ";
    const entry = map.get(key) ?? { count: 0, visitors: new Set<string>() };
    entry.count += 1;
    if (r.visitor_key) entry.visitors.add(r.visitor_key);
    map.set(key, entry);
  }
  const total = rows.length || 1;
  return [...map.entries()]
    .map(([name, e]) => ({
      name,
      count: e.count,
      visitors: e.visitors.size,
      percent: Math.round((e.count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count);
}

export function DeviceStats() {
  const [range, setRange] = useState("30");

  const query = useQuery({
    queryKey: ["admin-device-visits", range],
    queryFn: async () => {
      let q = supabase
        .from("device_visits")
        .select(
          "browser, browser_version, os, os_version, device_type, screen_w, screen_h, viewport_w, language, timezone, is_pwa, is_touch, referrer_host, visitor_key, path, ip, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(10000);
      if (range !== "all") {
        const since = new Date(Date.now() - Number(range) * 86400000).toISOString();
        q = q.gte("created_at", since);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Visit[];
    },
  });

  const rows = useMemo(() => query.data ?? [], [query.data]);

  const byBrowser = useMemo(() => tally(rows, (r) => r.browser), [rows]);
  const byOs = useMemo(() => tally(rows, (r) => (r.os_version ? `${r.os} ${r.os_version}` : r.os)), [rows]);
  const byDevice = useMemo(() => tally(rows, (r) => DEVICE_LABEL[r.device_type] ?? r.device_type), [rows]);
  const byScreen = useMemo(() => tally(rows, (r) => screenBucket(r.screen_w, r.screen_h)).slice(0, 10), [rows]);
  const byPath = useMemo(() => tally(rows, (r) => r.path || "/").slice(0, 10), [rows]);
  const byIp = useMemo(() => tally(rows, (r) => r.ip || "Không rõ").slice(0, 20), [rows]);
  const recent = useMemo(() => rows.slice(0, 50), [rows]);

  const trend = useMemo(() => {
    const map = new Map<string, { views: number; visitors: Set<string> }>();
    for (const r of rows) {
      const day = r.created_at.slice(0, 10);
      const entry = map.get(day) ?? { views: 0, visitors: new Set<string>() };
      entry.views += 1;
      if (r.visitor_key) entry.visitors.add(r.visitor_key);
      map.set(day, entry);
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([day, e]) => ({
        day: day.slice(8) + "/" + day.slice(5, 7),
        views: e.views,
        visitors: e.visitors.size,
      }));
  }, [rows]);

  const summary = useMemo(() => {
    const visitors = new Set(rows.map((r) => r.visitor_key).filter(Boolean));
    const pwa = rows.filter((r) => r.is_pwa).length;
    const touch = rows.filter((r) => r.is_touch).length;
    return {
      views: rows.length,
      visitors: visitors.size,
      pwaPercent: rows.length ? Math.round((pwa / rows.length) * 100) : 0,
      touchPercent: rows.length ? Math.round((touch / rows.length) * 100) : 0,
    };
  }, [rows]);

  async function exportExcel() {
    const sheets: [string, { name: string; count: number; visitors: number; percent: number }[]][] = [
      ["TrinhDuyet", byBrowser],
      ["HeDieuHanh", byOs],
      ["LoaiThietBi", byDevice],
      ["ManHinh", byScreen],
      ["TrangTruyCap", byPath],
      ["DiaChiIP", byIp],
    ];
    await downloadXlsx(
      sheets.map(([name, data]) => ({
        name,
        data: [
          ["Giá trị", "Lượt xem", "Phiên", "Tỉ lệ (%)"],
          ...data.map((d) => [d.name, d.count, d.visitors, d.percent]),
        ] as (string | number)[][],
      })),
      "thong-ke-thiet-bi.xlsx",
    );
  }

  return (
    <AdminSection
      title="Thiết bị & trình duyệt"
      description={
        query.isLoading
          ? "Đang tải..."
          : `${summary.views} lượt xem · ${summary.visitors} phiên truy cập`
      }
      toolbar={
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="rounded-full sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGES.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
      actions={
        <Button variant="outline" className="rounded-full" onClick={exportExcel} disabled={!rows.length}>
          <Download className="size-4" /> Xuất Excel
        </Button>
      }
    >
      <QueryState
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        isFetching={query.isFetching}
        onRetry={() => void query.refetch()}
        isEmpty={rows.length === 0}
        skeleton={<ListSkeleton rows={5} height="h-12" />}
        empty={
          <EmptyState
            icon={Inbox}
            title="Chưa có dữ liệu truy cập"
            description="Số liệu sẽ xuất hiện ngay khi có người dùng mở ứng dụng."
          />
        }
      >
        {/* Thẻ tổng quan */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Lượt xem trang", value: summary.views, icon: MonitorSmartphone },
            { label: "Phiên truy cập", value: summary.visitors, icon: MonitorSmartphone },
            { label: "Cài như ứng dụng", value: `${summary.pwaPercent}%`, icon: Smartphone },
            { label: "Màn hình cảm ứng", value: `${summary.touchPercent}%`, icon: Tablet },
          ].map((c) => (
            <div key={c.label} className="card-elevated p-4">
              <c.icon className="size-4 text-accent" />
              <p className="mt-2 font-mono text-2xl font-bold">{c.value}</p>
              <p className="type-eyebrow text-muted-foreground">{c.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="card-elevated p-4">
            <p className="type-eyebrow mb-3 text-muted-foreground">Loại thiết bị</p>
            <div className="h-[clamp(15rem,45dvh,20rem)] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byDevice} dataKey="count" nameKey="name" innerRadius="45%" outerRadius="75%" paddingAngle={2}>
                    {byDevice.map((d, i) => (
                      <Cell key={d.name} fill={SLICE_COLORS[i % SLICE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number, n: string) => [`${v} lượt`, n]}
                    contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card-elevated p-4">
            <p className="type-eyebrow mb-3 text-muted-foreground">Trình duyệt phổ biến</p>
            <div className="h-[clamp(15rem,45dvh,20rem)] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byBrowser.slice(0, 8)} margin={{ left: -20, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v: number) => [`${v} lượt`, "Lượt xem"]}
                    contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)" }}
                  />
                  <Bar dataKey="count" name="Lượt xem" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card-elevated p-4">
            <p className="type-eyebrow mb-3 text-muted-foreground">Hệ điều hành</p>
            <div className="h-[clamp(15rem,45dvh,20rem)] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byOs.slice(0, 8)} layout="vertical" margin={{ left: 12, right: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v: number) => [`${v} lượt`, "Lượt xem"]}
                    contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)" }}
                  />
                  <Bar dataKey="count" name="Lượt xem" fill="var(--accent)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card-elevated p-4">
            <p className="type-eyebrow mb-3 text-muted-foreground">Lượt truy cập theo ngày</p>
            <div className="h-[clamp(15rem,45dvh,20rem)] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ left: -20, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="views" name="Lượt xem" stroke="var(--primary)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="visitors" name="Phiên" stroke="var(--accent)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Bảng chi tiết */}
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {[
            { title: "Chi tiết trình duyệt", data: byBrowser, head: "Trình duyệt" },
            { title: "Chi tiết hệ điều hành", data: byOs, head: "Hệ điều hành" },
            { title: "Độ phân giải màn hình", data: byScreen, head: "Kích thước" },
            { title: "Trang được xem nhiều", data: byPath, head: "Đường dẫn" },
            { title: "Địa chỉ IP truy cập nhiều", data: byIp, head: "Địa chỉ IP" },
          ].map((t) => (
            <div key={t.title} className="card-elevated overflow-x-auto">
              <p className="type-eyebrow px-4 pt-4 text-muted-foreground">{t.title}</p>
              <table className="mt-2 w-full min-w-[420px] text-sm">
                <thead className="bg-secondary text-secondary-foreground">
                  <tr className="text-left">
                    <th className="px-4 py-2 font-semibold">{t.head}</th>
                    <th className="px-4 py-2 font-semibold">Lượt xem</th>
                    <th className="px-4 py-2 font-semibold">Phiên</th>
                    <th className="px-4 py-2 font-semibold">Tỉ lệ</th>
                  </tr>
                </thead>
                <tbody>
                  {t.data.map((d) => (
                    <tr key={d.name} className="border-t border-border transition-colors hover:bg-secondary/40">
                      <td className="max-w-[220px] truncate px-4 py-2 font-medium">{d.name}</td>
                      <td className="px-4 py-2 font-mono text-muted-foreground">{d.count}</td>
                      <td className="px-4 py-2 font-mono text-muted-foreground">{d.visitors}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-16 overflow-hidden rounded-full bg-secondary">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${d.percent}%` }} />
                          </div>
                          <span className="font-mono text-xs">{d.percent}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>

        {/* Lượt truy cập gần nhất kèm địa chỉ IP */}
        <div className="card-elevated mt-4 overflow-x-auto">
          <p className="type-eyebrow px-4 pt-4 text-muted-foreground">Lượt truy cập gần nhất</p>
          <table className="mt-2 w-full min-w-[640px] text-sm">
            <thead className="bg-secondary text-secondary-foreground">
              <tr className="text-left">
                <th className="px-4 py-2 font-semibold">Thời gian</th>
                <th className="px-4 py-2 font-semibold">Địa chỉ IP</th>
                <th className="px-4 py-2 font-semibold">Thiết bị</th>
                <th className="px-4 py-2 font-semibold">Trình duyệt</th>
                <th className="px-4 py-2 font-semibold">Đường dẫn</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r, i) => (
                <tr key={`${r.visitor_key}-${r.created_at}-${i}`} className="border-t border-border transition-colors hover:bg-secondary/40">
                  <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString("vi-VN")}
                  </td>
                  <td className="px-4 py-2 font-mono">{r.ip || "Không rõ"}</td>
                  <td className="px-4 py-2">{DEVICE_LABEL[r.device_type] ?? r.device_type}</td>
                  <td className="px-4 py-2">{[r.browser, r.browser_version].filter(Boolean).join(" ")}</td>
                  <td className="max-w-[220px] truncate px-4 py-2 text-muted-foreground">{r.path || "/"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Tóm tắt nhanh theo loại thiết bị */}
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {byDevice.map((d) => {
            const key = Object.keys(DEVICE_LABEL).find((k) => DEVICE_LABEL[k] === d.name) ?? "desktop";
            const Icon = DEVICE_ICON[key] ?? Laptop;
            return (
              <div key={d.name} className="card-elevated flex items-center gap-3 p-4">
                <Icon className="size-5 text-accent" />
                <div>
                  <p className="font-semibold">{d.name}</p>
                  <p className="type-meta">
                    {d.count} lượt · {d.percent}%
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </QueryState>
    </AdminSection>
  );
}
