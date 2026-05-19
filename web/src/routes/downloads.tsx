import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { Download, Terminal, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/downloads")({
  head: () => ({ meta: [{ title: "Downloads — Locci Box" }] }),
  component: Page,
});

const REPO = "MikeTeddyOmondi/locci-box";
const LATEST = `https://github.com/${REPO}/releases/latest/download`;

const binaries = [
  { platform: "Linux", arch: "x64", file: "loccibox-linux-x64", icon: "🐧" },
  { platform: "Linux", arch: "arm64", file: "loccibox-linux-arm64", icon: "🐧" },
  { platform: "macOS", arch: "arm64 (Apple Silicon)", file: "loccibox-macos-arm64", icon: "🍎" },
  { platform: "Windows", arch: "x64", file: "loccibox-windows-x64.exe", icon: "🪟" },
  { platform: "Windows", arch: "arm64", file: "loccibox-windows-arm64.exe", icon: "🪟" },
];

const dockerSnippet = `docker pull locci/box-cli:latest
docker run --rm \\
  -e LOCCIBOX_API_URL=https://box.locci.cloud \\
  -e LOCCIBOX_API_KEY=lbk_live_... \\
  locci/box-cli:latest --help`;

const quickStart = `# Run Python code in an isolated sandbox
loccibox run --lang python --code "print('hello from locci box')"

# Run from a file
loccibox run --lang python --file script.py

# Set your API endpoint and key
loccibox config set api-url https://box.locci.cloud
loccibox config set api-key lbk_live_...`;

function copy(text: string, label: string) {
  navigator.clipboard.writeText(text);
  toast.success(`${label} copied`);
}

function Page() {
  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-10 space-y-8 max-w-5xl mx-auto w-full">
        <div className="animate-fade-up">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight">
            Downloads
          </h1>
          <p className="text-sm sm:text-base text-white/60 mt-2">
            Get the Locci Box CLI — run code in isolated sandboxes from your terminal.
          </p>
        </div>

        {/* Docker */}
        <div
          className="bg-locci-gradient rounded-2xl p-6 sm:p-8 animate-fade-up shadow-hero"
          style={{ animationDelay: "70ms" }}
        >
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <Terminal className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Docker</h2>
              <p className="text-sm text-white/70">Recommended — no install required</p>
            </div>
          </div>
          <div className="relative">
            <pre className="bg-black/30 rounded-xl p-4 text-sm font-mono text-white/90 overflow-x-auto whitespace-pre">
              {dockerSnippet}
            </pre>
            <Button
              size="sm"
              variant="ghost"
              className="absolute top-2 right-2 hover:bg-white/10 text-white/60 hover:text-white"
              onClick={() => copy(dockerSnippet, "Docker command")}
            >
              <Copy className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Binaries */}
        <div className="space-y-4 animate-fade-up" style={{ animationDelay: "140ms" }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-cyan-blue flex items-center justify-center shadow-lg">
              <Download className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold tracking-tight">Prebuilt Binaries</h2>
              <p className="text-sm text-white/60">
                Standalone executables from{" "}
                <a
                  href={`https://github.com/${REPO}/releases/latest`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/80 hover:text-white underline underline-offset-2"
                >
                  GitHub Releases
                </a>
              </p>
            </div>
          </div>

          <div className="glass rounded-2xl overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead className="bg-white/5">
                <tr className="text-left text-xs uppercase tracking-wider text-white/50">
                  <th className="px-6 py-3 font-medium">Platform</th>
                  <th className="px-6 py-3 font-medium">Architecture</th>
                  <th className="px-6 py-3 font-medium">File</th>
                  <th className="px-6 py-3 font-medium text-right">Download</th>
                </tr>
              </thead>
              <tbody>
                {binaries.map((b, i) => (
                  <tr
                    key={b.file}
                    className={cn(
                      "border-t border-white/5 hover:bg-white/5 transition-colors",
                      i === 0 && "border-t-0",
                    )}
                  >
                    <td className="px-6 py-4 font-medium">
                      <span className="mr-2">{b.icon}</span>
                      {b.platform}
                    </td>
                    <td className="px-6 py-4 text-white/70">{b.arch}</td>
                    <td className="px-6 py-4 font-mono text-xs text-white/60">{b.file}</td>
                    <td className="px-6 py-4 text-right">
                      <a href={`${LATEST}/${b.file}`} download>
                        <Button
                          size="sm"
                          className="bg-gradient-cyan-blue hover:opacity-90 text-white border-0 shadow-sm"
                        >
                          <Download className="w-3.5 h-3.5 mr-1.5" />
                          Download
                        </Button>
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-white/40 px-1">
            After downloading, make the binary executable:{" "}
            <code className="font-mono bg-white/5 px-1.5 py-0.5 rounded">
              chmod +x loccibox-linux-x64 && sudo mv loccibox-linux-x64 /usr/local/bin/loccibox
            </code>
          </p>
          <p className="text-xs text-white/40 px-1">
            <span className="text-white/60">🍎 macOS only:</span> remove the quarantine flag before running:{" "}
            <code className="font-mono bg-white/5 px-1.5 py-0.5 rounded">
              xattr -d com.apple.quarantine loccibox-macos-arm64
            </code>
          </p>
        </div>

        {/* Quick start */}
        <div className="space-y-3 animate-fade-up" style={{ animationDelay: "210ms" }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-teal-green flex items-center justify-center shadow-lg">
              <Terminal className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-xl font-extrabold tracking-tight">Quick Start</h2>
          </div>
          <div className="relative">
            <pre className="glass rounded-2xl p-5 text-sm font-mono text-white/80 overflow-x-auto whitespace-pre">
              {quickStart}
            </pre>
            <Button
              size="sm"
              variant="ghost"
              className="absolute top-2 right-2 hover:bg-white/10 text-white/60 hover:text-white"
              onClick={() => copy(quickStart, "Quick start")}
            >
              <Copy className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* GitHub Releases link */}
        <div className="animate-fade-up" style={{ animationDelay: "280ms" }}>
          <a
            href={`https://github.com/${REPO}/releases`}
            target="_blank"
            rel="noopener noreferrer"
            className="glass glass-hover rounded-2xl p-5 flex items-center justify-between group"
          >
            <div>
              <div className="font-semibold">All Releases</div>
              <div className="text-sm text-white/50 mt-0.5">
                View changelogs and previous versions on GitHub
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-white/40 group-hover:text-white transition-colors" />
          </a>
        </div>
      </div>
    </AppLayout>
  );
}
