import {
  createFileRoute,
  Outlet,
  useNavigate,
  Link,
  useRouterState,
  Navigate,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/lib/auth";
import { listThreads, createThread, deleteThread } from "@/lib/bob.functions";
import { Bug, Plus, Trash2, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/bob")({
  head: () => ({ meta: [{ title: "BOB — Code Review Assistant" }] }),
  component: BobLayout,
});

function BobLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const path = useRouterState({ select: (s) => s.location.pathname });

  const { data: threads } = useQuery({
    queryKey: ["bob-threads"],
    queryFn: () => listThreads(),
    enabled: !!user,
  });

  const newThread = useMutation({
    mutationFn: async () => createThread("New review"),
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["bob-threads"] });
      navigate({ to: "/bob/$threadId", params: { threadId: row.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteThread(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bob-threads"] }),
  });

  // Auto-create one empty thread on first visit, then navigate into the most recent
  useEffect(() => {
    if (!user || threads === undefined) return;
    if (path !== "/bob") return;
    if (threads.length > 0) {
      navigate({ to: "/bob/$threadId", params: { threadId: threads[0].id }, replace: true });
    } else if (!newThread.isPending && !newThread.isSuccess) {
      newThread.mutate();
    }
  }, [user, threads, path]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) return <Navigate to="/login" />;

  return (
    <AppLayout>
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div
          className="rounded-2xl overflow-hidden shadow-glass"
          style={{ background: "linear-gradient(135deg,#4a5ed8,#6b7fd9)", padding: 2 }}
        >
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] bg-white rounded-[14px] min-h-[calc(100vh-160px)]">
            {/* Thread list */}
            <aside className="border-r border-[#e0f2fe] flex flex-col">
              <div className="p-4 border-b border-[#e0f2fe] flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg,#4a5ed8,#6b7fd9)" }}
                  >
                    <Bug className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-[#1a3a52]">BOB</div>
                    <div className="text-[10px] text-[#64748b] -mt-0.5">Code review AI</div>
                  </div>
                </div>
                <button
                  onClick={() => newThread.mutate()}
                  disabled={newThread.isPending}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white transition-transform hover:-translate-y-0.5"
                  style={{ background: "#3b82f6", boxShadow: "0 4px 12px rgba(59,130,246,0.30)" }}
                  title="New review"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {(threads ?? []).map((t) => {
                  const active = path === `/bob/${t.id}`;
                  return (
                    <div
                      key={t.id}
                      className={cn(
                        "group flex items-center gap-2 px-2 py-2 rounded-lg transition-colors",
                        active ? "bg-[#f0f7ff]" : "hover:bg-[#f8fbff]",
                      )}
                    >
                      <Link
                        to="/bob/$threadId"
                        params={{ threadId: t.id }}
                        className="flex-1 min-w-0 flex items-center gap-2"
                      >
                        <MessageSquare
                          className={cn(
                            "w-3.5 h-3.5 shrink-0",
                            active ? "text-[#3b82f6]" : "text-[#64748b]",
                          )}
                        />
                        <span
                          className={cn(
                            "text-xs truncate",
                            active ? "text-[#1a3a52] font-semibold" : "text-[#1a3a52]",
                          )}
                        >
                          {t.title}
                        </span>
                      </Link>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          if (confirm("Delete this conversation?")) {
                            del.mutate(t.id);
                            if (active) navigate({ to: "/bob" });
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded flex items-center justify-center hover:bg-red-50 text-[#94a3b8] hover:text-red-500 transition-all"
                        aria-label="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
                {threads && threads.length === 0 && (
                  <div className="text-xs text-[#64748b] p-4 text-center">
                    No conversations yet.
                  </div>
                )}
              </div>
            </aside>

            <main className="flex flex-col min-h-0">
              <Outlet />
            </main>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
