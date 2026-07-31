import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  BellRing,
  Building2,
  Command as CommandIcon,
  Database,
  IdCard,
  FileQuestion,
  ListChecks,
  LogOut,
  MonitorSmartphone,
  PieChart,
  RadioTower,
  ScrollText,
  ShieldAlert,

  ShieldCheck,
  Trophy,
} from "lucide-react";

import { QuizManager } from "@/components/admin/QuizManager";
import { QuestionManager } from "@/components/admin/QuestionManager";
import { ImageStorageStats } from "@/components/admin/ImageStorageStats";
import { UnitManager } from "@/components/admin/UnitManager";
import { ResultManager } from "@/components/admin/ResultManager";
import { EmployeeManager } from "@/components/admin/EmployeeManager";
import { EmployeeHistoryManager } from "@/components/admin/EmployeeHistoryManager";
import { ReminderManager } from "@/components/admin/ReminderManager";
import { AuditLogManager } from "@/components/admin/AuditLogManager";
import { RoleManager } from "@/components/admin/RoleManager";
import { BackupManager } from "@/components/admin/BackupManager";
import { LiveMonitor } from "@/components/admin/LiveMonitor";
import { UnitStats } from "@/components/admin/UnitStats";
import { DeviceStats } from "@/components/admin/DeviceStats";

