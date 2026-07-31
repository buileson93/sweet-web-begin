import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { BarChart3, BellRing, Building2, Database, IdCard, FileQuestion, ListChecks, LogOut, ScrollText, ShieldAlert, ShieldCheck, Trophy } from "lucide-react";

import { QuizManager } from "@/components/admin/QuizManager";
import { QuestionManager } from "@/components/admin/QuestionManager";
import { UnitManager } from "@/components/admin/UnitManager";
import { ResultManager } from "@/components/admin/ResultManager";
import { EmployeeManager } from "@/components/admin/EmployeeManager";
import { EmployeeHistoryManager } from "@/components/admin/EmployeeHistoryManager";
import { ReminderManager } from "@/components/admin/ReminderManager";
import { AuditLogManager } from "@/components/admin/AuditLogManager";
import { RoleManager } from "@/components/admin/RoleManager";
import { BackupManager } from "@/components/admin/BackupManager";
import { SiteHeader } from "@/components/SiteHeader";
import { EmptyState, ErrorState, PageContainer } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useMyRoles } from "@/hooks/useMyRoles";

export const Route = createFileRoute("/_authenticated/quan-tri")({
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
const tabs = [
  { value: "quizzes", label: "Cuộc thi", icon: ListChecks },
  { value: "questions", label: "Ngân hàng câu hỏi", icon: FileQuestion },
  { value: "units", label: "Đơn vị", icon: Building2 },
  { value: "employees", label: "Nhân viên", icon: IdCard, adminOnly: true },
  { value: "results", label: "Kết quả", icon: BarChart3 },
  { value: "history", label: "Thành tích", icon: Trophy },
  { value: "reminders", label: "Nhắc nhở", icon: BellRing },
  { value: "audit", label: "Lịch sử thao tác", icon: ScrollText },
  { value: "accounts", label: "Tài khoản", icon: ShieldCheck, adminOnly: true },
  { value: "backup", label: "Sao lưu", icon: Database, adminOnly: true },
] as const;

function AdminPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
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
            <Tabs defaultValue="quizzes">
              {!canEdit || !canManageSystem ? (
                <p className="mb-4 flex items-center gap-2 rounded-2xl border border-border bg-secondary/50 px-4 py-3 text-sm text-muted-foreground">
                  <ShieldAlert className="size-4 shrink-0 text-accent" />
                  {!canEdit
                    ? "Tài khoản kỹ thuật chỉ có quyền xem dữ liệu và xuất báo cáo. Mọi thay đổi cấu hình cần tài khoản quản trị viên."
                    : "Tài khoản biên soạn đề: được tạo và chỉnh sửa cuộc thi, câu hỏi, đơn vị. Nhân sự, sao lưu và nhập dữ liệu do quản trị viên phụ trách."}
                </p>
              ) : null}
              <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-2xl p-1">
                {tabs
                  .filter((t) => canManageSystem || !("adminOnly" in t && t.adminOnly))
                  .map((t) => (
                    <TabsTrigger key={t.value} value={t.value} className="rounded-xl px-4 py-2">
                      <t.icon className="size-4" /> {t.label}
                    </TabsTrigger>
                  ))}
              </TabsList>

              <TabsContent value="quizzes" className="mt-6">
                <QuizManager canEdit={canEdit} />
              </TabsContent>
              <TabsContent value="questions" className="mt-6">
                <QuestionManager canEdit={canEdit} />
              </TabsContent>
              <TabsContent value="units" className="mt-6">
                <UnitManager canEdit={canEdit} />
              </TabsContent>
              <TabsContent value="employees" className="mt-6">
                <EmployeeManager canEdit={canManageSystem} />
              </TabsContent>
              <TabsContent value="results" className="mt-6">
                <ResultManager canEdit={canEdit} />
              </TabsContent>
              <TabsContent value="history" className="mt-6">
                <EmployeeHistoryManager />
              </TabsContent>
              <TabsContent value="reminders" className="mt-6">
                <ReminderManager />
              </TabsContent>
              <TabsContent value="audit" className="mt-6">
                <AuditLogManager />
              </TabsContent>
              {canManageSystem ? (
                <TabsContent value="accounts" className="mt-6">
                  <RoleManager />
                </TabsContent>
              ) : null}
              <TabsContent value="backup" className="mt-6">
                <BackupManager />
              </TabsContent>

            </Tabs>
          )}
        </PageContainer>
      </main>
    </div>
  );
}
