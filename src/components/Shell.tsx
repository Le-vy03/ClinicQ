import { useEffect, useState, type ReactNode } from "react";
import { loadTickets } from "../lib/tickets";
import { go, type Route } from "../lib/route";
import type { ThemeName } from "../types";

const themes: { id: ThemeName; label: string; swatch: string }[] = [
  { id: "navy", label: "Medical Blue", swatch: "#1D56A8" },
  { id: "teal", label: "Clean Teal", swatch: "#0f766e" },
  { id: "forest", label: "Classic Green", swatch: "#1B4332" },
];

export function Shell({
  route,
  theme,
  setTheme,
  children,
}: {
  route: Route;
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  children: ReactNode;
}) {
  const [ticketCount, setTicketCount] = useState(() => loadTickets().length);
  useEffect(() => {
    const refresh = () => setTicketCount(loadTickets().length);
    window.addEventListener("clinicq-tickets", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("clinicq-tickets", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const patientOn = route.name === "home" || route.name === "ticket";
  const staffOn = route.name === "staff";

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <aside className="w-full lg:w-80 xl:w-96 text-white flex flex-col justify-between p-6 lg:p-8 shrink-0 shadow-xl bg-[var(--cq-sidebar)]">
        <div>
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-white text-[var(--cq-ink)] font-extrabold text-lg flex items-center justify-center shadow-md">CQ</div>
            <div>
              <h1 className="text-xl font-bold tracking-tight leading-none">ClinicQ</h1>
              <p className="text-xs font-medium text-white/70 mt-1">Lusaka public clinics</p>
            </div>
          </div>
          <div className="mt-6 lg:mt-8 hidden sm:block">
            <p className="text-sm font-semibold leading-relaxed">Patients in Zambia lose whole days queuing at government clinics.</p>
            <p className="text-xs text-white/75 leading-relaxed mt-2">ClinicQ holds your place, then calls you to the desk when it is time to walk in.</p>
          </div>
          <nav className="mt-6 lg:mt-8 flex lg:flex-col gap-2 overflow-x-auto pb-1 lg:pb-0" aria-label="Main">
            <NavButton current={patientOn} onClick={() => go("/")}>
              <span>Take a ticket</span>
            </NavButton>
            <NavButton
              current={false}
              onClick={() => {
                if (route.name !== "home") go("/");
                window.setTimeout(() => document.getElementById("mine")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
              }}
            >
              <span>My tickets</span>
              {ticketCount > 0 && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/15">{ticketCount}</span>}
            </NavButton>
            <NavButton current={staffOn} onClick={() => go("/staff")}>
              <span>Staff desk</span>
            </NavButton>
          </nav>
        </div>
        <p className="mt-8 pt-6 border-t border-white/15 text-xs text-white/60 hidden lg:block">A real queue for today's clinic. No demo patients.</p>
      </aside>
      <main className="flex-1 min-h-screen flex flex-col bg-[#F4F7FA]">
        <header className="bg-white border-b border-slate-200/80 px-4 sm:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-10">
          <p className="text-xs font-semibold text-slate-600">Live queue for public clinics</p>
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200/80" role="group" aria-label="Theme">
            <span className="text-[11px] font-semibold text-slate-500 pl-2 hidden sm:inline">Theme:</span>
            {themes.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={theme === item.id}
                onClick={() => setTheme(item.id)}
                className={`px-2.5 py-1 rounded-lg text-xs cursor-pointer flex items-center gap-1.5 ${theme === item.id ? "font-semibold bg-white text-slate-900 shadow-sm" : "font-medium text-slate-600 hover:text-slate-900"}`}
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: item.swatch }} />
                {item.label}
              </button>
            ))}
          </div>
        </header>
        <div className="flex-1">{children}</div>
      </main>
    </div>
  );
}

function NavButton({ current, onClick, children }: { current: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-current={current ? "page" : undefined}
      onClick={onClick}
      className={`flex-1 lg:flex-none flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-sm cursor-pointer ${current ? "font-bold bg-white shadow-sm text-[var(--cq-ink)]" : "font-medium text-white/85 hover:bg-white/10"}`}
    >
      {children}
    </button>
  );
}

export function Panel({ children, labelledBy }: { children: ReactNode; labelledBy?: string }) {
  return (
    <section aria-labelledby={labelledBy} className="max-w-4xl w-full mx-auto px-4 sm:px-8 py-6 sm:py-8">
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200/90">{children}</div>
    </section>
  );
}

export function Banner({ kind, children }: { kind: "error" | "info"; children: ReactNode }) {
  const tone = kind === "error" ? "bg-rose-50 text-rose-800 border-rose-200" : "bg-[var(--cq-soft)] text-slate-800 border-[var(--cq-soft-border)]";
  return (
    <p role={kind === "error" ? "alert" : "status"} className={`rounded-2xl border px-4 py-3 text-sm ${tone}`}>
      {children}
    </p>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-bold text-slate-700 mb-1">{label}</span>
      {children}
    </label>
  );
}

export const inputClass = "w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--cq-primary)]";
export const primaryButton = "px-5 py-3 rounded-xl bg-[var(--cq-primary)] hover:bg-[var(--cq-primary-hover)] text-white font-bold text-sm shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";
export const ghostButton = "px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer disabled:opacity-50";
export const dangerButton = "px-4 py-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-sm cursor-pointer disabled:opacity-50";
