import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { KeyRound, Loader2, LogIn, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { resetAdminPassword } from "@/lib/adminRecovery.functions";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Đăng nhập quản trị | Hội thi trắc nghiệm" },
      { name: "description", content: "Khu vực đăng nhập dành cho quản trị viên hệ thống thi trắc nghiệm trực tuyến." },
      { property: "og:title", content: "Đăng nhập quản trị" },
      { property: "og:description", content: "Khu vực dành cho quản trị viên hệ thống thi trắc nghiệm." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "recover">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryKey, setRecoveryKey] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const recover = useServerFn(resetAdminPassword);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/quan-tri" });
    });
  }, [navigate]);

  async function signIn() {
    if (!email.trim() || !password) return toast.error("Vui lòng nhập email và mật khẩu.");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) return toast.error("Email hoặc mật khẩu chưa đúng.");
    navigate({ to: "/quan-tri" });
  }

  async function submitRecovery() {
    if (newPassword.length < 8) return toast.error("Mật khẩu mới cần tối thiểu 8 ký tự.");
    setLoading(true);
    try {
      await recover({ data: { email: email.trim(), recoveryKey, newPassword } });
      toast.success("Đã đặt lại mật khẩu. Bạn có thể đăng nhập ngay.");
      setPassword(newPassword);
      setNewPassword("");
      setRecoveryKey("");
      setMode("signin");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không đặt lại được mật khẩu.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-md px-4 py-10 sm:py-14">
        <div className="card-elevated p-6 sm:p-7">
          <span className="surface-accent flex size-11 items-center justify-center rounded-xl">
            {mode === "signin" ? <ShieldCheck className="size-5" /> : <KeyRound className="size-5" />}
          </span>
          <h1 className="mt-4 font-heading text-2xl font-bold">
            {mode === "signin" ? "Khu vực quản trị" : "Khôi phục mật khẩu"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Đăng nhập bằng tài khoản quản trị được cấp để quản lý cuộc thi, câu hỏi và kết quả."
              : "Nhập khoá khôi phục nội bộ do quản trị viên cấp để đặt lại mật khẩu cho tài khoản quản trị."}
          </p>

          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email quản trị</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@quanlybay.vn"
                autoComplete="email"
              />
            </div>

            {mode === "signin" ? (
              <div className="space-y-2">
                <Label htmlFor="password">Mật khẩu</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void signIn()}
                  autoComplete="current-password"
                />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="key">Khoá khôi phục</Label>
                  <Input
                    id="key"
                    type="password"
                    inputMode="numeric"
                    value={recoveryKey}
                    onChange={(e) => setRecoveryKey(e.target.value)}
                    placeholder="Khoá nội bộ"
                    autoComplete="one-time-code"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">Mật khẩu mới</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Tối thiểu 8 ký tự"
                    autoComplete="new-password"
                  />
                </div>
              </>
            )}

            {mode === "signin" ? (
              <Button className="w-full" onClick={signIn} disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
                Đăng nhập
              </Button>
            ) : (
              <Button className="w-full" onClick={submitRecovery} disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
                Đặt lại mật khẩu
              </Button>
            )}

            <button
              type="button"
              className="w-full text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              onClick={() => setMode(mode === "signin" ? "recover" : "signin")}
            >
              {mode === "signin" ? "Quên mật khẩu?" : "Quay lại đăng nhập"}
            </button>

            <p className="text-center text-xs text-muted-foreground">
              Hệ thống không mở đăng ký. Tài khoản quản trị do đơn vị cấp sẵn.
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
