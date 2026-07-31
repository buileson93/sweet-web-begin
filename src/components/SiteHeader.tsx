import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu } from "lucide-react";

import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const links = [
  { to: "/", label: "Trang chủ" },
  { to: "/bang-xep-hang", label: "Bảng xếp hạng" },
  { to: "/lich-su", label: "Lịch sử" },
  { to: "/huong-dan", label: "Hướng dẫn" },
  { to: "/quan-tri", label: "Quản trị" },
] as const;

export function SiteHeader({ variant = "light" }: { variant?: "light" | "onDark" }) {
  const [open, setOpen] = useState(false);
  const onDark = variant === "onDark";

  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full border-b pt-[env(safe-area-inset-top)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] backdrop-blur",
        onDark ? "border-primary-foreground/15 bg-primary/70 text-primary-foreground" : "border-border bg-background/85",
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <Link to="/" aria-label="Trang chủ" className="flex min-w-0 items-center gap-3">
          <BrandLogo />
        </Link>

        <nav className="hidden items-center gap-1 text-sm font-medium md:flex">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={cn(
                "rounded-lg px-3 py-2 transition-colors",
                onDark
                  ? "text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
              activeProps={{
                className: cn(
                  "rounded-lg px-3 py-2",
                  onDark ? "bg-primary-foreground/15 text-primary-foreground" : "bg-secondary text-foreground",
                ),
              }}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Mở menu"
              className={cn(
                "md:hidden",
                onDark && "text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground",
              )}
            >
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <SheetHeader className="text-left">
              <SheetTitle className="font-heading">Điều hướng</SheetTitle>
            </SheetHeader>
            <nav className="mt-4 flex flex-col gap-1 px-4 pb-6 text-base font-medium">
              {links.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-4 py-3 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  activeProps={{ className: "rounded-xl px-4 py-3 bg-secondary text-foreground" }}
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
