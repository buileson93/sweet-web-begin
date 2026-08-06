import { useQuery } from "@tanstack/react-query";
import { downloadXlsx } from "@/lib/xlsxIo";
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
import { DataGrid } from "@/components/admin/DataGrid";
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
  device_model: string;
  platform_version: string;
  architecture: string;
  cpu_cores: number;
  memory_gb: number;
  network_type: string;
  downlink: number;
  save_data: boolean;
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
  user_agent: string;
  created_at: string;
  employee_name: string | null;
  employee_unit: string | null;
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
      const COLUMNS =
        "browser, browser_version, os, os_version, device_type, device_model, platform_version, architecture, cpu_cores, memory_gb, network_type, downlink, save_data, screen_w, screen_h, viewport_w, language, timezone, is_pwa, is_touch, referrer_host, visitor_key, path, ip, user_agent, created_at, employee_name, employee_unit";
      const PAGE = 1000;
      const MAX = 10000; // Giới hạn 10k bản ghi thay vì 50k để đảm bảo hiệu năng trình duyệt
      const since = range === "all" ? null : new Date(Date.now() - Number(range) * 86400000).toISOString();
      const all: Visit[] = [];
      // PostgREST giới hạn mỗi lần trả tối đa 1000 dòng nên phải lấy theo trang.
      for (let from = 0; from < MAX; from += PAGE) {
        let q = supabase
          .from("device_visits")
          .select(COLUMNS)
          .order("created_at", { ascending: false })
          .range(from, from + PAGE - 1);
        if (since) q = q.gte("created_at", since);
        const { data, error } = await q;
        if (error) throw error;
        const page = (data ?? []) as Visit[];
        all.push(...page);
        if (page.length < PAGE) break;
      }
      return all;
    },
  });


  const rows = useMemo(() => query.data ?? [], [query.data]);

  const byBrowser = useMemo(() => tally(rows, (r) => r.browser), [rows]);
  const byOs = useMemo(() => tally(rows, (r) => (r.os_version ? `${r.os} ${r.os_version}` : r.os)), [rows]);
  const byDevice = useMemo(() => tally(rows, (r) => DEVICE_LABEL[r.device_type] ?? r.device_type), [rows]);
  const byModel = useMemo(() => tally(rows, (r) => r.device_model || "Không rõ"), [rows]);
  const byScreen = useMemo(() => tally(rows, (r) => screenBucket(r.screen_w, r.screen_h)), [rows]);
  const byPath = useMemo(() => tally(rows, (r) => r.path || "/"), [rows]);
  // Chỉ liệt kê lượt truy cập có định danh; khách vãng lai gom vào bảng khác.
  const byEmployee = useMemo(
    () => tally(rows.filter((r) => r.employee_name), (r) => r.employee_name || ""),
    [rows],
  );
  const byIp = useMemo(() => tally(rows, (r) => r.ip || "Không rõ"), [rows]);
  const byNetwork = useMemo(() => tally(rows, (r) => r.network_type || "Không rõ"), [rows]);
  const recent = useMemo(() => rows.slice(0, 500), [rows]);

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
      ["KieuMay", byModel],
      ["TrinhDuyet", byBrowser],
      ["HeDieuHanh", byOs],
      ["LoaiThietBi", byDevice],
      ["ManHinh", byScreen],
      ["MangKetNoi", byNetwork],
      ["TrangTruyCap", byPath],
      ["DiaChiIP", byIp],
    ];
    await downloadXlsx(
      [
        ...sheets.map(([name, data]) => ({
          name,
          data: [
            ["Giá trị", "Lượt xem", "Phiên", "Tỉ lệ (%)"],
            ...data.map((d) => [d.name, d.count, d.visitors, d.percent]),
          ] as (string | number)[][],
        })),
        {
          name: "ChiTietLuotTruyCap",
          data: [
            [
              "Thời gian",
              "Kiểu máy",
              "Loại thiết bị",
              "Hệ điều hành",
              "Trình duyệt",
              "CPU (lõi)",
              "RAM (GB)",
              "Mạng",
              "Màn hình",
              "Địa chỉ IP",
              "Đường dẫn",
              "User agent",
            ],
            ...recent.map((r) => [
              new Date(r.created_at).toLocaleString("vi-VN"),
              r.device_model || "Không rõ",
              DEVICE_LABEL[r.device_type] ?? r.device_type,
              [r.os, r.os_version].filter(Boolean).join(" "),
              [r.browser, r.browser_version].filter(Boolean).join(" "),
              r.cpu_cores || 0,
              r.memory_gb || 0,
              r.network_type || "",
              screenBucket(r.screen_w, r.screen_h),
              r.ip || "",
              r.path || "/",
              r.user_agent || "",
            ]),
          ] as (string | number)[][],
        },
      ],
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

        {/* Bảng chi tiết kiểu Airtable: lọc từng cột, sắp xếp, phân trang */}
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {[
            { title: "Kiểu máy thiết bị", data: byModel, head: "Kiểu máy" },
            { title: "Chi tiết trình duyệt", data: byBrowser, head: "Trình duyệt" },
            { title: "Chi tiết hệ điều hành", data: byOs, head: "Hệ điều hành" },
            { title: "Độ phân giải màn hình", data: byScreen, head: "Kích thước" },
            { title: "Mạng kết nối", data: byNetwork, head: "Loại mạng" },
            { title: "Người dùng đã đăng nhập", data: byEmployee, head: "Người dùng" },
            { title: "Trang được xem nhiều", data: byPath, head: "Đường dẫn" },
            { title: "Địa chỉ IP truy cập nhiều", data: byIp, head: "Địa chỉ IP" },
          ].map((t) => (
            <DataGrid
              key={t.title}
              title={t.title}
              data={t.data}
              minWidth="30rem"
              pageSize={10}
              columns={[
                { key: "name", header: t.head, value: (d) => d.name, className: "font-medium" },
                { key: "count", header: "Lượt xem", value: (d) => d.count, align: "right", filter: "none" },
                { key: "visitors", header: "Phiên", value: (d) => d.visitors, align: "right", filter: "none" },
                {
                  key: "percent",
                  header: "Tỉ lệ",
                  value: (d) => d.percent,
                  filter: "none",
                  render: (d) => (
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-16 overflow-hidden rounded-full bg-secondary">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${d.percent}%` }} />
                      </div>
                      <span className="font-mono text-xs">{d.percent}%</span>
                    </div>
                  ),
                },
              ]}
            />
          ))}
        </div>

        {/* Nhật ký truy cập đầy đủ thông tin thiết bị */}
        <div className="mt-4">
          <DataGrid
            title="Nhật ký truy cập chi tiết"
            description="Lọc theo kiểu máy, hệ điều hành, IP..."
            data={recent}
            minWidth="72rem"
            pageSize={25}
            columns={[
              {
                key: "created_at",
                header: "Thời gian",
                value: (r) => r.created_at,
                render: (r) => (
                  <span className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString("vi-VN")}
                  </span>
                ),
              },
              {
                key: "employee",
                header: "Người dùng",
                value: (r) => r.employee_name || "Khách chưa đăng nhập",
                filter: "select",
                className: "font-medium",
              },
              {
                key: "employee_unit",
                header: "Đơn vị",
                value: (r) => r.employee_unit || "—",
                filter: "select",
              },
              { key: "device_model", header: "Kiểu máy", value: (r) => r.device_model || "Không rõ", filter: "select" },
              {
                key: "device_type",
                header: "Loại",
                value: (r) => DEVICE_LABEL[r.device_type] ?? r.device_type,
                filter: "select",
              },
              {
                key: "os",
                header: "Hệ điều hành",
                value: (r) => [r.os, r.os_version].filter(Boolean).join(" "),
                filter: "select",
              },
              {
                key: "browser",
                header: "Trình duyệt",
                value: (r) => [r.browser, r.browser_version].filter(Boolean).join(" "),
              },
              { key: "cpu", header: "CPU", value: (r) => r.cpu_cores || 0, align: "right", filter: "none" },
              { key: "ram", header: "RAM (GB)", value: (r) => r.memory_gb || 0, align: "right", filter: "none" },
              { key: "network", header: "Mạng", value: (r) => r.network_type || "—", filter: "select" },
              { key: "screen", header: "Màn hình", value: (r) => screenBucket(r.screen_w, r.screen_h) },
              { key: "ip", header: "Địa chỉ IP", value: (r) => r.ip || "Không rõ", className: "font-mono text-xs" },
              {
                key: "path",
                header: "Đường dẫn",
                value: (r) => r.path || "/",
                className: "max-w-[220px] truncate text-muted-foreground",
              },
            ]}
          />
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
