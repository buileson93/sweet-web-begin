import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ScrollText, ShieldAlert } from "lucide-react";

import { AuditLogManager } from "@/components/admin/AuditLogManager";
import { SiteHeader } from "@/components/SiteHeader";
import { EmptyState, ErrorState, PageContainer, PageHero } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyRoles } from "@/hooks/useMyRoles";

export const Route = createFileRoute("/_authenticated/nhat-ky")({
  head: () => ({
    meta: [
      { title: "Nhật ký thao tác quản trị | Hội thi trắc nghiệm" },
      {
        name: "description",
        content: "Lịch sử tạo, sửa, xoá cuộc thi, câu hỏi, đơn vị và kết quả, có bộ lọc theo người dùng và thời gian.",
      },
      { property: "og:title", content: "Nhật ký thao tác quản trị" },
      { property: "og:description", content: "Theo dõi mọi thay đổi trong khu quản trị theo người dùng và thời gian." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuditPage,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <ErrorState error={error} />
    </div>
  ),
});

function AuditPage() {
  const { canAccessAdmin, isLoading, isError, error, refetch, isFetching } = useMyRoles();

  return (
    <div className="min-h-screen bg-background">
      <div className="surface-hero pb-14">
        <SiteHeader variant="onDark" />
        <PageHero
          icon={ScrollText}
          title="Nhật ký thao tác"
          description="Toàn bộ thay đổi trong khu quản trị được ghi lại kèm người thực hiện và thời điểm."
        />
      </div>

      <PageContainer className="py-8">
        <Button asChild variant="ghost" className="mb-4 rounded-full">
          <Link to="/quan-tri">
            <ArrowLeft className="size-4" /> Về bảng điều khiển
          </Link>
        </Button>

        {isLoading ? (
          <Skeleton className="h-96 w-full rounded-2xl" />
        ) : isError ? (
          <ErrorState
            title="Không kiểm tra được quyền truy cập"
            error={error}
            onRetry={() => void refetch()}
            retrying={isFetching}
          />
        ) : !canAccessAdmin ? (
          <EmptyState
            icon={ShieldAlert}
            title="Không có quyền xem nhật ký"
            description="Chỉ quản trị viên và tài khoản kỹ thuật mới xem được lịch sử thao tác."
          />
        ) : (
          <AuditLogManager />
        )}
      </PageContainer>
    </div>
  );
}
