import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { BookOpenCheck, Home, Settings2, Trophy } from "lucide-react";

import { BrandMark } from "@/components/BrandLogo";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Trang chủ", icon: Home },
  { to: "/bang-xep-hang", label: "Bảng xếp hạng", icon: Trophy },
  { to: "/huong-dan", label: "Hướng dẫn", icon: BookOpenCheck },
  { to: "/quan-tri", label: "Quản trị", icon: Settings2 },
] as const;

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
                  className="nav-rail-item"
                  activeProps={{ className: cn("nav-rail-item", "nav-rail-item-active") }}
                  activeOptions={{ exact: item.to === "/" }}
                >
                  <item.icon className="relative" strokeWidth={1.75} absoluteStrokeWidth />
                  <span className="nav-rail-label">{item.label}</span>
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
          <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">{children}</main>
          <SiteFooter />
        </div>

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
