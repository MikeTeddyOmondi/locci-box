import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/lib/auth";
import { apiClient, type StatsData } from "@/integrations/api/client";
import {
  Activity,
  Server,
  Clock,
  BarChart3,
  Check,
  X,
  Loader2,
  TrendingUp,
  Users,
  Plus,
  Circle,
  Code2,
  FlaskConical,
  Lock,
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
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Locci Box" }] }),
  component: Page,
});

const chart = [
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

type TeamSandbox = {
  id: string;
  name: string;
  lang: string;
  status: "live" | "idle" | "private";
  members: { name: string; color: string }[];
  updated: string;
  gradient: string;
  icon: typeof Code2;
};

const teamSandboxes: TeamSandbox[] = [
  {
    id: "sb_1",
    name: "payment-webhook-tests",
    lang: "Python",
    status: "live",
    members: [
      { name: "AC", color: "bg-gradient-cyan-blue" },
      { name: "JM", color: "bg-gradient-purple-pink" },
      { name: "RS", color: "bg-gradient-teal-green" },
    ],
    updated: "editing now",
    gradient: "bg-gradient-cyan-blue",
    icon: Code2,
  },
  {
    id: "sb_2",
    name: "auth-flow-integration",
    lang: "Node.js",
    status: "live",
    members: [
      { name: "MK", color: "bg-gradient-purple-pink" },
      { name: "LT", color: "bg-gradient-amber-orange" },
    ],
    updated: "2 min ago",
    gradient: "bg-gradient-purple-pink",
    icon: FlaskConical,
  },
  {
    id: "sb_3",
    name: "fibonacci-bench",
    lang: "Ruby",
    status: "idle",
    members: [
      { name: "DV", color: "bg-gradient-teal-green" },
      { name: "AC", color: "bg-gradient-cyan-blue" },
      { name: "PH", color: "bg-gradient-orange-red" },
      { name: "EM", color: "bg-gradient-cyan-teal" },
    ],
    updated: "1 hour ago",
    gradient: "bg-gradient-teal-green",
    icon: Code2,
  },
  {
    id: "sb_4",
    name: "ml-model-eval",
    lang: "Python",
    status: "private",
    members: [{ name: "RS", color: "bg-gradient-teal-green" }],
    updated: "yesterday",
    gradient: "bg-gradient-amber-orange",
    icon: Lock,
  },
];

function Page() {
  const { user } = useAuth();
  const [statsData, setStatsData] = useState<StatsData | null>(null);

  useEffect(() => {
    apiClient.getStats().then(setStatsData).catch(() => {});
  }, []);

  if (!user) return <Navigate to="/login" />;

  const stats = buildStats(statsData);
  const visibleSandboxes = user.isDemo ? teamSandboxes.slice(0, 2) : teamSandboxes;
  const recentRuns = statsData?.recent_runs ?? [];

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

        {/* Team Workspaces */}
        <div className="space-y-4 animate-fade-up" style={{ animationDelay: "350ms" }}>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-purple-pink flex items-center justify-center shadow-lg">
                  <Users className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                  Team Workspaces
                </h2>
              </div>
              <p className="text-sm text-white/60 mt-2">
                Collaborate live in shared sandboxes — code, run, and ship together.
              </p>
            </div>
            <Button
              onClick={() => toast.success("Team sandbox created — invites sent")}
              className="bg-gradient-primary text-white hover:opacity-90 shadow-primary self-start sm:self-auto"
            >
              <Plus className="w-4 h-4 mr-2" /> New Team Sandbox
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
            {visibleSandboxes.map((sb) => {
              const Icon = sb.icon;
              return (
                <Link
                  key={sb.id}
                  to="/playground"
                  className="glass glass-hover rounded-2xl p-5 flex flex-col gap-4 group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shrink-0",
                        sb.gradient,
                      )}
                    >
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    {sb.status === "live" && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-success/15 text-success text-[10px] font-bold uppercase tracking-wider border border-success/30">
                        <span className="relative flex w-1.5 h-1.5">
                          <span className="absolute inset-0 rounded-full bg-success opacity-75 animate-ping" />
                          <span className="relative w-1.5 h-1.5 rounded-full bg-success" />
                        </span>
                        Live
                      </span>
                    )}
                    {sb.status === "idle" && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/5 text-white/60 text-[10px] font-bold uppercase tracking-wider border border-white/10">
                        <Circle className="w-1.5 h-1.5 fill-current" /> Idle
                      </span>
                    )}
                    {sb.status === "private" && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/5 text-white/60 text-[10px] font-bold uppercase tracking-wider border border-white/10">
                        <Lock className="w-2.5 h-2.5" /> Private
                      </span>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="font-semibold truncate group-hover:text-white">{sb.name}</div>
                    <div className="text-xs text-white/50 mt-0.5">
                      {sb.lang} · {sb.updated}
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-auto">
                    <div className="flex -space-x-2">
                      {sb.members.slice(0, 4).map((m, i) => (
                        <div
                          key={i}
                          className={cn(
                            "w-7 h-7 rounded-full ring-2 ring-[#0a1929] flex items-center justify-center text-[10px] font-bold text-white",
                            m.color,
                          )}
                          title={m.name}
                        >
                          {m.name}
                        </div>
                      ))}
                      {sb.members.length > 4 && (
                        <div className="w-7 h-7 rounded-full ring-2 ring-[#0a1929] bg-white/10 flex items-center justify-center text-[10px] font-bold text-white/70">
                          +{sb.members.length - 4}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-white/50 group-hover:text-white transition-colors">
                      Open →
                    </span>
                  </div>
                </Link>
              );
            })}
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
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-white/5">
                <tr className="text-left text-xs uppercase tracking-wider text-white/50">
                  <th className="px-4 sm:px-6 py-3 font-medium">Timestamp</th>
                  <th className="px-4 sm:px-6 py-3 font-medium">Language</th>
                  <th className="px-4 sm:px-6 py-3 font-medium">Status</th>
                  <th className="px-4 sm:px-6 py-3 font-medium">Duration</th>
                  <th className="px-4 sm:px-6 py-3 font-medium">Tenant</th>
                </tr>
              </thead>
              <tbody>
                {recentRuns.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-white/40 text-sm">
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
                      <td className="px-4 sm:px-6 py-3 font-mono text-xs">{r.duration_ms}ms</td>
                      <td className="px-4 sm:px-6 py-3 font-mono text-xs text-white/60">
                        exit {r.exit_code}
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
