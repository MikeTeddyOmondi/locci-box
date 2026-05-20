import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/lib/auth";
import { apiClient, type StatsData, type ApiKeyData } from "@/integrations/api/client";
import {
  Activity,
  Server,
  Clock,
  BarChart3,
  Check,
  X,
  Loader2,
  TrendingUp,
  KeyRound,
  Plus,
  ExternalLink,
  Copy,
} from "lucide-react";
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  CartesianGrid,
} from "recharts";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Locci Box" }] }),
  component: Page,
});

const EMPTY_CHART = [
  { day: "Mon", runs: 0 },
  { day: "Tue", runs: 0 },
  { day: "Wed", runs: 0 },
  { day: "Thu", runs: 0 },
  { day: "Fri", runs: 0 },
  { day: "Sat", runs: 0 },
  { day: "Sun", runs: 0 },
];

function buildStats(data: StatsData | null) {
  const successRate =
    data && data.total_runs > 0
      ? `${Math.round((data.success_runs / data.total_runs) * 100)}%`
      : "—";
  return [
    {
      label: "Total Runs",
      value: data ? data.total_runs.toLocaleString() : "—",
      trend: data && data.total_runs > 0 ? `${data.success_runs} succeeded` : "No runs yet",
      icon: BarChart3,
      gradient: "bg-gradient-cyan-blue",
    },
    {
      label: "Active Sandboxes",
      value: data ? String(data.active_sandboxes) : "—",
      trend: "Running right now",
      icon: Server,
      gradient: "bg-gradient-teal-green",
    },
    {
      label: "Avg Execution Time",
      value: data ? `${data.avg_execution_ms}ms` : "—",
      trend: "Across all runs",
      icon: Clock,
      gradient: "bg-gradient-purple-pink",
    },
    {
      label: "Success Rate",
      value: successRate,
      trend: data ? `${data.total_runs} total runs` : "No runs yet",
      icon: Activity,
      gradient: "bg-gradient-amber-orange",
    },
  ];
}

const langLabel: Record<string, string> = {
  python: "Python",
  node: "Node.js",
  bash: "Bash",
  ruby: "Ruby",
};

