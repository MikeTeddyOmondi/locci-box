import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/lib/auth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Play,
  Save,
  Share2,
  Download,
  FileCode2,
  Plus,
  X,
  Folder,
  FolderOpen,
  FileText,
  Loader2,
  Terminal,
  Clock,
  Cpu,
  Command,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiClient } from "@/integrations/api/client";

export const Route = createFileRoute("/code")({
  head: () => ({ meta: [{ title: "Code Editor — Locci Box" }] }),
  component: Page,
});

type Lang = "python" | "javascript" | "typescript" | "bash" | "ruby";
const langExt: Record<Lang, string> = {
  python: "py",
  javascript: "js",
  typescript: "ts",
  bash: "sh",
  ruby: "rb",
};

type FileEntry = { id: string; name: string; lang: Lang; content: string };

const seed: FileEntry[] = [
  {
    id: "f1",
    name: "main.py",
    lang: "python",
    content: `# Welcome to Locci Box Code Editor
# Full IDE running in an isolated microVM

def fibonacci(n: int) -> int:
    """Compute Fibonacci numbers iteratively."""
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a

if __name__ == "__main__":
    for i in range(10):
        print(f"fib({i}) = {fibonacci(i)}")
`,
  },
  {
    id: "f2",
    name: "utils.py",
    lang: "python",
    content: `def chunk(items, size):
    return [items[i:i + size] for i in range(0, len(items), size)]

# ...other code
chunks = chunk([1,2,3,4,5,6], 2)
print(chunks)
`,
  },
  {
    id: "f3",
    name: "server.js",
    lang: "javascript",
    content: `import http from "node:http";

const server = http.createServer((req, res) => {
  res.end(JSON.stringify({ ok: true, path: req.url }));
});

server.listen(3000, () => console.log("listening on :3000"));
`,
  },
];

function defineLightTheme(monaco: any) {
  monaco.editor.defineTheme("sandbox-light", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "comment", foreground: "94a3b8", fontStyle: "italic" },
      { token: "keyword", foreground: "8b5cf6", fontStyle: "bold" },
      { token: "string", foreground: "10b981" },
      { token: "number", foreground: "f59e0b" },
      { token: "type", foreground: "06b6d4" },
    ],
    colors: {
      "editor.background": "#ffffff",
      "editor.foreground": "#1e293b",
      "editorLineNumber.foreground": "#cbd5e1",
      "editorLineNumber.activeForeground": "#3b82f6",
      "editor.lineHighlightBackground": "#f8fafc",
      "editor.selectionBackground": "#dbeafe",
      "editorCursor.foreground": "#3b82f6",
      "editorIndentGuide.background": "#f1f5f9",
    },
  });
}

const sampleOutput = (lang: Lang): string => {
  if (lang === "python") {
    return [
      "fib(0) = 0",
      "fib(1) = 1",
      "fib(2) = 1",
      "fib(3) = 2",
      "fib(4) = 3",
      "fib(5) = 5",
      "fib(6) = 8",
      "fib(7) = 13",
      "fib(8) = 21",
      "fib(9) = 34",
    ].join("\n");
  }
  if (lang === "javascript" || lang === "typescript") return "listening on :3000";
  if (lang === "bash") return "hello from bash";
  return "ok";
};

