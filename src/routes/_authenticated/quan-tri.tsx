import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  BellRing,
  Building2,
  Command as CommandIcon,
  Database,
  Images,

  IdCard,
  FileQuestion,
  ListChecks,
  LogOut,
  MonitorSmartphone,
  MousePointerClick,
  PanelLeftClose,
  PanelLeftOpen,
  PieChart,

  RadioTower,
  ScrollText,
  ShieldAlert,
  Bug,

  ShieldCheck,
  Trophy,
} from "lucide-react";

import { QuizManager } from "@/components/admin/QuizManager";
import { QuestionManager } from "@/components/admin/QuestionManager";
import { ImageStorageStats } from "@/components/admin/ImageStorageStats";
import { UnitManager } from "@/components/admin/UnitManager";
import { AssetLibrary } from "@/components/admin/AssetLibrary";

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
import { TopicReport } from "@/components/admin/TopicReport";
import { BugReportManager } from "@/components/admin/BugReportManager";
import { CarouselStats } from "@/components/admin/CarouselStats";

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
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <ErrorState error={error} />
    </div>
  ),
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
      { value: "assets", label: "Kho ảnh", hint: "Thư viện ảnh bìa dùng chung", icon: Images },

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
      { value: "carousel", label: "Hành vi vuốt thẻ", hint: "Tối ưu bố cục trang chủ", icon: MousePointerClick, adminOnly: true },
      { value: "history", label: "Thành tích", hint: "Lịch sử theo nhân viên", icon: Trophy },
      { value: "audit", label: "Lịch sử thao tác", hint: "Nhật ký quản trị", icon: ScrollText },
      { value: "bugs", label: "Báo lỗi & góp ý", hint: "Phản hồi từ người dùng", icon: Bug, adminOnly: true },
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
      {/* Thanh tiêu đề gọn: nhường tối đa diện tích cho vùng làm việc */}
      <div className="surface-hero">
        <PageContainer className="!max-w-[110rem] grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 !pb-3 pt-4 sm:flex sm:flex-wrap sm:justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold sm:text-xl">Bảng điều khiển</h1>
            <p className="type-meta mt-0.5 flex min-w-0 items-center gap-1.5 text-primary-foreground/75">
              <ShieldCheck className="size-3.5 shrink-0" />
              <span className="truncate">
                {roleLabel} · {email}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <div className="hidden items-center gap-4 sm:flex">
              {[
                { label: "Cuộc thi", value: statsQuery.data?.quizzes, icon: ListChecks },
                { label: "Câu hỏi", value: statsQuery.data?.questions, icon: FileQuestion },
                { label: "Lượt thi", value: statsQuery.data?.results, icon: BarChart3 },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-2">
                  <s.icon className="size-4 shrink-0 text-accent" />
                  <span className="font-mono text-base font-bold">
                    {statsQuery.isLoading ? "…" : (s.value ?? "—")}
                  </span>
                  <span className="type-eyebrow text-primary-foreground/70">{s.label}</span>
                </div>
              ))}
            </div>
            {canManageSystem ? (
              <Button
                size="sm"
                variant="secondary"
                className="rounded-full"
                onClick={() => navigate({ to: "/nhap-du-lieu" })}
              >
                <Database className="size-4" />
                <span className="hidden sm:inline">Nhập dữ liệu</span>
              </Button>
            ) : null}
            <Button size="sm" variant="secondary" className="rounded-full" onClick={signOut}>
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Đăng xuất</span>
            </Button>
          </div>
        </PageContainer>
      </div>

      <main>
        <PageContainer className="!max-w-[110rem] py-5">
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
            <div
              className={cn(
                "grid gap-5 lg:items-start",
                railCollapsed
                  ? "lg:grid-cols-[64px_minmax(0,1fr)]"
                  : "lg:grid-cols-[232px_minmax(0,1fr)]",
              )}
            >
              {/* Điều hướng: cột dọc thu gọn được trên máy tính, thanh cuộn ngang trên điện thoại */}
              <nav aria-label="Mục quản trị" className="lg:sticky lg:top-4">
                <div className="mb-3 hidden gap-1 lg:flex">
                  <Button
                    variant="outline"
                    className={cn("min-w-0 flex-1 justify-between rounded-2xl", railCollapsed && "px-0 justify-center")}
                    onClick={() => setPaletteOpen(true)}
                    title="Tìm nhanh (Ctrl K)"
                  >
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <CommandIcon className="size-4" />
                      {railCollapsed ? null : "Tìm nhanh…"}
                    </span>
                    {railCollapsed ? null : (
                      <kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                        Ctrl K
                      </kbd>
                    )}
                  </Button>
                  {railCollapsed ? null : (
                    <Button
                      variant="outline"
                      size="icon"
                      className="rounded-2xl"
                      aria-label="Thu gọn danh mục"
                      onClick={() => setRailCollapsed(true)}
                    >
                      <PanelLeftClose className="size-4" />
                    </Button>
                  )}
                </div>
                {railCollapsed ? (
                  <Button
                    variant="outline"
                    size="icon"
                    className="mb-3 hidden rounded-2xl lg:flex"
                    aria-label="Mở rộng danh mục"
                    onClick={() => setRailCollapsed(false)}
                  >
                    <PanelLeftOpen className="size-4" />
                  </Button>
                ) : null}

                <div className="snap-row snap-row-soft -mx-1 flex gap-1 px-1 pb-2 lg:mx-0 lg:block lg:space-y-3 lg:overflow-visible lg:px-0 lg:pb-0">
                  {visibleGroups.map((g) => (
                    <div key={g.group} className="flex shrink-0 gap-1 lg:block lg:space-y-1">
                      {railCollapsed ? null : (
                        <p className="type-eyebrow hidden px-3 text-muted-foreground lg:block">{g.group}</p>
                      )}
                      {g.items.map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => goTo(item.value)}
                          aria-current={current === item.value ? "page" : undefined}
                          title={`${item.label} — ${item.hint}`}
                          className={cn(
                            "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition-colors lg:w-full",
                            railCollapsed && "lg:justify-center lg:px-0",
                            current === item.value
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                          )}
                        >
                          <item.icon className="size-4 shrink-0" />
                          <span className={cn(railCollapsed && "lg:hidden")}>{item.label}</span>
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
                {current === "assets" && <AssetLibrary canEdit={canEdit} />}

                {current === "employees" && <EmployeeManager canEdit={canManageSystem} />}
                {current === "live" && <LiveMonitor />}
                {current === "results" && <ResultManager canEdit={canEdit} />}
                {current === "unit-stats" && (
                  <div className="space-y-6">
                    <UnitStats />
                    <TopicReport />
                  </div>
                )}
                {current === "devices" && <DeviceStats />}
                {current === "carousel" && canManageSystem && <CarouselStats />}

                {current === "history" && <EmployeeHistoryManager />}
                {current === "reminders" && <ReminderManager />}
                {current === "audit" && <AuditLogManager />}
                {current === "bugs" && canManageSystem && <BugReportManager />}
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
