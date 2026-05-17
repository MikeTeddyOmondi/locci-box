import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/lib/auth";
import { apiClient, type ApiKeyData } from "@/integrations/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Copy, Plus, Trash2, Ban, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/keys")({
  head: () => ({ meta: [{ title: "API Keys — Locci Box" }] }),
  component: Page,
});

function Page() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" />;

  const [keys, setKeys] = useState<ApiKeyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [maxConc, setMaxConc] = useState(5);
  const [timeout_, setTimeout_] = useState(30);
  const [rateLimited, setRateLimited] = useState(true);
  const [rate, setRate] = useState(100);
  const [createdKey, setCreatedKey] = useState<ApiKeyData | null>(null);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .listKeys()
      .then(setKeys)
      .catch(() => toast.error("Failed to load API keys"))
      .finally(() => setLoading(false));
  }, []);

  const reset = () => {
    setName("");
    setMaxConc(5);
    setTimeout_(30);
    setRateLimited(true);
    setRate(100);
  };

  const create = async () => {
    if (!name.trim()) {
      toast.error("Key name required");
      return;
    }
    setCreating(true);
    try {
      const k = await apiClient.createKey(name.trim(), {
        rateLimit: rateLimited ? rate : null,
        maxConcurrent: maxConc,
        timeoutSeconds: timeout_,
      });
      setKeys((prev) => [{ ...k, key: `${k.key.slice(0, 14)}…${k.key.slice(-4)}` }, ...prev]);
      setCreatedKey(k);
      setOpen(false);
      reset();
      toast.success("API key created");
    } catch {
      toast.error("Failed to create API key");
    } finally {
      setCreating(false);
    }
  };

  const copy = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success("Copied to clipboard");
  };

  const revoke = async () => {
    if (!revokeId) return;
    try {
      await apiClient.revokeKey(revokeId);
      setKeys((ks) => ks.map((k) => (k.id === revokeId ? { ...k, status: "revoked" } : k)));
      toast.success("API key revoked");
    } catch {
      toast.error("Failed to revoke key");
    } finally {
      setRevokeId(null);
    }
  };

  const del = async () => {
    if (!deleteId) return;
    try {
      await apiClient.deleteKey(deleteId);
      setKeys((ks) => ks.filter((k) => k.id !== deleteId));
      toast.success("API key deleted");
    } catch {
      toast.error("Failed to delete key");
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-10 space-y-6 max-w-7xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-up">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight">
              API Keys
            </h1>
            <p className="text-sm sm:text-base text-white/60 mt-2">
              Manage your API keys, rate limits, and concurrent sandbox limits.
            </p>
          </div>
          <Button
            onClick={() => setOpen(true)}
            className="bg-locci-gradient hover:opacity-90 h-11 px-5 shadow-primary self-start sm:self-auto border-0"
            style={{ color: "#ffffff" }}
          >
            <Plus className="w-4 h-4 mr-2" /> Create New Key
          </Button>
        </div>

        <div
          className="glass rounded-2xl overflow-hidden animate-fade-up"
          style={{ animationDelay: "100ms" }}
        >
          {loading ? (
            <div className="flex items-center justify-center py-16 text-white/50 gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading keys…
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[760px]">
                <thead className="bg-white/5">
                  <tr className="text-left text-xs uppercase tracking-wider text-white/50">
                    <th className="px-4 sm:px-6 py-4 font-medium">Key Name</th>
                    <th className="px-4 sm:px-6 py-4 font-medium">Created</th>
                    <th className="px-4 sm:px-6 py-4 font-medium">Last Used</th>
                    <th className="px-4 sm:px-6 py-4 font-medium">Status</th>
                    <th className="px-4 sm:px-6 py-4 font-medium">Rate Limit</th>
                    <th className="px-4 sm:px-6 py-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {keys.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-white/40 text-sm">
                        No API keys yet — create one to get started.
                      </td>
                    </tr>
                  )}
                  {keys.map((k) => (
                    <tr
                      key={k.id}
                      className="border-t border-white/5 hover:bg-white/5 transition-colors"
                    >
                      <td className="px-4 sm:px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-gradient-cyan-teal flex items-center justify-center shadow-sm">
                            <KeyRound className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <div className="font-semibold">{k.name}</div>
                            <div className="font-mono text-xs text-white/50">{k.key}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-white/70 whitespace-nowrap">
                        {new Date(k.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-white/70 whitespace-nowrap">
                        {k.lastUsedAt
                          ? new Date(k.lastUsedAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })
                          : "Never"}
                      </td>
                      <td className="px-4 sm:px-6 py-4">
                        <span
                          className={cn(
                            "inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border",
                            k.status === "active"
                              ? "bg-success/15 text-success border-success/30"
                              : "bg-white/5 text-white/50 border-white/10",
                          )}
                        >
                          {k.status === "active" ? "Active" : "Revoked"}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 font-mono text-xs whitespace-nowrap">
                        {k.rateLimit ? `${k.rateLimit}/min` : "Unlimited"}
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-right">
                        <div className="inline-flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="hover:bg-white/10 text-white/80"
                            onClick={() => copy(k.key)}
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="hover:bg-white/10 text-white/80"
                            disabled={k.status === "revoked"}
                            onClick={() => setRevokeId(k.id)}
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="hover:bg-destructive/20 text-destructive"
                            onClick={() => setDeleteId(k.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Create modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-white border-slate-200 text-slate-900">
          <DialogHeader>
            <DialogTitle className="hero-text">Create New API Key</DialogTitle>
            <DialogDescription className="hero-text-muted">
              Configure limits and rate controls for this key.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="kn" className="hero-text">Key Name</Label>
              <Input
                id="kn"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Production API"
                className="bg-white border-slate-200 hero-text"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mc" className="hero-text">Max Concurrent</Label>
                <Input
                  id="mc"
                  type="number"
                  min={1}
                  max={100}
                  value={maxConc}
                  onChange={(e) => setMaxConc(+e.target.value)}
                  className="bg-white border-slate-200 hero-text"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="to" className="hero-text">Timeout (s)</Label>
                <Input
                  id="to"
                  type="number"
                  min={1}
                  max={300}
                  value={timeout_}
                  onChange={(e) => setTimeout_(+e.target.value)}
                  className="bg-white border-slate-200 hero-text"
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3 bg-slate-50">
              <div>
                <Label htmlFor="rl" className="hero-text">Rate Limited</Label>
                <p className="text-xs hero-text-muted">Limit requests per minute</p>
              </div>
              <Switch id="rl" checked={rateLimited} onCheckedChange={setRateLimited} />
            </div>
            {rateLimited && (
              <div className="space-y-2">
                <Label htmlFor="r" className="hero-text">Max requests / minute</Label>
                <Input
                  id="r"
                  type="number"
                  min={1}
                  value={rate}
                  onChange={(e) => setRate(+e.target.value)}
                  className="bg-white border-slate-200 hero-text"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              className="hero-text hover:bg-slate-100"
            >
              Cancel
            </Button>
            <Button
              onClick={create}
              disabled={creating}
              className="bg-gradient-primary text-white hover:opacity-90 shadow-primary"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Show full key once after creation */}
      <Dialog open={!!createdKey} onOpenChange={(v) => !v && setCreatedKey(null)}>
        <DialogContent className="bg-white border-slate-200 text-slate-900">
          <DialogHeader>
            <DialogTitle className="hero-text">API Key Created</DialogTitle>
            <DialogDescription className="text-amber-600">
              Save this key somewhere safe — you won't see it again.
            </DialogDescription>
          </DialogHeader>
          {createdKey && (
            <div className="space-y-2">
              <Label className="hero-text">{createdKey.name}</Label>
              <div className="flex gap-2">
                <code className="flex-1 px-3 py-2 rounded-md bg-slate-50 border border-slate-200 font-mono text-xs break-all hero-text">
                  {createdKey.key}
                </code>
                <Button
                  onClick={() => copy(createdKey.key)}
                  variant="outline"
                  className="border-slate-200"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              onClick={() => setCreatedKey(null)}
              className="bg-gradient-primary text-white shadow-primary"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!revokeId} onOpenChange={(v) => !v && setRevokeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this API key?</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately invalidate the key.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={revoke}
              className="bg-destructive text-destructive-foreground"
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this API key?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={del} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
