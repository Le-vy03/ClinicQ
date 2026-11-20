import { useEffect, useState } from "react";
import { queueSummary } from "../lib/api";
import { errorText, formatTime, statusLabel } from "../lib/format";
import { supabase } from "../lib/supabase";
import type { QueueSummary } from "../types";

export function DisplayPage({ queueId }: { queueId: string }) {
  const [summary, setSummary] = useState<QueueSummary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancel = false;
    const refresh = () => {
      queueSummary(queueId)
        .then((row) => {
          if (!cancel) {
            setSummary(row);
            setError("");
          }
        })
        .catch((reason: unknown) => {
          if (!cancel) setError(errorText(reason));
        });
    };
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    const channel = supabase
      .channel(`display:${queueId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "queue_events", filter: `queue_id=eq.${queueId}` }, refresh)
      .subscribe();
    return () => {
      cancel = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [queueId]);

  return (
    <main className="min-h-screen bg-[var(--cq-sidebar)] text-white p-6 sm:p-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/70">ClinicQ waiting room</p>
          <h1 className="text-4xl sm:text-5xl font-black mt-2">{summary?.clinic_name ?? "Clinic queue"}</h1>
          <p className="text-xl text-white/80 mt-1">{summary?.queue_name ?? "Loading queue…"}{summary && !summary.is_open ? " · Closed" : ""}</p>
        </div>
        <p className="text-lg font-semibold">{summary ? `${summary.waiting_count} waiting` : ""}</p>
      </header>
      {error && <p role="alert" className="mt-6 rounded-2xl bg-white/10 px-4 py-3">{error}</p>}
      <section className="mt-10" aria-label="Now serving">
        <h2 className="text-sm font-bold uppercase tracking-widest text-white/60">Now serving</h2>
        {summary && summary.now_serving.length === 0 && <p className="mt-4 text-2xl text-white/80">Nobody is at the desk.</p>}
        <ul className="mt-4 grid gap-4 md:grid-cols-2">
          {summary?.now_serving.map((call) => (
            <li key={`${call.ticket_code}-${call.called_at}`} className="rounded-3xl bg-white text-[var(--cq-ink)] p-6">
              <p className="text-sm font-bold uppercase tracking-wider">{call.desk_label || "Desk"} · {statusLabel(call.status)}</p>
              <p className="text-6xl font-black tabular-nums mt-2">{call.ticket_code}</p>
            </li>
          ))}
        </ul>
      </section>
      <section className="mt-10" aria-label="Recent calls">
        <h2 className="text-sm font-bold uppercase tracking-widest text-white/60">Recent calls</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {summary?.recent_calls.map((call) => (
            <li key={`${call.ticket_code}-${call.called_at}-recent`} className="rounded-2xl bg-white/10 px-4 py-3">
              <p className="text-3xl font-black tabular-nums">{call.ticket_code}</p>
              <p className="text-sm text-white/75">{call.desk_label || statusLabel(call.status)}{call.called_at ? ` · ${formatTime(call.called_at)}` : ""}</p>
            </li>
          ))}
        </ul>
        {summary && summary.recent_calls.length === 0 && <p className="mt-3 text-white/70">No calls yet today.</p>}
      </section>
    </main>
  );
}