function Page() {
  const { user } = useAuth();
  const [files, setFiles] = useState<FileEntry[]>(seed);
  const [activeId, setActiveId] = useState<string>(seed[0].id);
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState<{ stdout: string; ms: number; exit: number } | null>(null);
  const [autosave, setAutosave] = useState(true);
  const [savedAt, setSavedAt] = useState<string | null>("just now");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [termInput, setTermInput] = useState("");
  const [termHistory, setTermHistory] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const active = files.find((f) => f.id === activeId) ?? files[0];

  const startRename = (f: FileEntry, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(f.id);
    setEditingName(f.name);
    setTimeout(() => renameInputRef.current?.select(), 0);
  };

  const commitRename = () => {
    const name = editingName.trim();
    if (name && editingId) {
      setFiles((fs) => fs.map((f) => (f.id === editingId ? { ...f, name } : f)));
    }
    setEditingId(null);
  };

  const cancelRename = () => setEditingId(null);

  const updateContent = (val: string) => {
    setFiles((fs) => fs.map((f) => (f.id === activeId ? { ...f, content: val } : f)));
    if (autosave) {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => setSavedAt("just now"), 800);
    }
  };

  const newFile = () => {
    const id = `f${Date.now()}`;
    const n = files.filter((f) => f.lang === "python").length + 1;
    const file: FileEntry = {
      id,
      name: `untitled-${n}.py`,
      lang: "python",
      content: "# new file\n",
    };
    setFiles((fs) => [...fs, file]);
    setActiveId(id);
    toast.success("New file created");
  };

  const closeFile = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (files.length === 1) return toast.error("Keep at least one file open");
    const idx = files.findIndex((f) => f.id === id);
    const next = files.filter((f) => f.id !== id);
    setFiles(next);
    if (activeId === id) setActiveId(next[Math.max(0, idx - 1)].id);
  };

  const changeLang = (l: Lang) => {
    setFiles((fs) =>
      fs.map((f) =>
        f.id === activeId
          ? { ...f, lang: l, name: f.name.replace(/\.[^.]+$/, "") + "." + langExt[l] }
          : f,
      ),
    );
  };

  const apiLang = (l: Lang): "python" | "node" | "bash" | "ruby" => {
    if (l === "javascript" || l === "typescript") return "node";
    if (l === "bash") return "bash";
    if (l === "ruby") return "ruby";
    return "python";
  };

  const run = async () => {
    if (running) return;
    setRunning(true);
    setOutput(null);
    try {
      const result = await apiClient.runSandbox({
        language: apiLang(active.lang),
        code: active.content,
      });
      setOutput({
        stdout: result.stdout + (result.stderr ? `\n[stderr]\n${result.stderr}` : ""),
        ms: result.duration_ms,
        exit: result.exit_code,
      });
      if (result.exit_code === 0) toast.success(`Executed in ${result.duration_ms}ms`);
      else toast.error(`Exited with code ${result.exit_code}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Execution failed";
      setOutput({ stdout: msg, ms: 0, exit: 1 });
      toast.error(msg);
    } finally {
      setRunning(false);
    }
  };

  const save = () => {
    setSavedAt("just now");
    toast.success(`${active.name} saved`);
  };
  const share = () => {
    navigator.clipboard.writeText(`https://box.locci.cloud/s/${active.id}`);
    toast.success("Share link copied");
  };
  const download = () => {
    const blob = new Blob([active.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = active.name;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded");
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        run();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        save();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  if (!user) return <Navigate to="/login" />;

  return (
    <AppLayout>
      <div className="bg-locci-gradient">
        <div className="p-3 sm:p-4 lg:p-6 max-w-[1600px] mx-auto w-full">
          {/* IDE shell */}
          <div className="hero-white overflow-hidden flex flex-col lg:flex-row h-[calc(100vh-9rem)] min-h-[640px] rounded-xl border border-slate-200 shadow-sm animate-fade-up">
            {/* File tree */}
            <aside className="w-full lg:w-60 hero-soft border-b lg:border-b-0 lg:border-r hero-divider flex flex-col">
              <div className="px-4 py-3 border-b hero-divider flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-blue-500" />
                  <span className="text-xs font-semibold hero-text uppercase tracking-wider">
                    Project
                  </span>
                </div>
                <button
                  onClick={newFile}
                  className="w-6 h-6 rounded-md hover:bg-slate-200 flex items-center justify-center hero-text-muted hover:hero-text transition-colors"
                  title="New file"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex-1 overflow-auto py-2">
                <div className="px-3 flex items-center gap-1.5 text-xs hero-text-muted font-medium py-1">
                  <Folder className="w-3.5 h-3.5 text-blue-500" /> sandbox
                </div>
                <div className="pl-4">
                  {files.map((f) => (
                    <div
                      key={f.id}
                      onClick={() => setActiveId(f.id)}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-1.5 text-xs font-mono group transition-colors cursor-pointer",
                        activeId === f.id
                          ? "bg-blue-50 text-blue-700 border-r-2 border-blue-500"
                          : "hero-text-muted hover:bg-slate-100 hover:hero-text",
                      )}
                    >
                      <FileText className="w-3.5 h-3.5 shrink-0" />
                      {editingId === f.id ? (
                        <input
                          ref={renameInputRef}
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onBlur={commitRename}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); commitRename(); }
                            if (e.key === "Escape") { e.preventDefault(); cancelRename(); }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          aria-label="Rename file"
                          className="flex-1 min-w-0 bg-white border border-blue-400 rounded px-1 outline-none text-xs font-mono text-slate-800"
                          autoFocus
                        />
                      ) : (
                        <span
                          className="truncate flex-1 text-left"
                          onDoubleClick={(e) => startRename(f, e)}
                          title="Double-click to rename"
                        >
                          {f.name}
                        </span>
                      )}
                      <X
                        onClick={(e) => closeFile(f.id, e)}
                        className="w-3 h-3 opacity-0 group-hover:opacity-60 hover:opacity-100 hover:text-red-500 shrink-0"
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="px-4 py-3 border-t hero-divider text-[11px] hero-text-muted space-y-1.5">
                <div className="flex items-center gap-2">
                  <Cpu className="w-3 h-3" /> microVM · 2 vCPU · 4GB
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-3 h-3" /> {savedAt ? `saved ${savedAt}` : "unsaved"}
                </div>
              </div>
            </aside>

            {/* Editor + output */}
            <div className="flex-1 min-w-0 flex flex-col">
              {/* Tab strip */}
              <div className="border-b hero-divider hero-soft flex items-center overflow-x-auto">
                {files.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setActiveId(f.id)}
                    className={cn(
                      "group flex items-center gap-2 px-4 py-2.5 text-xs font-mono border-r hero-divider whitespace-nowrap transition-colors",
                      activeId === f.id
                        ? "bg-white hero-text border-b-2 border-b-blue-500 -mb-px"
                        : "hero-text-muted hover:bg-slate-100",
                    )}
                  >
                    <FileCode2 className="w-3.5 h-3.5 text-blue-500" />
                    {f.name}
                    <X
                      onClick={(e) => closeFile(f.id, e)}
                      className="w-3 h-3 opacity-40 hover:opacity-100 hover:text-red-500"
                    />
                  </button>
                ))}
                <div className="flex-1" />
                <div className="flex items-center gap-1 px-2 shrink-0">
                  <Select value={active.lang} onValueChange={(v) => changeLang(v as Lang)}>
                    <SelectTrigger className="h-8 w-32 text-xs hero-text border-slate-200 bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="python">Python</SelectItem>
                      <SelectItem value="javascript">JavaScript</SelectItem>
                      <SelectItem value="typescript">TypeScript</SelectItem>
                      <SelectItem value="bash">Bash</SelectItem>
                      <SelectItem value="ruby">Ruby</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="w-px h-5 bg-slate-200 mx-1" />
                  <button
                    onClick={run}
                    disabled={running}
                    title="Run code (⌘/Ctrl + Enter)"
                    aria-label="Run code"
                    className="w-8 h-8 rounded-md text-emerald-600 hover:bg-emerald-50 flex items-center justify-center disabled:opacity-60"
                  >
                    {running ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    onClick={save}
                    title="Save file (⌘/Ctrl + S)"
                    aria-label="Save file"
                    className="inline-flex items-center gap-1.5 h-8 px-2 rounded-md hero-text hover:bg-slate-100"
                  >
                    <Save className="w-3.5 h-3.5" /> <span className="text-xs">Save</span>
                  </button>
                  <button
                    onClick={share}
                    title="Share file"
                    aria-label="Share file"
                    className="inline-flex items-center gap-1.5 h-8 px-2 rounded-md hero-text hover:bg-slate-100"
                  >
                    <Share2 className="w-3.5 h-3.5" /> <span className="text-xs">Share</span>
                  </button>
                  <button
                    onClick={download}
                    title="Download file"
                    aria-label="Download file"
                    className="w-8 h-8 rounded-md hero-text hover:bg-slate-100 flex items-center justify-center"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setPaletteOpen(true)}
                    title="Command palette (⌘/Ctrl + K)"
                    aria-label="Command palette"
                    className="w-8 h-8 rounded-md hero-text hover:bg-slate-100 flex items-center justify-center"
                  >
                    <Command className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Editor */}
              <div className="flex-1 min-h-0 grid grid-rows-[1.6fr_1fr]">
                <div className="min-h-0">
                  <Editor
                    height="100%"
                    language={active.lang}
                    theme="sandbox-light"
                    value={active.content}
                    beforeMount={defineLightTheme}
                    onChange={(v) => updateContent(v ?? "")}
                    options={{
                      readOnly: false,
                      fontSize: 13,
                      fontFamily: "Monaco, 'Courier New', monospace",
                      minimap: { enabled: true },
                      tabSize: 2,
                      automaticLayout: true,
                      scrollBeyondLastLine: false,
                      padding: { top: 16, bottom: 16 },
                      renderLineHighlight: "all",
                    }}
                  />
                </div>

                {/* Terminal output */}
                <div className="border-t hero-divider hero-soft flex flex-col min-h-0">
                  <div className="px-4 py-2 border-b hero-divider flex items-center gap-3 text-xs">
                    <div className="flex items-center gap-1.5 hero-text font-semibold">
                      <Terminal className="w-3.5 h-3.5" /> Terminal
                    </div>
                    {output && (
                      <>
                        <span className="text-emerald-600 font-medium">exit {output.exit}</span>
                        <span className="hero-text-muted inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {output.ms}ms
                        </span>
                      </>
                    )}
                    <div className="flex-1" />
                    <label className="flex items-center gap-1.5 hero-text-muted text-[11px]">
                      <input
                        type="checkbox"
                        checked={autosave}
                        onChange={(e) => setAutosave(e.target.checked)}
                        className="accent-blue-500"
                      />
                      Autosave
                    </label>
                  </div>
                  <div
                    className="flex-1 min-h-0 overflow-auto p-4 font-mono text-xs leading-relaxed hero-text bg-white cursor-text"
                    onClick={(e) => {
                      const ta = e.currentTarget.querySelector(
                        "textarea",
                      ) as HTMLTextAreaElement | null;
                      ta?.focus();
                    }}
                  >
                    <pre className="whitespace-pre-wrap">
                      <span className="hero-text-muted">$ run {active.name}</span>
                      {"\n"}
                      {running && (
                        <span className="text-blue-500 inline-flex items-center gap-1.5">
                          <Loader2 className="w-3 h-3 animate-spin" /> spinning microVM…
                        </span>
                      )}
                      {output && (
                        <>
                          <span>{output.stdout}</span>
                          {"\n"}
                          <span className="hero-text-muted">
                            [process exited {output.exit} · {output.ms}ms]
                          </span>
                          {"\n"}
                        </>
                      )}
                      {termHistory.map((line, i) => (
                        <span key={i}>
                          <span className="text-blue-500">$</span> {line}
                          {"\n"}
                        </span>
                      ))}
                    </pre>
                    <div className="flex items-start gap-2 mt-1">
                      <span className="text-blue-500 select-none">$</span>
                      <textarea
                        value={termInput}
                        onChange={(e) => setTermInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            const cmd = termInput.trim();
                            if (cmd) {
                              setTermHistory((h) => [...h, cmd]);
                              setTermInput("");
                            }
                          }
                        }}
                        rows={1}
                        spellCheck={false}
                        placeholder="Type a command or code and press Enter…"
                        className="flex-1 resize-none bg-transparent outline-none border-0 font-mono text-xs hero-text placeholder:hero-text-muted"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Command palette */}
      <Dialog open={paletteOpen} onOpenChange={setPaletteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Command className="w-4 h-4" /> Command palette
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-1">
            {[
              {
                icon: Play,
                label: "Run code",
                kbd: "⌘ ↵",
                action: () => {
                  setPaletteOpen(false);
                  run();
                },
              },
              {
                icon: Save,
                label: "Save file",
                kbd: "⌘ S",
                action: () => {
                  setPaletteOpen(false);
                  save();
                },
              },
              {
                icon: Plus,
                label: "New file",
                kbd: "",
                action: () => {
                  setPaletteOpen(false);
                  newFile();
                },
              },
              {
                icon: Share2,
                label: "Share file",
                kbd: "",
                action: () => {
                  setPaletteOpen(false);
                  share();
                },
              },
              {
                icon: Download,
                label: "Download file",
                kbd: "",
                action: () => {
                  setPaletteOpen(false);
                  download();
                },
              },
            ].map((c) => (
              <button
                key={c.label}
                onClick={c.action}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-slate-100 text-left"
              >
                <c.icon className="w-4 h-4 text-blue-500" />
                <span className="flex-1">{c.label}</span>
                {c.kbd && <span className="text-xs font-mono text-slate-400">{c.kbd}</span>}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
