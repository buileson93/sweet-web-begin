import { Link } from "@tanstack/react-router";
import { Wrench } from "lucide-react";

import { BrandLogo } from "@/components/BrandLogo";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-secondary/40">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-4 py-8 text-center sm:flex-row sm:items-start sm:justify-between sm:text-left">
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
          <BrandLogo compact />
          <div className="text-sm">
            <p className="font-semibold">Công ty Quản lý bay miền Trung</p>
            <p className="text-muted-foreground">Hệ thống thi trắc nghiệm trực tuyến nội bộ</p>
          </div>
        </div>

        <nav className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
          <Link to="/" className="transition-colors hover:text-foreground">
            Trang chủ
          </Link>
          <Link to="/bang-xep-hang" className="transition-colors hover:text-foreground">
            Bảng xếp hạng
          </Link>
          <Link to="/huong-dan" className="transition-colors hover:text-foreground">
            Hướng dẫn
          </Link>
        </nav>

        <div className="flex max-w-full flex-col items-center gap-2 sm:items-end">
          <span
            tabIndex={0}
            role="note"
            aria-label="Sản phẩm do Phòng Kỹ thuật, Công ty Quản lý bay miền Trung phát triển"
            title="Made by Phòng Kỹ thuật"
            className="metal-bar group inline-flex max-w-full items-center gap-2 px-3.5 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <span aria-hidden className="metal-bar-sheen" />
            <Wrench aria-hidden className="size-3.5 shrink-0 text-accent" />
            <span className="truncate">Made by Phòng Kỹ thuật</span>
          </span>


          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} VATM MIRATS.</p>
        </div>
      </div>
    </footer>
  );
}
