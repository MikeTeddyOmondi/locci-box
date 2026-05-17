import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Boxes, Mail, Lock, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign In — Locci Box" },
      { name: "description", content: "Sign in to your Locci Box account" },
    ],
  }),
  component: LoginPage,
});

type Mode = "login" | "register";

function LoginPage() {
  const { user, login, register, loginDemo } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/dashboard" });
  }, [user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setSubmitting(true);
    try {
      if (mode === "login") {
        await login(email, password);
        toast.success("Welcome to Locci Box");
      } else {
        await register(email, password);
        toast.success("Account created — welcome!");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const enterDemo = async () => {
    setSubmitting(true);
    try {
      await loginDemo();
      toast.success("Demo mode activated");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Demo failed";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4"
      style={{ background: "#e8f4f9" }}
    >
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-medium mb-6 hover:opacity-70 transition-opacity"
          style={{ color: "#1a3a52" }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>

        <div
          className="rounded-2xl p-8 animate-scale"
          style={{
            background: "#ffffff",
            boxShadow: "0 8px 32px rgba(15,42,75,0.12)",
            border: "1px solid rgba(224,242,254,0.8)",
          }}
        >
          <div className="flex items-center justify-center mb-6">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg,#4a5ed8,#6b7fd9)" }}
            >
              <Boxes className="w-6 h-6" style={{ color: "#fff" }} />
            </div>
          </div>

          {/* Mode toggle */}
          <div className="flex gap-1 p-1 rounded-lg mb-6" style={{ background: "#f1f5f9" }}>
            {(["login", "register"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className="flex-1 py-1.5 rounded-md text-sm font-medium transition-all"
                style={
                  mode === m
                    ? {
                        background: "#fff",
                        color: "#1a3a52",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                      }
                    : { color: "#64748b" }
                }
              >
                {m === "login" ? "Sign in" : "Register"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "#1a3a52" }}>
                Email
              </label>
              <div className="relative">
                <Mail
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                  style={{ color: "#94a3b8" }}
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  maxLength={255}
                  placeholder="you@company.com"
                  required
                  className="w-full pl-10 pr-3 py-3 rounded-lg text-sm outline-none transition-colors"
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    color: "#1a3a52",
                  }}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "#1a3a52" }}>
                Password
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                  style={{ color: "#94a3b8" }}
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  maxLength={128}
                  placeholder={mode === "register" ? "Min. 8 characters" : "••••••••"}
                  required
                  minLength={mode === "register" ? 8 : 1}
                  className="w-full pl-10 pr-3 py-3 rounded-lg text-sm outline-none transition-colors"
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    color: "#1a3a52",
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-lg text-sm font-semibold transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: "#3b82f6",
                color: "#fff",
                boxShadow: "0 4px 12px rgba(59,130,246,0.30)",
              }}
            >
              {submitting ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {mode === "login" ? "Signing in…" : "Creating account…"}
                </span>
              ) : mode === "login" ? (
                "Sign In"
              ) : (
                "Create Account"
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t" style={{ borderColor: "#e2e8f0" }}>
            <button
              onClick={enterDemo}
              disabled={submitting}
              className="w-full py-3 rounded-lg text-sm font-semibold transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: "#f8fafc",
                color: "#1a3a52",
                border: "1px solid #e2e8f0",
              }}
            >
              Try Demo Sandbox
            </button>
            <p className="text-[11px] text-center mt-3" style={{ color: "#94a3b8" }}>
              box@locci.cloud / demo1234
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
