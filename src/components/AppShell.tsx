import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { BookOpenCheck, Home, Settings2, Swords, Trophy, UserRoundCog } from "lucide-react";

import { BrandMark } from "@/components/BrandLogo";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Trang chủ", icon: Home },
  { to: "/dau-truong", label: "Đấu trường", icon: Swords },
  { to: "/bang-xep-hang", label: "Bảng xếp hạng", icon: Trophy },
  { to: "/nhan-vat", label: "Nhân vật", icon: UserRoundCog },
  { to: "/huong-dan", label: "Hướng dẫn", icon: BookOpenCheck },
  { to: "/quan-tri", label: "Quản trị", icon: Settings2 },
] as const;

/** Menu dưới cùng trên di động chỉ giữ 4 mục để vừa một hàng. */
const mobileNavItems = navItems.filter(
  (item) => item.to !== "/huong-dan" && item.to !== "/quan-tri",
);


/**
 * Khung ứng dụng kiểu "game hub": thanh điều hướng biểu tượng bên trái (desktop),
 * vùng nội dung ở giữa và panel phụ bên phải (tuỳ chọn).
 */
export function AppShell({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="min-h-screen bg-background lg:p-5">
      <div className="mx-auto flex w-full max-w-[100rem] flex-col overflow-hidden bg-card lg:min-h-[calc(100vh-2.5rem)] lg:flex-row lg:rounded-[2.5rem] lg:shadow-[var(--shadow-lift)]">
        {/* Thanh điều hướng biểu tượng — desktop */}
        <aside className="hidden shrink-0 flex-col items-center justify-between bg-sidebar py-8 lg:flex lg:w-24">
          <div className="flex flex-col items-center gap-8">
            <Link to="/" aria-label="Trang chủ" className="animate-bob">
              <BrandMark className="size-12 rounded-2xl" />
            </Link>
            <nav className="flex flex-col gap-2">
              {navItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-label={item.label}
                  title={item.label}
                  className="nav-rail-item"
                  activeProps={{ className: cn("nav-rail-item", "nav-rail-item-active") }}
                  activeOptions={{ exact: item.to === "/" }}
                >
                  <item.icon className="relative" strokeWidth={1.75} absoluteStrokeWidth />
                </Link>

              ))}
            </nav>

          </div>
          <span className="grid size-11 place-items-center rounded-2xl surface-gold shadow-[var(--shadow-gold)]">
            <Trophy className="size-5" />
          </span>
        </aside>

        {/* Nội dung chính */}
        <div className="flex min-w-0 flex-1 flex-col bg-background">
          <div className="lg:hidden">
            <SiteHeader />
          </div>
          <main className="min-w-0 flex-1 px-[calc(1rem+env(safe-area-inset-left))] pb-[calc(5.25rem+env(safe-area-inset-bottom))] pt-5 sm:px-[calc(1.5rem+env(safe-area-inset-left))] lg:px-10 lg:py-10 lg:pb-10">
            {children}
          </main>
          <div className="hidden lg:block">
            <SiteFooter />
          </div>
        </div>

        {/* Thanh tab dưới cùng — kiểu ứng dụng di động */}
        <nav
          aria-label="Điều hướng chính"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] backdrop-blur-md lg:hidden"
        >

          <ul className="grid grid-cols-4">
            {mobileNavItems.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  {...(item.to === "/quan-tri" ? { search: {} } : {})}
                  aria-label={item.label}
                  className="flex flex-col items-center gap-1 px-1 py-2.5 text-[11px] font-medium text-muted-foreground transition-colors active:scale-95"
                  activeProps={{ className: "text-primary" }}
                  activeOptions={{ exact: item.to === "/" }}
                >
                  <item.icon className="size-5" strokeWidth={2} absoluteStrokeWidth />
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Panel phụ */}
        {aside && (
          <aside className="w-full shrink-0 border-t border-border bg-card px-6 py-8 lg:w-84 lg:border-l lg:border-t-0 lg:px-8">
            {aside}
          </aside>
        )}
      </div>
    </div>
  );
}