function Page() {
  const { user } = useAuth();
  const [statsData, setStatsData] = useState<StatsData | null>(null);
  const [keys, setKeys] = useState<ApiKeyData[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function copyId(id: string) {
    navigator.clipboard.writeText(id).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  useEffect(() => {
    apiClient.getStats().then(setStatsData).catch(() => {});
    apiClient.listKeys().then(setKeys).catch(() => {});
  }, []);

  if (!user) return <Navigate to="/login" />;

  const stats = buildStats(statsData);
  const chart = statsData?.daily_runs ?? EMPTY_CHART;
  const recentRuns = statsData?.recent_runs ?? [];
  const activeKeys = keys.filter((k) => k.status === "active");

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-10 space-y-6 sm:space-y-8 max-w-7xl mx-auto w-full">
        <div className="animate-fade-up">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight">
            Dashboard
          </h1>
          <p className="text-sm sm:text-base text-white/60 mt-2">
            Welcome back, {user.email.split("@")[0]} ·{" "}
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className="glass glass-hover rounded-2xl p-4 sm:p-5 animate-fade-up"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <div className="flex items-start justify-between">
                <div
                  className={cn(
                    "w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shadow-lg",
                    s.gradient,
                  )}
                >
                  <s.icon className="w-5 h-5 text-white" />
                </div>
                <div className="inline-flex items-center gap-1 text-xs text-success">
                  <TrendingUp className="w-3 h-3" />
                </div>
              </div>
              <div className="mt-3 sm:mt-4 text-[10px] sm:text-xs uppercase tracking-wider text-white/50">
                {s.label}
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold mt-1 tracking-tight">
                {s.value}
              </div>
              <div className="text-[11px] sm:text-xs text-white/60 mt-1">{s.trend}</div>
            </div>
          ))}
        </div>

        <div
          className="bg-locci-gradient rounded-2xl p-4 sm:p-7 animate-fade-up shadow-hero"
          style={{ animationDelay: "300ms" }}
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white">Sandbox Runs</h2>
              <p className="text-sm text-white/75 mt-0.5">Last 7 days</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-white/75">
              <span className="w-2 h-2 rounded-full bg-white" /> Executions
            </div>
          </div>
          <div className="h-56 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="#ffffff" stopOpacity={0.03} />
                  </linearGradient>
                  <linearGradient id="strokeGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="100%" stopColor="#d6ffd9" />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  stroke="rgba(255,255,255,0.18)"
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="day"
                  stroke="rgba(255,255,255,0.75)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="rgba(255,255,255,0.75)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "rgba(15, 23, 60, 0.92)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: 10,
                    fontSize: 12,
                    color: "#fff",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
                  }}
                  labelStyle={{ color: "#fff", fontWeight: 600 }}
                  itemStyle={{ color: "#fff" }}
                />
                <Area
                  type="monotone"
                  dataKey="runs"
                  stroke="url(#strokeGrad)"
                  strokeWidth={3}
                  fill="url(#g1)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* API Keys */}
        <div className="space-y-4 animate-fade-up" style={{ animationDelay: "350ms" }}>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-purple-pink flex items-center justify-center shadow-lg">
                  <KeyRound className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">API Keys</h2>
              </div>
              <p className="text-sm text-white/60 mt-2">
                Your active keys for CLI, SDK, and MCP server access.
              </p>
            </div>
            <Link to="/keys">
              <Button className="bg-gradient-primary text-white hover:opacity-90 shadow-primary self-start sm:self-auto">
                <Plus className="w-4 h-4 mr-2" /> Manage Keys
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
            {keys.length === 0 && (
              <Link
                to="/keys"
                className="glass glass-hover rounded-2xl p-5 flex flex-col items-center justify-center gap-3 text-white/40 hover:text-white/70 transition-colors col-span-full py-10"
              >
                <KeyRound className="w-8 h-8" />
                <span className="text-sm">No API keys yet — create one to get started.</span>
              </Link>
            )}
            {keys.map((k) => (
              <Link
                key={k.id}
                to="/keys"
                className="glass glass-hover rounded-2xl p-5 flex flex-col gap-3 group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="w-10 h-10 rounded-xl bg-gradient-cyan-teal flex items-center justify-center shadow-lg shrink-0">
                    <KeyRound className="w-5 h-5 text-white" />
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                      k.status === "active"
                        ? "bg-success/15 text-success border-success/30"
                        : "bg-white/5 text-white/50 border-white/10",
                    )}
                  >
                    {k.status === "active" ? "Active" : "Revoked"}
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="font-semibold truncate">{k.name}</div>
                  <div className="font-mono text-xs text-white/40 mt-0.5 truncate">{k.key}</div>
                </div>
                <div className="flex items-center justify-between mt-auto text-xs text-white/50">
                  <span>{k.rateLimit ? `${k.rateLimit}/min` : "Unlimited"}</span>
                  <span className="flex items-center gap-1 group-hover:text-white transition-colors">
                    View <ExternalLink className="w-3 h-3" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div
          className="glass rounded-2xl overflow-hidden animate-fade-up"
          style={{ animationDelay: "400ms" }}
        >
          <div className="p-4 sm:p-6 border-b border-white/10">
            <h2 className="text-lg font-bold">Recent Activity</h2>
            <p className="text-sm text-white/60">Last 10 sandbox executions</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead className="bg-white/5">
                <tr className="text-left text-xs uppercase tracking-wider text-white/50">
                  <th className="px-4 sm:px-6 py-3 font-medium">Timestamp</th>
                  <th className="px-4 sm:px-6 py-3 font-medium">Sandbox ID</th>
                  <th className="px-4 sm:px-6 py-3 font-medium">Language</th>
                  <th className="px-4 sm:px-6 py-3 font-medium">Status</th>
                  <th className="px-4 sm:px-6 py-3 font-medium">Duration</th>
                  <th className="px-4 sm:px-6 py-3 font-medium">Exit Code</th>
                </tr>
              </thead>
              <tbody>
                {recentRuns.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-white/40 text-sm">
                      No runs yet — execute some code to see activity here.
                    </td>
                  </tr>
                )}
                {recentRuns.map((r) => {
                  const isOk = r.status === "completed";
                  const isRunning = r.status === "running";
                  const time = new Date(r.created_at).toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  return (
                    <tr
                      key={r.sandbox_id}
                      className="border-t border-white/5 hover:bg-white/5 transition-colors"
                    >
                      <td className="px-4 sm:px-6 py-3 text-white/70 whitespace-nowrap">{time}</td>
                      <td className="px-4 sm:px-6 py-3">
                        <button
                          type="button"
                          title={r.sandbox_id}
                          onClick={() => copyId(r.sandbox_id)}
                          className="inline-flex items-center gap-1.5 font-mono text-xs text-white/60 hover:text-white transition-colors group"
                        >
                          <span>{r.sandbox_id.slice(0, 14)}…</span>
                          {copiedId === r.sandbox_id
                            ? <Check className="w-3 h-3 text-success shrink-0" />
                            : <Copy className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />}
                        </button>
                      </td>
                      <td className="px-4 sm:px-6 py-3 font-medium">
                        {langLabel[r.language] ?? r.language}
                      </td>
                      <td className="px-4 sm:px-6 py-3">
                        {isOk && (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-success/15 text-success text-xs">
                            <Check className="w-3 h-3" /> Completed
                          </span>
                        )}
                        {!isOk && !isRunning && (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-destructive/15 text-destructive text-xs">
                            <X className="w-3 h-3" /> {r.status === "timeout" ? "Timeout" : "Failed"}
                          </span>
                        )}
                        {isRunning && (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-info/15 text-info text-xs">
                            <Loader2 className="w-3 h-3 animate-spin" /> Running
                          </span>
                        )}
                      </td>
                      <td className="px-4 sm:px-6 py-3 font-mono text-xs">
                        {r.duration_ms != null ? `${r.duration_ms}ms` : "—"}
                      </td>
                      <td className="px-4 sm:px-6 py-3 font-mono text-xs text-white/60">
                        {r.exit_code != null ? `exit ${r.exit_code}` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
