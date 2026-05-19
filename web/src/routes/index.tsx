import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Boxes, ArrowRight, BookOpen, Layers, Shield, Server, Github, Twitter, Terminal, Download, Copy } from "lucide-react";
import { toast } from "sonner";

const REPO = "MikeTeddyOmondi/locci-box";
const LATEST = `https://github.com/${REPO}/releases/latest/download`;

const binaries = [
  { platform: "Linux", arch: "x64", file: "loccibox-linux-x64", icon: "🐧" },
  { platform: "Linux", arch: "arm64", file: "loccibox-linux-arm64", icon: "🐧" },
  { platform: "macOS", arch: "arm64", file: "loccibox-macos-arm64", icon: "🍎" },
  { platform: "Windows", arch: "x64", file: "loccibox-windows-x64.exe", icon: "🪟" },
  { platform: "Windows", arch: "arm64", file: "loccibox-windows-arm64.exe", icon: "🪟" },
];

const dockerSnippet = `docker pull locci/box-cli:latest
docker run --rm \\
  -e LOCCIBOX_API_URL=https://box.locci.cloud \\
  -e LOCCIBOX_API_KEY=lbk_live_... \\
  locci/box-cli:latest --help`;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Locci Box — Every agent deserves its own computer" },
      {
        name: "description",
        content:
          "Hardware-isolated microVMs for safe code execution. Dual sandbox testing for AI agents.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { user, loginDemo } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/dashboard" });
  }, [user, navigate]);

  const enterDemo = async () => {
    setSubmitting(true);
    try {
      await loginDemo();
      toast.success("Demo mode activated");
      navigate({ to: "/dashboard" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Demo failed";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full" style={{ background: "#e8f4f9" }}>
      {/* Top Nav */}
      <header
        className="mx-auto max-w-[1400px] flex items-center justify-between px-4 sm:px-6 md:px-10 h-16 sm:h-20 rounded-2xl mt-3 sm:mt-4"
        style={{ background: "#ffffff", boxShadow: "0 2px 8px rgba(15,42,75,0.06)" }}
      >
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg,#4a5ed8,#6b7fd9)" }}
          >
            <Boxes className="w-5 h-5" style={{ color: "#fff" }} />
          </div>
          <span
            className="font-bold tracking-tight text-base sm:text-lg truncate"
            style={{ color: "#1a3a52" }}
          >
            Locci Box
          </span>
        </div>

        <nav
          className="hidden lg:flex items-center gap-10 text-sm font-medium"
          style={{ color: "#1a3a52" }}
        >
          <a href="#" className="hover:opacity-70">
            Documentation
          </a>
          <a href="#" className="hover:opacity-70">
            Pricing
          </a>
          <a href="#" className="hover:opacity-70">
            Use Cases
          </a>
        </nav>

        <div className="flex items-center gap-2 sm:gap-4">
          <Link to="/login" className="text-sm font-medium px-2 py-1" style={{ color: "#1a3a52" }}>
            Sign In
          </Link>
          <Link
            to="/login"
            className="px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-all hover:-translate-y-0.5 whitespace-nowrap"
            style={{
              background: "#3b82f6",
              color: "#fff",
              boxShadow: "0 4px 12px rgba(59,130,246,0.30)",
            }}
          >
            Request Access
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section
        className="mx-auto max-w-[1400px] mt-6 sm:mt-8 rounded-2xl sm:rounded-[28px] px-6 sm:px-10 lg:px-14 py-10 sm:py-14 lg:py-20 grid lg:grid-cols-2 gap-10 lg:gap-12 items-center"
        style={{
          background:
            "radial-gradient(ellipse 60% 55% at 55% 50%, rgba(120,170,140,0.55), rgba(120,170,140,0) 65%), linear-gradient(135deg,#4a5ed8,#6b7fd9)",
        }}
      >
        <div className="space-y-7 animate-fade-up">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-semibold tracking-[0.14em]"
            style={{
              background: "rgba(255,255,255,0.15)",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.25)",
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#fff" }} />
            V2.0 ARCHITECTURE LIVE
          </div>
          <h1
            className="text-3xl sm:text-5xl lg:text-6xl font-bold leading-[1.1] tracking-tight"
            style={{ color: "#fff" }}
          >
            Every agent deserves its own computer
          </h1>
          <p
            className="text-sm sm:text-base lg:text-lg max-w-xl leading-relaxed"
            style={{ color: "rgba(255,255,255,0.88)" }}
          >
            Hardware-isolated microVMs for safe code execution. Deploy untrusted workloads with
            zero-trust infrastructure in milliseconds.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-5 sm:px-7 py-3 sm:py-3.5 rounded-lg text-sm font-semibold transition-all hover:-translate-y-0.5"
              style={{ background: "#fff", color: "#4a5ed8", border: "2px solid #fff" }}
            >
              Get Started <ArrowRight className="w-4 h-4" />
            </Link>
            <button
              onClick={enterDemo}
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 sm:px-7 py-3 sm:py-3.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
              style={{
                background: "rgba(255,255,255,0.18)",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.4)",
              }}
            >
              <BookOpen className="w-4 h-4" /> {submitting ? "Loading..." : "Try Demo"}
            </button>
          </div>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.8)" }}>
            Already have an account?{" "}
            <Link to="/login" className="underline font-semibold" style={{ color: "#fff" }}>
              Sign in
            </Link>
          </p>
        </div>

        {/* Hero visual */}
        <div className="hidden lg:flex items-center justify-center">
          <div
            className="w-full max-w-md aspect-square rounded-2xl flex items-center justify-center"
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.2)",
              backdropFilter: "blur(8px)",
            }}
          >
            <div className="text-center space-y-4">
              <Boxes className="w-20 h-20 mx-auto" style={{ color: "rgba(255,255,255,0.8)" }} />
              <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.9)" }}>
                Secure Code Execution
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature cards */}
      <section className="mx-auto max-w-[1400px] mt-8 grid md:grid-cols-3 gap-6 px-2">
        {[
          {
            Icon: Layers,
            title: "Dual Sandbox Testing",
            desc: "Run untrusted code in parallel environments. Compare outputs instantly with zero risk to your primary infrastructure or host OS.",
          },
          {
            Icon: Shield,
            title: "Complete Isolation",
            desc: "Hardware-enforced boundaries ensure absolute separation. Network, memory, and CPU are rigidly partitioned per microVM instance.",
          },
          {
            Icon: Server,
            title: "Enterprise Security",
            desc: "SOC2 Type II certified infrastructure. Granular RBAC, audit logging, and automated compliance reporting built into the core.",
          },
        ].map(({ Icon, title, desc }) => (
          <div
            key={title}
            className="rounded-2xl p-8 min-h-[260px] flex flex-col transition-transform hover:-translate-y-1"
            style={{
              background:
                "radial-gradient(ellipse 70% 65% at 55% 50%, rgba(120,170,140,0.55), rgba(120,170,140,0) 70%), linear-gradient(135deg,#4a5ed8,#6b7fd9)",
              boxShadow: "0 8px 24px rgba(15,42,75,0.12)",
            }}
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mb-6"
              style={{
                background: "rgba(255,255,255,0.18)",
                border: "1px solid rgba(255,255,255,0.25)",
              }}
            >
              <Icon className="w-5 h-5" style={{ color: "#fff" }} />
            </div>
            <h3 className="text-xl font-bold mb-3" style={{ color: "#fff" }}>
              {title}
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.85)" }}>
              {desc}
            </p>
          </div>
        ))}
      </section>

      {/* CLI Downloads */}
      <section className="mx-auto max-w-[1400px] mt-8 px-2">
        <div
          className="rounded-2xl p-6 sm:p-8"
          style={{
            background:
              "radial-gradient(ellipse 60% 55% at 55% 50%, rgba(120,170,140,0.45), rgba(120,170,140,0) 65%), linear-gradient(135deg,#4a5ed8,#6b7fd9)",
            boxShadow: "0 8px 24px rgba(15,42,75,0.12)",
          }}
        >
          <div className="flex items-center gap-3 mb-6">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.25)" }}
            >
              <Terminal className="w-5 h-5" style={{ color: "#fff" }} />
            </div>
            <div>
              <h2 className="text-xl font-bold" style={{ color: "#fff" }}>
                Get the CLI
              </h2>
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.75)" }}>
                Run code in isolated sandboxes from your terminal
              </p>
            </div>
          </div>

          {/* Docker */}
          <div className="relative mb-6">
            <pre
              className="rounded-xl p-4 text-sm font-mono overflow-x-auto whitespace-pre"
              style={{ background: "rgba(0,0,0,0.3)", color: "rgba(255,255,255,0.9)" }}
            >
              {dockerSnippet}
            </pre>
            <button
              type="button"
              onClick={() => { navigator.clipboard.writeText(dockerSnippet); toast.success("Docker command copied"); }}
              className="absolute top-2 right-2 w-7 h-7 rounded-md flex items-center justify-center transition-colors"
              style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" }}
              title="Copy"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Binary table */}
          <div className="rounded-xl overflow-x-auto" style={{ background: "rgba(255,255,255,0.1)" }}>
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.55)" }}>Platform</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.55)" }}>Arch</th>
                  <th className="px-5 py-2.5 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.55)" }}>Download</th>
                </tr>
              </thead>
              <tbody>
                {binaries.map((b, i) => (
                  <tr
                    key={b.file}
                    style={{ borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.08)" }}
                  >
                    <td className="px-5 py-3 font-medium" style={{ color: "#fff" }}>
                      <span className="mr-2">{b.icon}</span>{b.platform}
                    </td>
                    <td className="px-5 py-3 text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>{b.arch}</td>
                    <td className="px-5 py-3 text-right">
                      <a
                        href={`${LATEST}/${b.file}`}
                        download
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90"
                        style={{ background: "rgba(255,255,255,0.18)", color: "#fff", border: "1px solid rgba(255,255,255,0.25)" }}
                      >
                        <Download className="w-3 h-3" /> Download
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 text-right">
            <Link
              to="/downloads"
              className="text-sm underline underline-offset-2 hover:opacity-100 transition-opacity"
              style={{ color: "rgba(255,255,255,0.7)" }}
            >
              Full download options &amp; GPG verification →
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="mx-auto max-w-[1400px] mt-10 mb-6 rounded-2xl px-10 py-8"
        style={{
          background:
            "radial-gradient(ellipse 55% 80% at 50% 50%, rgba(120,170,140,0.5), rgba(120,170,140,0) 70%), linear-gradient(135deg,#4a5ed8,#6b7fd9)",
        }}
      >
        <div className="flex flex-col md:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.18)" }}
            >
              <Boxes className="w-4 h-4" style={{ color: "#fff" }} />
            </div>
            <span className="text-sm font-semibold" style={{ color: "#fff" }}>
              Locci Box Inc.
            </span>
          </div>

          <nav
            className="flex items-center gap-8 text-sm"
            style={{ color: "rgba(255,255,255,0.85)" }}
          >
            <a href="#" className="hover:text-white">
              Documentation
            </a>
            <a href="#" className="hover:text-white">
              System Status
            </a>
            <Link to="/faq" className="hover:text-white">
              FAQ
            </Link>
            <a href="#" className="hover:text-white">
              Privacy Policy
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <a
              href="#"
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.18)" }}
            >
              <Github className="w-4 h-4" style={{ color: "#fff" }} />
            </a>
            <a
              href="#"
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.18)" }}
            >
              <Twitter className="w-4 h-4" style={{ color: "#fff" }} />
            </a>
          </div>
        </div>

        <div
          className="mt-6 pt-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs"
          style={{ borderTop: "1px solid rgba(255,255,255,0.18)", color: "rgba(255,255,255,0.75)" }}
        >
          <span>© 2026 Locci Box. All rights reserved.</span>
          <span className="inline-flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: "#22c55e" }} />
            Systems Operational
          </span>
        </div>
      </footer>
    </div>
  );
}

// Made with Bob
