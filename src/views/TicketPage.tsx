import { useEffect, useRef, useState, type ReactNode } from "react";
import { Banner, Panel, dangerButton, ghostButton, primaryButton } from "../components/Shell";
import { cancelTicket, ticketStatus } from "../lib/api";
import { errorText, formatServiceDate, formatTime, noticeStatusLabel, notifyCalled, ordinal, progressPercent, statusLabel, ticketLink, waitLabel } from "../lib/format";
import { go } from "../lib/route";
import { supabase } from "../lib/supabase";
import { saveTicket, ticketById } from "../lib/tickets";
import type { TicketSnapshot, TicketStatus } from "../types";

export function TicketPage({ id, token }: { id: string; token: string | null }) {
  const accessToken = token || ticketById(id)?.accessToken || "";
  const [snapshot, setSnapshot] = useState<TicketSnapshot | null>(null);
  const [error, setError] = useState(accessToken ? "" : "This link does not include the ticket key, and it is not saved on this phone.");
  const [loading, setLoading] = useState(Boolean(accessToken));
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [copied, setCopied] = useState(false);
  const [live, setLive] = useState(false);
  const [tab, setTab] = useState<"ticket" | "messages">("ticket");
  const lastStatus = useRef<TicketStatus | null>(null);
  const queueId = snapshot?.queue.id ?? ticketById(id)?.queueId ?? null;

  useEffect(() => {
    if (!accessToken) return;
    let cancel = false;
    const refresh = async () => {
      try {
        const next = await ticketStatus(id, accessToken);
        if (cancel) return;
        setSnapshot(next);
        setError("");
        saveTicket({
          ticketId: next.ticket.id,
          accessToken,
          ticketCode: next.ticket.ticket_code,
          queueId: next.queue.id,
          clinicId: next.clinic.id,
          patientName: next.ticket.patient_name,
          savedAt: new Date().toISOString(),
        });
        if (next.ticket.status === "called" && lastStatus.current && lastStatus.current !== "called") {
          void notifyCalled(next.ticket.ticket_code, next.ticket.desk_label);
        }
        lastStatus.current = next.ticket.status;
      } catch (reason) {
        if (!cancel) setError(errorText(reason));
      } finally {
        if (!cancel) setLoading(false);
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancel = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [id, accessToken]);

  useEffect(() => {
    if (!queueId || !accessToken) return;
    const channel = supabase
      .channel(`ticket-queue:${queueId}:${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "queue_events", filter: `queue_id=eq.${queueId}` }, () => {
        void ticketStatus(id, accessToken)
          .then((next) => {
            setSnapshot(next);
            if (next.ticket.status === "called" && lastStatus.current !== "called") {
              void notifyCalled(next.ticket.ticket_code, next.ticket.desk_label);
            }
            lastStatus.current = next.ticket.status;
          })
          .catch((reason: unknown) => setError(errorText(reason)));
      })
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queueId, id, accessToken]);

  async function onCancel() {
    setCancelling(true);
    setError("");
    try {
      await cancelTicket(id, accessToken);
      const next = await ticketStatus(id, accessToken);
      setSnapshot(next);
      lastStatus.current = next.ticket.status;
      setConfirming(false);
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setCancelling(false);
    }
  }

  if (!accessToken) {
    return (
      <Panel>
        <div className="p-6 sm:p-8 space-y-3">
          <h2 className="text-xl font-extrabold">Ticket unavailable</h2>
          <Banner kind="error">{error}</Banner>
          <button type="button" className={primaryButton} onClick={() => go("/")}>Take a ticket</button>
        </div>
      </Panel>
    );
  }

  const ticket = snapshot?.ticket;
  const canCancel = ticket?.status === "waiting" || ticket?.status === "called";
  const progress = ticket ? progressPercent(ticket.status, snapshot?.people_ahead ?? 0) : 0;

  return (
    <div>
      <Panel labelledBy="ticket-heading">
        <div className="p-6 sm:p-8 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{ticket ? formatServiceDate(ticket.service_date) : "Your visit"}</p>
              <h2 id="ticket-heading" className="text-xl sm:text-2xl font-extrabold text-slate-900">Hold this ticket. The desk can see it.</h2>
            </div>
            <p className="text-xs font-semibold text-slate-500" role="status">{live ? "Live" : loading ? "Loading…" : "Refreshing every minute"}</p>
          </div>
          {loading && !snapshot && <p className="text-sm text-slate-500">Loading your place in line…</p>}
          {error && <Banner kind="error">{error}</Banner>}
          {ticket && snapshot && (
            <>
              {ticket.status === "called" && (
                <div className="rounded-3xl bg-rose-600 text-white p-5 sm:p-6" role="alert">
                  <p className="text-xs font-bold uppercase tracking-widest text-rose-100">Your turn</p>
                  <p className="text-3xl sm:text-4xl font-black mt-1">Go to {ticket.desk_label || "the desk"}</p>
                  <p className="mt-2 text-rose-50">Ticket {ticket.ticket_code}. Please walk in now.</p>
                </div>
              )}
              {ticket.status === "serving" && <Banner kind="info">You are being seen{ticket.desk_label ? ` at ${ticket.desk_label}` : ""}.</Banner>}
              {ticket.status === "done" && <Banner kind="info">This visit is complete. Thank you for coming.</Banner>}
              {ticket.status === "no_show" && <Banner kind="error">The desk marked this ticket as a no-show. They may call it again.</Banner>}
              {ticket.status === "cancelled" && <Banner kind="info">This ticket was cancelled and no longer holds a place.</Banner>}
              <div className="flex gap-2" role="tablist" aria-label="Ticket sections">
                <TabButton current={tab === "ticket"} onClick={() => setTab("ticket")}>Ticket</TabButton>
                <TabButton current={tab === "messages"} onClick={() => setTab("messages")}>Messages ({snapshot.notifications.length})</TabButton>
              </div>
              {tab === "ticket" ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                    <div className="md:col-span-5 bg-[var(--cq-hero)] text-white rounded-2xl p-6 shadow-md">
                      <p className="text-xs font-bold uppercase tracking-widest text-white/70">Queue number</p>
                      <p className="text-5xl sm:text-6xl font-black tracking-tight my-2 tabular-nums">{ticket.ticket_code}</p>
                      <p className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white/15 px-3 py-1 rounded-full">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        {statusLabel(ticket.status)} · {snapshot.queue.name}
                      </p>
                    </div>
                    <div className="md:col-span-7 grid grid-cols-2 gap-4">
                      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Place in line</p>
                        <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1.5">{snapshot.position ? ordinal(snapshot.position) : statusLabel(ticket.status)}</p>
                        <p className="text-xs font-medium text-slate-500 mt-1">{ticket.status === "waiting" ? `${snapshot.people_ahead} ahead` : snapshot.clinic.name}</p>
                      </div>
                      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Estimated wait</p>
                        <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1.5">{ticket.status === "waiting" ? waitLabel(snapshot.estimated_wait_minutes) : "—"}</p>
                        <p className="text-xs font-medium text-slate-500 mt-1">About {snapshot.queue.avg_minutes_per_patient} min each</p>
                      </div>
                      <div className="col-span-2 bg-slate-50 border border-slate-200/80 rounded-2xl p-4">
                        <div className="flex items-center justify-between text-xs font-semibold mb-2">
                          <span className="text-slate-600">Queue progress</span>
                          <span className="text-[var(--cq-primary)] font-bold">{progress}% closer to the desk</span>
                        </div>
                        <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden" aria-hidden="true">
                          <div className="h-full bg-[var(--cq-primary)] rounded-full" style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-slate-700">{ticket.patient_name}{ticket.booked_for_someone_else ? " · booked for someone else" : ""}</p>
                  <p className="text-sm text-slate-500 -mt-4">{snapshot.clinic.name}{snapshot.clinic.location ? ` · ${snapshot.clinic.location}` : ""} · {snapshot.queue.name}</p>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Recent desk calls</h3>
                    {snapshot.recent_calls.length === 0 ? (
                      <p className="text-sm text-slate-500">No calls in this queue yet today.</p>
                    ) : (
                      <ul className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                        {snapshot.recent_calls.map((call) => (
                          <li key={`${call.ticket_code}-${call.called_at}`} className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                            <span className="font-semibold text-slate-500">{statusLabel(call.status)}{call.desk_label ? ` · ${call.desk_label}` : ""}</span>
                            <span className="block font-mono font-bold text-slate-800 mt-1">{call.ticket_code}</span>
                            {call.called_at && <span className="text-slate-400">{formatTime(call.called_at)}</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row flex-wrap gap-3">
                    <button type="button" className={primaryButton} onClick={() => go("/?book=else")}>Book for someone else</button>
                    {canCancel && <button type="button" className={dangerButton} onClick={() => setConfirming(true)}>I can't make it</button>}
                    <button type="button" className={ghostButton} onClick={() => void navigator.clipboard.writeText(ticketLink(id, accessToken)).then(() => setCopied(true)).catch(() => setError("Copy the link below. This browser blocked clipboard access."))}>
                      {copied ? "Link copied" : "Copy share link"}
                    </button>
                  </div>
                  <label className="block text-xs font-bold text-slate-500">
                    Shareable ticket link
                    <input className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-600" readOnly value={ticketLink(id, accessToken)} />
                  </label>
                </>
              ) : (
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">Messages for this visit</h3>
                  <p className="text-sm text-slate-500 mt-1">SMS sending is not connected yet. These are the messages the desk would send.</p>
                  {snapshot.notifications.length === 0 ? (
                    <p className="mt-4 text-sm text-slate-600">No messages yet.</p>
                  ) : (
                    <ul className="mt-4 space-y-3">
                      {snapshot.notifications.map((notice) => (
                        <li key={notice.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-xs font-bold text-slate-500">{notice.kind.replaceAll("_", " ")} · {noticeStatusLabel(notice.status)}</p>
                          <p className="text-sm text-slate-800 mt-1">{notice.message}</p>
                          <p className="text-xs text-slate-400 mt-1">{formatTime(notice.created_at)}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </Panel>
      {confirming && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="cancel-title">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <h3 id="cancel-title" className="text-lg font-extrabold">Release your place in line?</h3>
            <p className="text-sm text-slate-600 mt-2">This cancels ticket {ticket?.ticket_code}. You can take a new one later.</p>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className={ghostButton} onClick={() => setConfirming(false)}>Keep my spot</button>
              <button type="button" className="px-5 py-2.5 rounded-xl bg-rose-600 text-white font-bold text-sm cursor-pointer disabled:opacity-50" disabled={cancelling} onClick={() => void onCancel()}>
                {cancelling ? "Cancelling…" : "Yes, release ticket"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({ current, onClick, children }: { current: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" role="tab" aria-selected={current} onClick={onClick} className={`px-4 py-2 rounded-full text-sm font-semibold cursor-pointer ${current ? "bg-[var(--cq-sidebar)] text-white" : "bg-slate-100 text-slate-700"}`}>
      {children}
    </button>
  );
}
