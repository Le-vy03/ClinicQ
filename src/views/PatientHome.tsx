import { useEffect, useState, type FormEvent } from "react";
import { Banner, Field, Panel, inputClass, primaryButton } from "../components/Shell";
import { listClinics, listQueues, queueSummary, takeTicket } from "../lib/api";
import { cleanName, cleanPhone, errorText, waitLabel } from "../lib/format";
import { go } from "../lib/route";
import { loadTickets, saveTicket } from "../lib/tickets";
import type { Clinic, Queue, QueueSummary, SavedTicket } from "../types";

export function PatientHome({ bookForElse }: { bookForElse: boolean }) {
  const [clinics, setClinics] = useState<Clinic[] | null>(null);
  const [queues, setQueues] = useState<Queue[]>([]);
  const [clinicId, setClinicId] = useState("");
  const [queueId, setQueueId] = useState("");
  const [summary, setSummary] = useState<QueueSummary | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [forElse, setForElse] = useState(bookForElse);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mine, setMine] = useState<SavedTicket[]>(() => loadTickets());

  useEffect(() => {
    const refresh = () => setMine(loadTickets());
    window.addEventListener("clinicq-tickets", refresh);
    return () => window.removeEventListener("clinicq-tickets", refresh);
  }, []);

  useEffect(() => {
    let cancel = false;
    listClinics()
      .then((rows) => {
        if (cancel) return;
        setClinics(rows);
        const open = rows.find((clinic) => clinic.is_open) ?? rows[0];
        if (open) setClinicId(open.id);
      })
      .catch((reason: unknown) => {
        if (!cancel) {
          setClinics([]);
          setError(errorText(reason));
        }
      });
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    if (!clinicId) return;
    let cancel = false;
    listQueues(clinicId)
      .then((rows) => {
        if (cancel) return;
        setQueues(rows);
        const open = rows.find((queue) => queue.is_open) ?? rows[0];
        setQueueId(open?.id ?? "");
      })
      .catch((reason: unknown) => {
        if (!cancel) setError(errorText(reason));
      });
    return () => {
      cancel = true;
    };
  }, [clinicId]);

  useEffect(() => {
    if (!queueId) return;
    let cancel = false;
    queueSummary(queueId)
      .then((row) => {
        if (!cancel) setSummary(row);
      })
      .catch(() => {
        if (!cancel) setSummary(null);
      });
    return () => {
      cancel = true;
    };
  }, [queueId]);

  const clinic = clinics?.find((item) => item.id === clinicId);
  const queue = queues.find((item) => item.id === queueId);
  const closed = clinic?.is_open === false || queue?.is_open === false;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const patientName = cleanName(name);
    if (!patientName) {
      setError("Enter the patient name, up to 100 characters.");
      return;
    }
    if (!queueId) {
      setError("Choose a queue.");
      return;
    }
    setLoading(true);
    try {
      const issued = await takeTicket({
        queueId,
        name: patientName,
        phone: cleanPhone(phone),
        bookedForSomeoneElse: forElse,
      });
      saveTicket({
        ticketId: issued.ticket_id,
        accessToken: issued.access_token,
        ticketCode: issued.ticket_code,
        queueId: issued.queue_id,
        clinicId: issued.clinic_id,
        patientName,
        savedAt: new Date().toISOString(),
      });
      go(`/ticket/${issued.ticket_id}?t=${encodeURIComponent(issued.access_token)}`);
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Panel labelledBy="book-heading">
        <form onSubmit={onSubmit} className="p-6 sm:p-8 space-y-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--cq-primary)]">Today's queue</p>
            <h2 id="book-heading" className="text-2xl font-extrabold text-slate-900 mt-1">Take a ticket</h2>
            <p className="text-sm text-slate-600 mt-1">Pick the clinic and desk, then hold your place. You do not need an account.</p>
          </div>
          {clinics === null && <p className="text-sm text-slate-500">Loading clinics…</p>}
          {clinics?.length === 0 && <Banner kind="info">No clinics are open for booking yet.</Banner>}
          {error && <Banner kind="error">{error}</Banner>}
          {clinics && clinics.length > 0 && (
            <fieldset>
              <legend className="text-xs font-bold text-slate-700 mb-2">Clinic</legend>
              <div className="grid gap-2">
                {clinics.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={item.id === clinicId}
                    onClick={() => setClinicId(item.id)}
                    className={`text-left rounded-2xl border px-4 py-3 cursor-pointer ${item.id === clinicId ? "border-[var(--cq-primary)] bg-[var(--cq-soft)]" : "border-slate-200 bg-white"}`}
                  >
                    <span className="block font-bold text-slate-900">{item.name}</span>
                    <span className="block text-xs text-slate-500 mt-0.5">{item.location || "Public clinic"}{item.is_open ? "" : " · Closed"}</span>
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          {queues.length > 0 && (
            <fieldset>
              <legend className="text-xs font-bold text-slate-700 mb-2">Queue</legend>
              <div className="flex flex-wrap gap-2">
                {queues.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={item.id === queueId}
                    onClick={() => setQueueId(item.id)}
                    className={`px-3 py-2 rounded-full border text-sm font-semibold cursor-pointer ${item.id === queueId ? "bg-[var(--cq-sidebar)] text-white border-transparent" : "bg-white text-slate-700 border-slate-200"}`}
                  >
                    {item.name}{item.is_open ? "" : " (closed)"}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          {summary && summary.queue_id === queueId && (
            <p className="text-sm text-slate-600">
              {summary.queue_name} at {summary.clinic_name}: {summary.waiting_count} waiting
              {summary.is_open
                ? summary.estimated_wait_minutes_for_new_ticket > 0
                  ? `, about ${waitLabel(summary.estimated_wait_minutes_for_new_ticket)} for a new ticket`
                  : ". A new ticket would be next."
                : " · this queue is closed"}.
            </p>
          )}
          <Field label={forElse ? "Their full name" : "Your full name"}>
            <input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required maxLength={100} />
          </Field>
          <Field label="Zambian mobile (optional)">
            <input className={inputClass} value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" autoComplete="tel" placeholder="0977 123456" />
          </Field>
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" className="mt-1" checked={forElse} onChange={(event) => setForElse(event.target.checked)} />
            <span>Book for someone else. The ticket is stored on this phone as well as theirs if you share the link.</span>
          </label>
          {closed && <Banner kind="info">This clinic or queue is closed, so a new ticket cannot be taken right now.</Banner>}
          <button className={primaryButton} type="submit" disabled={loading || closed || !queueId}>
            {loading ? "Issuing ticket…" : forElse ? "Issue their ticket" : "Get my queue number"}
          </button>
        </form>
      </Panel>
      <Panel labelledBy="mine-heading">
        <div id="mine" className="p-6 sm:p-8">
          <h2 id="mine-heading" className="text-xl font-extrabold text-slate-900">My tickets</h2>
          <p className="text-sm text-slate-500 mt-1">Saved on this phone. Open one to see the live place in line.</p>
          {mine.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">You have no tickets on this phone yet.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {mine.map((item) => (
                <li key={item.ticketId}>
                  <button type="button" onClick={() => go(`/ticket/${item.ticketId}?t=${encodeURIComponent(item.accessToken)}`)} className="w-full text-left rounded-2xl border border-slate-200 px-4 py-3 hover:border-[var(--cq-primary)] cursor-pointer">
                    <span className="font-extrabold text-slate-900">{item.ticketCode}</span>
                    <span className="block text-sm text-slate-600">{item.patientName}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Panel>
    </div>
  );
}
