import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Boxes, ChevronDown, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — Locci Box" },
      { name: "description", content: "Answers to common questions about Locci Box enterprise microVM sandboxes." },
      { property: "og:title", content: "FAQ — Locci Box" },
      { property: "og:description", content: "Answers to common questions about Locci Box enterprise microVM sandboxes." },
    ],
  }),
  component: FaqPage,
});

const FAQS: { q: string; a: string }[] = [
  {
    q: "Quick start — how do I run my first sandbox?",
    a: "1) Create an API key from the API Keys page. 2) Send a POST to https://api.sandboxapi.com/api/sandbox/run with your language and code, using Authorization: Bearer YOUR_API_KEY. 3) The response includes the sandbox id, stdout, exit code, and duration. You can also run code directly from the in-app Code or Playground pages without any setup.",
  },
  {
    q: "Who is Locci Box for?",
    a: "Locci Box is an enterprise-only platform for organizations running untrusted code or AI agents. Personal accounts and free email providers are not supported — sign-in requires a corporate email.",
  },
  {
    q: "What is a microVM sandbox?",
    a: "Each workload runs inside a hardware-isolated micro virtual machine. Network, memory, and CPU are partitioned at the hypervisor level, so a compromised process cannot reach your host OS or other tenants.",
  },
  {
    q: "How fast do sandboxes start?",
    a: "Cold-start is in the low hundreds of milliseconds. Warm sandboxes resume in tens of milliseconds, which is fast enough to spin up a fresh environment per agent action.",
  },
  {
    q: "Is my code or data ever shared with other tenants?",
    a: "No. Every microVM is single-tenant by design. We do not train models on your code, and audit logs record every privileged operation.",
  },
  {
    q: "Which compliance standards do you meet?",
    a: "SOC 2 Type II is in place today. GDPR data-processing agreements are available on request. HIPAA and FedRAMP Moderate are on the public roadmap.",
  },
  {
    q: "How do we sign in?",
    a: "Enterprise SSO (SAML, Google Workspace, Microsoft Entra ID) is the recommended path. Email + password is available as a fallback for evaluation workspaces using a corporate domain.",
  },
  {
    q: "Can we try it before contracting?",
    a: "Yes. Use the Demo button on the home page to explore a fully populated workspace with sample data. No signup is required and nothing is written back to your tenant.",
  },
  {
    q: "How does pricing work?",
    a: "Pricing is based on concurrent microVMs and total vCPU-hours, with volume discounts for committed annual usage. Contact us for a tailored quote.",
  },
  {
    q: "How do we get support?",
    a: "All enterprise plans include a shared Slack or Teams channel with our platform engineers, plus a 24×7 on-call rotation for severity-1 incidents.",
  },
];

function FaqPage() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="min-h-screen w-full" style={{ background: "#e8f4f9" }}>
      <header
        className="mx-auto max-w-[1400px] flex items-center justify-between px-4 sm:px-6 md:px-10 h-16 sm:h-20 rounded-2xl mt-3 sm:mt-4"
        style={{ background: "#ffffff", boxShadow: "0 2px 8px rgba(15,42,75,0.06)" }}
      >
        <Link to="/" className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg,#4a5ed8,#6b7fd9)" }}>
            <Boxes className="w-5 h-5" style={{ color: "#fff" }} />
          </div>
          <span className="font-bold tracking-tight text-base sm:text-lg truncate" style={{ color: "#1a3a52" }}>Locci Box</span>
        </Link>
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium hover:opacity-70" style={{ color: "#1a3a52" }}>
          <ArrowLeft className="w-4 h-4" /> Back to home
        </Link>
      </header>

      <section
        className="mx-auto max-w-[1400px] mt-6 sm:mt-8 rounded-2xl sm:rounded-[28px] px-6 sm:px-10 lg:px-14 py-10 sm:py-14"
        style={{ background: "radial-gradient(ellipse 60% 55% at 55% 50%, rgba(120,170,140,0.55), rgba(120,170,140,0) 65%), linear-gradient(135deg,#4a5ed8,#6b7fd9)" }}
      >
        <div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-semibold tracking-[0.14em] mb-5"
          style={{ background: "rgba(255,255,255,0.15)", color: "#fff", border: "1px solid rgba(255,255,255,0.25)" }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#fff" }} />
          FREQUENTLY ASKED
        </div>
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight" style={{ color: "#fff" }}>
          Questions, answered.
        </h1>
        <p className="text-sm sm:text-base mt-4 max-w-2xl" style={{ color: "rgba(255,255,255,0.88)" }}>
          Everything teams typically ask before rolling Locci Box into production. Need something we missed? Reach your account contact.
        </p>
      </section>

      <section className="mx-auto max-w-[1000px] mt-8 px-2 sm:px-4 space-y-3">
        {FAQS.map((item, i) => {
          const isOpen = open === i;
          return (
            <div
              key={item.q}
              className="rounded-2xl overflow-hidden transition-all"
              style={{ background: "#ffffff", boxShadow: "0 4px 14px rgba(15,42,75,0.06)", border: "1px solid rgba(15,42,75,0.06)" }}
            >
              <button
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                className="w-full flex items-center justify-between gap-4 px-5 sm:px-7 py-5 text-left"
              >
                <span className="text-sm sm:text-base font-semibold" style={{ color: "#1a3a52" }}>{item.q}</span>
                <ChevronDown
                  className="w-4 h-4 shrink-0 transition-transform"
                  style={{ color: "#4a5ed8", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                />
              </button>
              {isOpen && (
                <div className="px-5 sm:px-7 pb-5 -mt-1 text-sm leading-relaxed" style={{ color: "#3a5470" }}>
                  {item.a}
                </div>
              )}
            </div>
          );
        })}
      </section>

      <footer
        className="mx-auto max-w-[1400px] mt-10 mb-6 rounded-2xl px-10 py-8"
        style={{ background: "radial-gradient(ellipse 55% 80% at 50% 50%, rgba(120,170,140,0.5), rgba(120,170,140,0) 70%), linear-gradient(135deg,#4a5ed8,#6b7fd9)" }}
      >
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs" style={{ color: "rgba(255,255,255,0.85)" }}>
          <span>© 2026 Locci Box. All rights reserved.</span>
          <Link to="/" className="hover:text-white">Back to home</Link>
        </div>
      </footer>
    </div>
  );
}