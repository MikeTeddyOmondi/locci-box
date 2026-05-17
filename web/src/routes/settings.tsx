import { createFileRoute, Navigate } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/lib/auth";
import { Settings as SettingsIcon } from "lucide-react";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — Locci Box" }] }),
  component: Page,
});

function Page() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" />;
  return (
    <AppLayout>
      <div className="min-h-[calc(100vh-9rem)] p-4 sm:p-6 lg:p-10 max-w-[1400px] mx-auto w-full space-y-6">
        <div className="glass rounded-2xl p-6 flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center">
            <SettingsIcon className="w-5 h-5 text-white" />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Settings</h1>
            <p className="text-sm text-white/60">Manage your account and preferences.</p>
          </div>
        </div>

        <div className="hero-white p-6 sm:p-8 space-y-6">
          <section className="space-y-2">
            <h2 className="text-lg font-semibold hero-text">Account</h2>
            <p className="text-sm hero-text-muted">Signed in as <span className="font-medium hero-text">{user.email}</span></p>
          </section>
          <section className="space-y-2">
            <h2 className="text-lg font-semibold hero-text">Preferences</h2>
            <p className="text-sm hero-text-muted">Display, notifications, and workspace defaults will appear here.</p>
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
