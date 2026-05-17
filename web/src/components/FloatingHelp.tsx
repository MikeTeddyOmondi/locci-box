import { useEffect, useState } from "react";
import { HelpCircle, MessageSquare, BookOpen, Mail, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function FloatingHelp() {
  const [open, setOpen] = useState(false);
  const [liftPx, setLiftPx] = useState(0);

  useEffect(() => {
    const compute = () => {
      const footer = document.querySelector("footer");
      if (!footer) return setLiftPx(0);
      const rect = footer.getBoundingClientRect();
      const vh = window.innerHeight;
      // How many px of the footer are visible above the viewport bottom
      const overlap = Math.max(0, vh - rect.top);
      setLiftPx(overlap > 0 ? overlap + 12 : 0);
    };
    compute();
    window.addEventListener("scroll", compute, { passive: true });
    window.addEventListener("resize", compute);
    return () => {
      window.removeEventListener("scroll", compute);
      window.removeEventListener("resize", compute);
    };
  }, []);

  return (
    <div
      className="fixed right-5 sm:right-7 z-50 transition-[bottom] duration-200 ease-out"
      style={{ bottom: `calc(1.25rem + ${liftPx}px)` }}
    >
      {/* Popover panel */}
      <div
        className={cn(
          "absolute bottom-16 right-0 w-64 rounded-2xl p-2 origin-bottom-right transition-all duration-200",
          open
            ? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
            : "opacity-0 scale-95 translate-y-2 pointer-events-none"
        )}
        style={{
          background: "rgba(255,255,255,0.96)",
          backdropFilter: "blur(18px) saturate(140%)",
          WebkitBackdropFilter: "blur(18px) saturate(140%)",
          border: "1px solid rgba(224,242,254,0.9)",
          boxShadow: "0 20px 40px -12px rgba(15,42,75,0.25)",
        }}
      >
        <div className="px-3 py-2 flex items-center justify-between">
          <span className="text-xs font-semibold tracking-wide uppercase" style={{ color: "#1a3a52" }}>
            Need help?
          </span>
          <button
            onClick={() => setOpen(false)}
            className="w-6 h-6 rounded-md hover:bg-muted flex items-center justify-center"
            aria-label="Close"
          >
            <X className="w-3.5 h-3.5" style={{ color: "#1a3a52" }} />
          </button>
        </div>
        <Link
          to="/docs"
          onClick={() => setOpen(false)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted transition-colors"
        >
          <span className="w-8 h-8 rounded-lg bg-gradient-cyan-blue flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-white" />
          </span>
          <span className="text-sm font-medium" style={{ color: "#1a3a52" }}>Documentation</span>
        </Link>
        <Link
          to="/bob"
          onClick={() => setOpen(false)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted transition-colors"
        >
          <span className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-white" />
          </span>
          <span className="text-sm font-medium" style={{ color: "#1a3a52" }}>Ask BOB</span>
        </Link>
        <a
          href="mailto:support@loccibox.dev"
          onClick={() => setOpen(false)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted transition-colors"
        >
          <span className="w-8 h-8 rounded-lg bg-gradient-purple-pink flex items-center justify-center">
            <Mail className="w-4 h-4 text-white" />
          </span>
          <span className="text-sm font-medium" style={{ color: "#1a3a52" }}>Contact Support</span>
        </a>
      </div>

      {/* Floating trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Help"
        aria-expanded={open}
        className="group relative w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 animate-fade-in"
        style={{
          background: "linear-gradient(135deg,#4a5ed8,#6b7fd9)",
          boxShadow: "0 10px 30px -5px rgba(74,94,216,0.55)",
        }}
      >
        {/* Pulsing ring */}
        <span
          className={cn(
            "absolute inset-0 rounded-full transition-opacity",
            open ? "opacity-0" : "opacity-100 animate-ping"
          )}
          style={{ background: "rgba(74,94,216,0.35)", animationDuration: "2.4s" }}
          aria-hidden
        />
        <span
          className={cn(
            "relative transition-transform duration-300",
            open ? "rotate-180 scale-90" : "rotate-0 group-hover:rotate-12"
          )}
        >
          {open ? (
            <X className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          ) : (
            <HelpCircle className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          )}
        </span>
      </button>
    </div>
  );
}