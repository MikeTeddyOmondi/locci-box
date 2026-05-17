import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/lib/auth";
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
import { Copy, Plus, Trash2, Ban, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/keys")({
  head: () => ({ meta: [{ title: "API Keys — Locci Box" }] }),
  component: Page,
});

type ApiKey = {
  id: string;
  name: string;
  key: string;
  created: string;
  lastUsed: string;
  status: "active" | "revoked";
  rateLimit: number | null;
  maxConcurrent: number;
  timeout: number;
};

function genKey() {
  const r = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  return `sk_live_${r.slice(0, 32)}`;
}

const initial: ApiKey[] = [
  {
    id: "1",
    name: "Production API",
    key: genKey(),
    created: "May 12, 2026",
    lastUsed: "2 hours ago",
    status: "active",
    rateLimit: 100,
    maxConcurrent: 10,
    timeout: 30,
  },
  {
    id: "2",
    name: "Staging Tests",
    key: genKey(),
    created: "May 8, 2026",
    lastUsed: "1 day ago",
    status: "active",
    rateLimit: 60,
    maxConcurrent: 5,
    timeout: 30,
  },
  {
    id: "3",
    name: "Legacy CLI",
    key: genKey(),
    created: "Apr 21, 2026",
    lastUsed: "Never",
    status: "revoked",
    rateLimit: null,
    maxConcurrent: 3,
    timeout: 15,
  },
];

function Page() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" />;

  const [keys, setKeys] = useState<ApiKey[]>(initial);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [maxConc, setMaxConc] = useState(5);
  const [timeout_, setTimeout_] = useState(30);
  const [rateLimited, setRateLimited] = useState(true);
  const [rate, setRate] = useState(100);
  const [created, setCreated] = useState<ApiKey | null>(null);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const reset = () => {
    setName("");
    setMaxConc(5);
    setTimeout_(30);
    setRateLimited(true);
    setRate(100);
  };

  const create = () => {
    if (!name.trim()) {
      toast.error("Key name required");
      return;
    }
    const k: ApiKey = {
      id: String(Date.now()),
      name: name.trim(),
      key: genKey(),
      created: new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      lastUsed: "Never",
      status: "active",
      rateLimit: rateLimited ? rate : null,
      maxConcurrent: maxConc,
      timeout: timeout_,
    };
    setKeys((k0) => [k, ...k0]);
    setCreated(k);
    setOpen(false);
    reset();
    toast.success("API Key created successfully");
  };

  const copy = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success("Copied to clipboard");
  };
  const revoke = () => {
    if (!revokeId) return;
    setKeys((ks) => ks.map((k) => (k.id === revokeId ? { ...k, status: "revoked" } : k)));
    setRevokeId(null);
    toast.success("API Key revoked");
  };
  const del = () => {
    if (!deleteId) return;
    setKeys((ks) => ks.filter((k) => k.id !== deleteId));
    setDeleteId(null);
    toast.success("API Key deleted");
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
                          <div className="font-mono text-xs text-white/50">
                            {k.key.slice(0, 14)}…{k.key.slice(-4)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-white/70 whitespace-nowrap">
                      {k.created}
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-white/70 whitespace-nowrap">
                      {k.lastUsed}
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
        </div>
      </div>

      {/* Create modal — white hero */}
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
              <Label htmlFor="kn" className="hero-text">
                Key Name
              </Label>
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
                <Label htmlFor="mc" className="hero-text">
                  Max Concurrent
                </Label>
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
                <Label htmlFor="to" className="hero-text">
                  Timeout (s)
                </Label>
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
                <Label htmlFor="rl" className="hero-text">
                  Rate Limited
                </Label>
                <p className="text-xs hero-text-muted">Limit requests per minute</p>
              </div>
              <Switch id="rl" checked={rateLimited} onCheckedChange={setRateLimited} />
            </div>
            {rateLimited && (
              <div className="space-y-2">
                <Label htmlFor="r" className="hero-text">
                  Max requests / minute
                </Label>
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
              className="bg-gradient-primary text-white hover:opacity-90 shadow-primary"
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!created} onOpenChange={(v) => !v && setCreated(null)}>
        <DialogContent className="bg-white border-slate-200 text-slate-900">
          <DialogHeader>
            <DialogTitle className="hero-text">API Key Created</DialogTitle>
            <DialogDescription className="text-amber-600">
              Save this key somewhere safe — you won't see it again.
            </DialogDescription>
          </DialogHeader>
          {created && (
            <div className="space-y-2">
              <Label className="hero-text">{created.name}</Label>
              <div className="flex gap-2">
                <code className="flex-1 px-3 py-2 rounded-md bg-slate-50 border border-slate-200 font-mono text-xs break-all hero-text">
                  {created.key}
                </code>
                <Button
                  onClick={() => copy(created.key)}
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
              onClick={() => setCreated(null)}
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