import { SiteHeader } from "@/components/SiteHeader";
import { EmptyState, ErrorState, PageContainer } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useMyRoles } from "@/hooks/useMyRoles";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/quan-tri")({
  validateSearch: (search: Record<string, unknown>): { muc?: string } =>
    typeof search.muc === "string" ? { muc: search.muc } : {},
  head: () => ({
    meta: [
      { title: "Bảng điều khiển quản trị | Hội thi trắc nghiệm" },
      { name: "description", content: "Quản lý cuộc thi, ngân hàng câu hỏi, đơn vị và kết quả thi trắc nghiệm." },
      { property: "og:title", content: "Bảng điều khiển quản trị" },
      { property: "og:description", content: "Quản lý cuộc thi, câu hỏi, đơn vị và kết quả." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

/** adminOnly: chỉ quản trị viên hệ thống mới thấy (biên soạn đề không được vào). */
type Section = {
  value: string;
  label: string;
  hint: string;
  icon: typeof ListChecks;
  adminOnly?: boolean;
};

const GROUPS: { group: string; items: Section[] }[] = [
  {
    group: "Nội dung",
    items: [
      { value: "quizzes", label: "Cuộc thi", hint: "Tạo, mở/đóng phòng thi", icon: ListChecks },
      { value: "questions", label: "Ngân hàng câu hỏi", hint: "Soạn và nhập câu hỏi", icon: FileQuestion },
      { value: "units", label: "Đơn vị", hint: "Danh mục đơn vị dự thi", icon: Building2 },
    ],
  },
  {
    group: "Thí sinh",
    items: [
      { value: "employees", label: "Nhân viên", hint: "Danh sách nhân sự", icon: IdCard, adminOnly: true },
      { value: "reminders", label: "Nhắc nhở", hint: "Ai chưa hoàn thành bài thi", icon: BellRing },
    ],
  },
  {
    group: "Báo cáo",
    items: [
      { value: "live", label: "Theo dõi trực tiếp", hint: "Ai đang làm bài ngay lúc này", icon: RadioTower },
      { value: "results", label: "Kết quả", hint: "Bài thi đã nộp", icon: BarChart3 },
      { value: "unit-stats", label: "Thống kê đơn vị", hint: "Điểm trung bình, tỉ lệ đạt", icon: PieChart },
      { value: "devices", label: "Thiết bị & trình duyệt", hint: "Người dùng vào bằng máy gì", icon: MonitorSmartphone },
      { value: "history", label: "Thành tích", hint: "Lịch sử theo nhân viên", icon: Trophy },
      { value: "audit", label: "Lịch sử thao tác", hint: "Nhật ký quản trị", icon: ScrollText },
    ],
  },

  {
    group: "Hệ thống",
    items: [
      { value: "accounts", label: "Tài khoản", hint: "Phân quyền người dùng", icon: ShieldCheck, adminOnly: true },
      { value: "backup", label: "Sao lưu", hint: "Xuất/nhập dữ liệu", icon: Database, adminOnly: true },
    ],
  },
];

const ALL_SECTIONS = GROUPS.flatMap((g) => g.items);

function AdminPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [email, setEmail] = useState<string>("");
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  // Ctrl/Cmd + K: mở bảng tìm kiếm nhanh các mục quản trị.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const roleQuery = useMyRoles();

  const statsQuery = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [quizzes, questions, results] = await Promise.all([
        supabase.from("quizzes").select("id", { count: "exact", head: true }),
        supabase.from("questions").select("id", { count: "exact", head: true }),
        supabase.from("results").select("id", { count: "exact", head: true }),
      ]);
      return {
        quizzes: quizzes.count ?? 0,
        questions: questions.count ?? 0,
        results: results.count ?? 0,
      };
    },
  });

  const { canAccessAdmin, canEdit, canManageSystem, roleLabel } = roleQuery;

  const visibleGroups = useMemo(
    () =>
      GROUPS.map((g) => ({
        ...g,
        items: g.items.filter((i) => canManageSystem || !i.adminOnly),
      })).filter((g) => g.items.length > 0),
    [canManageSystem],
  );

  const visibleValues = visibleGroups.flatMap((g) => g.items.map((i) => i.value));
  const current =
    search.muc && visibleValues.includes(search.muc) ? search.muc : (visibleValues[0] ?? "quizzes");
  const currentSection = ALL_SECTIONS.find((s) => s.value === current);

  function goTo(value: string) {
    void navigate({ to: "/quan-tri", search: { muc: value } });
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="surface-hero">
        <PageContainer className="flex flex-wrap items-end justify-between gap-6 py-10">
          <div className="min-w-0">
            <h1 className="type-h1">Bảng điều khiển</h1>
            <p className="type-muted mt-1 truncate text-primary-foreground/75">{email}</p>
            <p className="type-meta mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/12 px-3 py-1 text-primary-foreground/85">
              <ShieldCheck className="size-3.5" /> {roleLabel}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-6">
            {[
              { label: "Cuộc thi", value: statsQuery.data?.quizzes, icon: ListChecks },
              { label: "Câu hỏi", value: statsQuery.data?.questions, icon: FileQuestion },
              { label: "Lượt thi", value: statsQuery.data?.results, icon: BarChart3 },
            ].map((s) => (
              <div key={s.label} className="text-right">
                <s.icon className="ml-auto size-4 text-accent" />
                <p className="mt-1 font-mono text-2xl font-bold">
                  {statsQuery.isLoading ? "…" : (s.value ?? "—")}
                </p>
                <p className="type-eyebrow text-primary-foreground/70">{s.label}</p>
              </div>
            ))}
            {canManageSystem ? (
              <Button variant="secondary" className="rounded-full" onClick={() => navigate({ to: "/nhap-du-lieu" })}>
                <Database className="size-4" />
                Nhập dữ liệu
              </Button>
            ) : null}
            <Button variant="secondary" className="rounded-full" onClick={signOut}>
              <LogOut className="size-4" />
              Đăng xuất
            </Button>
          </div>
        </PageContainer>
      </div>

      <main>
        <PageContainer className="py-8">
          {roleQuery.isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-12 w-full max-w-xl rounded-2xl" />
              <Skeleton className="h-96 w-full rounded-2xl" />
            </div>
          ) : roleQuery.isError ? (
            <ErrorState
              title="Không kiểm tra được quyền truy cập"
              error={roleQuery.error}
              onRetry={() => void roleQuery.refetch()}
              retrying={roleQuery.isFetching}
            />
          ) : !canAccessAdmin ? (
            <EmptyState
              icon={ShieldAlert}
              title="Tài khoản chưa có quyền quản trị"
              description={`Vui lòng liên hệ quản trị viên hệ thống để được cấp quyền cho tài khoản ${email}.`}
            />
          ) : (
            <div className="grid gap-6 lg:grid-cols-[248px_minmax(0,1fr)] lg:items-start">
              {/* Điều hướng: cột dọc trên máy tính, thanh cuộn ngang trên điện thoại */}
              <nav aria-label="Mục quản trị" className="lg:sticky lg:top-4">
                <Button
                  variant="outline"
                  className="mb-3 hidden w-full justify-between rounded-2xl lg:flex"
                  onClick={() => setPaletteOpen(true)}
                >
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <CommandIcon className="size-4" /> Tìm nhanh…
                  </span>
                  <kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    Ctrl K
                  </kbd>
                </Button>

                <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-2 lg:mx-0 lg:block lg:space-y-4 lg:overflow-visible lg:px-0 lg:pb-0">
                  {visibleGroups.map((g) => (
                    <div key={g.group} className="flex shrink-0 gap-1 lg:block lg:space-y-1">
                      <p className="type-eyebrow hidden px-3 text-muted-foreground lg:block">{g.group}</p>
                      {g.items.map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => goTo(item.value)}
                          aria-current={current === item.value ? "page" : undefined}
                          className={cn(
                            "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition-colors lg:w-full",
                            current === item.value
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                          )}
                        >
                          <item.icon className="size-4 shrink-0" />
                          {item.label}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </nav>

              <div className="min-w-0">
                <p className="type-meta mb-3 text-muted-foreground">
                  Quản trị <span className="mx-1">/</span>
                  <span className="text-foreground">{currentSection?.label}</span>
                  {currentSection?.hint ? <span className="ml-2">— {currentSection.hint}</span> : null}
                </p>

                {!canEdit || !canManageSystem ? (
                  <p className="mb-4 flex items-center gap-2 rounded-2xl border border-border bg-secondary/50 px-4 py-3 text-sm text-muted-foreground">
                    <ShieldAlert className="size-4 shrink-0 text-accent" />
                    {!canEdit
                      ? "Tài khoản kỹ thuật chỉ có quyền xem dữ liệu và xuất báo cáo. Mọi thay đổi cấu hình cần tài khoản quản trị viên."
                      : "Tài khoản biên soạn đề: được tạo và chỉnh sửa cuộc thi, câu hỏi, đơn vị. Nhân sự, sao lưu và nhập dữ liệu do quản trị viên phụ trách."}
                  </p>
                ) : null}

                {current === "quizzes" && <QuizManager canEdit={canEdit} />}
                {current === "questions" && (
                  <>
                    <ImageStorageStats canClean={canManageSystem} />
                    <QuestionManager canEdit={canEdit} />
                  </>
                )}
                {current === "units" && <UnitManager canEdit={canEdit} />}
                {current === "employees" && <EmployeeManager canEdit={canManageSystem} />}
                {current === "live" && <LiveMonitor />}
                {current === "results" && <ResultManager canEdit={canEdit} />}
                {current === "unit-stats" && <UnitStats />}
                {current === "devices" && <DeviceStats />}

                {current === "history" && <EmployeeHistoryManager />}
                {current === "reminders" && <ReminderManager />}
                {current === "audit" && <AuditLogManager />}
                {current === "accounts" && canManageSystem && <RoleManager />}
                {current === "backup" && canManageSystem && <BackupManager />}
              </div>
            </div>
          )}
        </PageContainer>
      </main>

      <CommandDialog open={paletteOpen} onOpenChange={setPaletteOpen}>
        <CommandInput placeholder="Tìm mục quản trị…" />
        <CommandList>
          <CommandEmpty>Không có mục nào phù hợp.</CommandEmpty>
          {visibleGroups.map((g) => (
            <CommandGroup key={g.group} heading={g.group}>
              {g.items.map((item) => (
                <CommandItem
                  key={item.value}
                  value={`${item.label} ${item.hint}`}
                  onSelect={() => {
                    setPaletteOpen(false);
                    goTo(item.value);
                  }}
                >
                  <item.icon className="size-4" />
                  <span>{item.label}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{item.hint}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </div>
  );
}
