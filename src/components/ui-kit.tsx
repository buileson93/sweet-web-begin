import type { ComponentType, ReactNode } from "react";
import { AlertTriangle, Inbox, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { statusLabel, type QuizStatus } from "@/lib/format";

/* ------------------------------------------------------------------ *
 * Bộ component dùng chung cho toàn hệ thống (typography, spacing, màu)
 * Mọi trang desktop/mobile đều dùng các primitive dưới đây để đồng nhất.
 * ------------------------------------------------------------------ */

export function PageContainer({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("page-container", className)}>{children}</div>;
}

export function PageHero({
  title,
  description,
  icon: Icon,
  align = "left",
  children,
  aside,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  align?: "left" | "center";
  children?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section
      className={cn(
        "page-container gap-8 pb-8 pt-8 lg:pb-12 lg:pt-12",
        aside ? "grid lg:grid-cols-[minmax(0,1fr)_440px] lg:items-start lg:gap-10" : "block",
      )}
    >
      <div className={cn("animate-rise min-w-0", align === "center" && "text-center")}>
        {Icon && (
          <Icon className={cn("size-8 text-accent", align === "center" ? "mx-auto" : "")} />
        )}
        <h1 className={cn("type-h1 mt-3", align === "center" && "mx-auto")}>{title}</h1>
        {description && (
          <p
            className={cn(
              "type-lead mt-3 text-primary-foreground/80",
              align === "center" && "mx-auto max-w-2xl",
            )}
          >
            {description}
          </p>
        )}
        {children}
      </div>
      {aside && <div className="animate-rise min-w-0">{aside}</div>}
    </section>
  );
}

export function SectionHeading({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4", className)}>
      <div className="min-w-0">
        <h2 className="type-h2">{title}</h2>
        {description && <p className="type-muted mt-1 truncate">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

export function StatCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl px-2 py-2 text-center">
      <p className="font-heading text-2xl font-extrabold">{value}</p>
      <p className="type-eyebrow text-primary-foreground/70">{label}</p>
    </div>
  );
}

const statusTone: Record<QuizStatus, string> = {
  open: "bg-success/15 text-success",
  upcoming: "bg-warning/20 text-warning-foreground",
  closed: "bg-muted text-muted-foreground",
  paused: "bg-destructive/10 text-destructive",
};

export function StatusPill({ status, className }: { status: QuizStatus; className?: string }) {
  return (
    <span className={cn("status-pill", statusTone[status], className)}>{statusLabel[status]}</span>
  );
}

export function statusToneClass(status: QuizStatus) {
  return statusTone[status];
}

/* ---------------------------- Trạng thái ---------------------------- */

export function ListSkeleton({ rows = 4, height = "h-24" }: { rows?: number; height?: string }) {
  return (
    <div className="grid gap-3" aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className={cn("w-full rounded-3xl", height)} />
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
}: {
  title: string;
  description?: string;
  icon?: ComponentType<{ className?: string }>;
  action?: ReactNode;
}) {
  return (
    <div className="card-elevated flex flex-col items-center gap-3 px-6 py-12 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-secondary text-muted-foreground">
        <Icon className="size-6" />
      </span>
      <h3 className="type-h3">{title}</h3>
      {description && <p className="type-muted max-w-md">{description}</p>}
      {action}
    </div>
  );
}

export function ErrorState({
  title = "Không tải được dữ liệu",
  error,
  onRetry,
  retrying,
}: {
  title?: string;
  error?: unknown;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  const message = error instanceof Error ? error.message : "Vui lòng kiểm tra kết nối mạng rồi thử lại.";
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-3xl border border-destructive/30 bg-destructive/5 px-6 py-10 text-center"
    >
      <span className="grid size-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
        <AlertTriangle className="size-6" />
      </span>
      <h3 className="type-h3 text-destructive">{title}</h3>
      <p className="type-muted max-w-md break-words">{message}</p>
      {onRetry && (
        <Button variant="outline" className="rounded-full" onClick={onRetry} disabled={retrying}>
          {retrying ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Thử lại
        </Button>
      )}
    </div>
  );
}

/**
 * Bọc mọi danh sách: loading → error → empty → nội dung.
 */
export function QueryState({
  isLoading,
  isError,
  error,
  isEmpty,
  onRetry,
  isFetching,
  skeleton,
  empty,
  children,
}: {
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  isEmpty: boolean;
  onRetry?: () => void;
  isFetching?: boolean;
  skeleton?: ReactNode;
  empty: ReactNode;
  children: ReactNode;
}) {
  if (isLoading) return <>{skeleton ?? <ListSkeleton />}</>;
  if (isError) return <ErrorState error={error} onRetry={onRetry} retrying={isFetching} />;
  if (isEmpty) return <>{empty}</>;
  return <>{children}</>;
}

/* ---------------------------- Card row ---------------------------- */

export function CardRow({
  leading,
  title,
  subtitle,
  meta,
  trailing,
  onClick,
  active,
  className,
}: {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
  active?: boolean;
  className?: string;
}) {
  const body = (
    <>
      {leading}
      <span className="min-w-0">
        <span className="block truncate font-heading text-base font-bold">{title}</span>
        {subtitle && <span className="type-meta mt-1 block truncate">{subtitle}</span>}
        {meta && <span className="type-meta mt-1 block truncate">{meta}</span>}
      </span>
      {trailing}
    </>
  );

  const classes = cn(
    "group grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-3xl border border-border bg-card p-4 text-left transition-all",
    onClick && "hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]",
    active && "border-ring ring-2 ring-ring",
    className,
  );

  if (!onClick) return <div className={classes}>{body}</div>;
  return (
    <button type="button" onClick={onClick} className={classes}>
      {body}
    </button>
  );
}

/* ---------------------------- Khu quản trị ---------------------------- */

export function AdminSection({
  title,
  description,
  toolbar,
  actions,
  children,
}: {
  title: string;
  description?: ReactNode;
  toolbar?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-5">
      <div className="card-elevated flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h2 className="type-h3">{title}</h2>
          {description && <p className="type-meta mt-0.5">{description}</p>}
        </div>
        {(toolbar || actions) && (
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            {toolbar}
            {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
          </div>
        )}
      </div>
      {children}
    </section>
  );
}
