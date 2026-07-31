import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, LogIn, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Đăng nhập quản trị | Hội thi trắc nghiệm" },
      { name: "description", content: "Khu vực đăng nhập dành cho quản trị viên hệ thống thi trắc nghiệm trực tuyến." },
      { property: "og:title", content: "Đăng nhập quản trị" },
      { property: "og:description", content: "Khu vực dành cho quản trị viên hệ thống thi trắc nghiệm." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/quan-tri" });
    });
  }, [navigate]);

  async function signIn() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    navigate({ to: "/quan-tri" });
  }

  async function signUp() {
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/quan-tri` },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Tạo tài khoản thành công. Bạn có thể đăng nhập ngay.");
  }

  async function signInGoogle() {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) return toast.error("Không thể đăng nhập bằng Google.");
    if (result.redirected) return;
    navigate({ to: "/quan-tri" });
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto flex max-w-md flex-col px-4 py-14">
        <div className="card-elevated p-7">
          <span className="surface-accent flex size-11 items-center justify-center rounded-xl">
            <ShieldCheck className="size-5" />
          </span>
          <h1 className="mt-4 font-heading text-2xl font-bold">Khu vực quản trị</h1>
          <p className="mt-1 text-sm text-muted-foreground">Đăng nhập để quản lý cuộc thi, câu hỏi và kết quả.</p>

          <Tabs defaultValue="signin" className="mt-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Đăng nhập</TabsTrigger>
              <TabsTrigger value="signup">Tạo tài khoản</TabsTrigger>
            </TabsList>

            <div className="mt-5 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@vatm.vn"
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Mật khẩu</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>

              <TabsContent value="signin" className="m-0">
                <Button className="w-full" onClick={signIn} disabled={loading}>
                  {loading ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
                  Đăng nhập
                </Button>
              </TabsContent>
              <TabsContent value="signup" className="m-0">
                <Button className="w-full" onClick={signUp} disabled={loading}>
                  {loading && <Loader2 className="size-4 animate-spin" />}
                  Tạo tài khoản quản trị
                </Button>
              </TabsContent>

              <div className="relative py-1 text-center text-xs text-muted-foreground">
                <span className="relative z-10 bg-card px-2">hoặc</span>
                <span className="absolute inset-x-0 top-1/2 h-px bg-border" />
              </div>

              <Button variant="outline" className="w-full" onClick={signInGoogle}>
                Đăng nhập với Google
              </Button>
            </div>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
