import { useEffect, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { Banner, Field, Panel, dangerButton, ghostButton, inputClass, primaryButton } from "../components/Shell";
import {
  addStaff,
  callNext,
  callTicket,
  claimClinic,
  completeTicket,
  createQueue,
  listClinics,
  listNotices,
  listQueue,
  listQueues,
  listStaff,
  markNoShow,
  myMemberships,
  queueSummary,
  recallTicket,
  removeStaff,
  returnToQueue,
  staffCancelTicket,
  startServing,
  updateClinic,
  updateQueue,
  updateStaff,
} from "../lib/api";
import { appBaseUrl } from "../lib/config";
import { errorText, formatTime, noticeStatusLabel, statusLabel } from "../lib/format";
import { go } from "../lib/route";
import { supabase } from "../lib/supabase";
import type { Clinic, Queue, QueueSummary, StaffDirectoryRow, StaffMembership, StaffNotice, StaffRole, TicketRow } from "../types";

const DESK_KEY = "clinicq.desk-label";

export function StaffPage({ tab }: { tab: "desk" | "messages" | "team" | "settings" }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [recovery, setRecovery] = useState(false);
  const [memberState, setMemberState] = useState<{ userId: string; rows: StaffMembership[] } | null>(null);
  const [error, setError] = useState("");
  const [membershipVersion, setMembershipVersion] = useState(0);
  const memberships = session && memberState?.userId === session.user.id ? memberState.rows : null;

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      if (next?.access_token) void supabase.realtime.setAuth(next.access_token);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    let cancel = false;
    const userId = session.user.id;
    myMemberships(userId)
      .then((rows) => {
        if (!cancel) setMemberState({ userId, rows });
      })
      .catch((reason: unknown) => {
        if (!cancel) {
          setError(errorText(reason));
          setMemberState({ userId, rows: [] });
        }
      });
    return () => {
      cancel = true;
    };
  }, [session, membershipVersion]);

  if (session === undefined || (session && memberships === null)) {
    return <Panel><p className="p-8 text-sm text-slate-500">Checking your session…</p></Panel>;
  }
  if (!session) return <AuthPanel recovery={recovery} onRecovered={() => setRecovery(false)} />;
  if (!memberships || memberships.length === 0) {
    return <ClaimPanel error={error} onClaimed={() => setMembershipVersion((version) => version + 1)} />;
  }
  return <DeskShell memberships={memberships} tab={tab} userId={session.user.id} onSignOut={() => void supabase.auth.signOut()} />;
}

function AuthPanel({ recovery, onRecovered }: { recovery: boolean; onRecovered: () => void }) {
  const [mode, setMode] = useState<"sign-in" | "sign-up" | "reset">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const redirectTo = appBaseUrl();

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      if (recovery) {
        if (nextPassword.length < 8) throw new Error("Use at least 8 characters.");
        const { error: updateError } = await supabase.auth.updateUser({ password: nextPassword });
        if (updateError) throw updateError;
        setMessage("Password updated. You can use the desk now.");
        onRecovered();
        return;
      }
      if (mode === "reset") {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
        if (resetError) throw resetError;
        setMessage("If that account exists, a reset link is on its way. Open it on this device.");
        return;
      }
      if (password.length < 8) throw new Error("Use at least 8 characters.");
      if (mode === "sign-up") {
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo } });
        if (signUpError) throw signUpError;
        if (!data.session) setMessage("Check your email to confirm the account, then sign in. The link must be allowed in Supabase Auth redirect URLs.");
        return;
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel labelledBy="staff-auth-heading">
      <form onSubmit={onSubmit} className="p-6 sm:p-8 max-w-md space-y-4">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--cq-primary)]">Staff</p>
        <h2 id="staff-auth-heading" className="text-2xl font-extrabold text-slate-900">{recovery ? "Choose a new password" : "Staff sign in"}</h2>
        <p className="text-sm text-slate-600">The desk is only for clinic staff. Patients take a ticket without an account.</p>
        {error && <Banner kind="error">{error}</Banner>}
        {message && <Banner kind="info">{message}</Banner>}
        {!recovery && (
          <Field label="Email">
            <input className={inputClass} type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} />
          </Field>
        )}
        {!recovery && mode !== "reset" && (
          <Field label="Password">
            <input className={inputClass} type="password" autoComplete={mode === "sign-up" ? "new-password" : "current-password"} required value={password} onChange={(event) => setPassword(event.target.value)} />
          </Field>
        )}
        {recovery && (
          <Field label="New password">
            <input className={inputClass} type="password" autoComplete="new-password" required value={nextPassword} onChange={(event) => setNextPassword(event.target.value)} />
          </Field>
        )}
        <button className={primaryButton} type="submit" disabled={busy}>{busy ? "Please wait…" : recovery ? "Update password" : mode === "sign-up" ? "Create staff account" : mode === "reset" ? "Send reset link" : "Sign in"}</button>
        {!recovery && (
          <div className="flex flex-wrap gap-3 text-sm">
            <button type="button" className={ghostButton} onClick={() => setMode(mode === "sign-up" ? "sign-in" : "sign-up")}>{mode === "sign-up" ? "I already have an account" : "Create an account"}</button>
            <button type="button" className={ghostButton} onClick={() => setMode(mode === "reset" ? "sign-in" : "reset")}>{mode === "reset" ? "Back to sign in" : "Forgot password"}</button>
          </div>
        )}
      </form>
    </Panel>
  );
}

function ClaimPanel({ error: outerError, onClaimed }: { error: string; onClaimed: () => void }) {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [clinicId, setClinicId] = useState("");
  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState(outerError);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listClinics().then((rows) => {
      setClinics(rows);
      if (rows[0]) setClinicId(rows[0].id);
    }).catch((reason: unknown) => setError(errorText(reason)));
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await claimClinic(clinicId, code.trim(), displayName.trim());
      setCode("");
      onClaimed();
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel labelledBy="claim-heading">
      <form onSubmit={onSubmit} className="p-6 sm:p-8 max-w-lg space-y-4">
        <h2 id="claim-heading" className="text-2xl font-extrabold">Claim clinic</h2>
        <p className="text-sm text-slate-600">You are signed in, but you are not on a clinic roster yet. If an admin added your email, sign out and back in. If this clinic has no admin, enter the one-time code the owner gave you. The code is never stored in the app.</p>
        {error && <Banner kind="error">{error}</Banner>}
        <Field label="Clinic">
          <select className={inputClass} value={clinicId} onChange={(event) => setClinicId(event.target.value)}>
            {clinics.map((clinic) => <option key={clinic.id} value={clinic.id}>{clinic.name}</option>)}
          </select>
        </Field>
        <Field label="Your name on the desk">
          <input className={inputClass} value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={80} />
        </Field>
        <Field label="Claim code">
          <input className={inputClass} type="password" autoComplete="off" value={code} onChange={(event) => setCode(event.target.value)} required />
        </Field>
        <div className="flex gap-2">
          <button className={primaryButton} type="submit" disabled={busy || !clinicId}>{busy ? "Checking code…" : "Claim clinic"}</button>
          <button className={ghostButton} type="button" onClick={() => void supabase.auth.signOut()}>Sign out</button>
        </div>
      </form>
    </Panel>
  );
}

function DeskShell({ memberships, tab, userId, onSignOut }: { memberships: StaffMembership[]; tab: "desk" | "messages" | "team" | "settings"; userId: string; onSignOut: () => void }) {
  const [clinicId, setClinicId] = useState(memberships[0].clinic_id);
  const membership = memberships.find((item) => item.clinic_id === clinicId) ?? memberships[0];
  const admin = membership.role === "admin";
  const [queues, setQueues] = useState<Queue[]>([]);
  const [queueId, setQueueId] = useState("");

  useEffect(() => {
    let cancel = false;
    listQueues(clinicId).then((rows) => {
      if (cancel) return;
      setQueues(rows);
      setQueueId(rows[0]?.id ?? "");
    }).catch(() => {
      if (!cancel) setQueues([]);
    });
    return () => {
      cancel = true;
    };
  }, [clinicId]);

  return (
    <div>
      <div className="max-w-4xl mx-auto px-4 sm:px-8 pt-6 flex flex-wrap items-center gap-2">
        {memberships.length > 1 && (
          <label className="text-sm font-semibold text-slate-700">
            Clinic
            <select className={`${inputClass} ml-2`} value={clinicId} onChange={(event) => setClinicId(event.target.value)}>
              {memberships.map((item) => <option key={item.clinic_id} value={item.clinic_id}>{item.clinics?.name ?? item.clinic_id}</option>)}
            </select>
          </label>
        )}
        <nav className="flex flex-wrap gap-2" aria-label="Staff sections">
          <StaffTab current={tab === "desk"} onClick={() => go("/staff")}>Desk</StaffTab>
          <StaffTab current={tab === "messages"} onClick={() => go("/staff/messages")}>Messages</StaffTab>
          {admin && <StaffTab current={tab === "team"} onClick={() => go("/staff/team")}>Team</StaffTab>}
          {admin && <StaffTab current={tab === "settings"} onClick={() => go("/staff/settings")}>Clinic</StaffTab>}
          <button type="button" className={ghostButton} onClick={onSignOut}>Sign out</button>
        </nav>
      </div>
      {tab === "desk" && queueId && <DeskView queueId={queueId} queues={queues} onQueue={setQueueId} clinicName={membership.clinics?.name ?? "Clinic"} />}
      {tab === "messages" && <MessagesView clinicId={clinicId} />}
      {tab === "team" && admin && <TeamView clinicId={clinicId} userId={userId} />}
      {tab === "settings" && admin && <SettingsView clinicId={clinicId} queues={queues} onChanged={() => void listQueues(clinicId).then(setQueues)} />}
      {tab === "desk" && !queueId && <Panel><p className="p-8 text-sm">This clinic has no queue yet. An admin can add one under Clinic.</p></Panel>}
      {(tab === "team" || tab === "settings") && !admin && <Panel><p className="p-8 text-sm">Only a clinic admin can open that screen.</p></Panel>}
    </div>
  );
}

function StaffTab({ current, onClick, children }: { current: boolean; onClick: () => void; children: string }) {
  return <button type="button" aria-current={current ? "page" : undefined} onClick={onClick} className={`px-3 py-2 rounded-full text-sm font-semibold cursor-pointer ${current ? "bg-[var(--cq-sidebar)] text-white" : "bg-white border border-slate-200 text-slate-700"}`}>{children}</button>;
}

function DeskView({ queueId, queues, onQueue, clinicName }: { queueId: string; queues: Queue[]; onQueue: (id: string) => void; clinicName: string }) {
  const [desk, setDesk] = useState(() => localStorage.getItem(DESK_KEY) ?? "Desk 1");
  const [rows, setRows] = useState<TicketRow[] | null>(null);
  const [summary, setSummary] = useState<QueueSummary | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    localStorage.setItem(DESK_KEY, desk);
  }, [desk]);

  useEffect(() => {
    let cancel = false;
    const reload = () => {
      Promise.all([listQueue(queueId), queueSummary(queueId)])
        .then(([tickets, stats]) => {
          if (cancel) return;
          setRows(tickets);
          setSummary(stats);
          setError("");
        })
        .catch((reason: unknown) => {
          if (!cancel) setError(errorText(reason));
        });
    };
    reload();
    const timer = window.setInterval(reload, 60_000);
    const channel = supabase
      .channel(`desk:${queueId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets", filter: `queue_id=eq.${queueId}` }, reload)
      .subscribe();
    return () => {
      cancel = true;
      window.clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [queueId]);

  async function run(key: string, action: () => Promise<unknown>) {
    setBusy(key);
    setError("");
    try {
      const result = await action();
      if (key === "next" && result === null) setError("Nobody is waiting.");
      const [tickets, stats] = await Promise.all([listQueue(queueId), queueSummary(queueId)]);
      setRows(tickets);
      setSummary(stats);
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setBusy("");
    }
  }

  const waiting = rows?.filter((row) => row.status === "waiting") ?? [];
  const active = rows?.filter((row) => row.status === "called" || row.status === "serving") ?? [];
  const label = desk.trim() || null;

  return (
    <Panel labelledBy="desk-heading">
      <div className="p-6 sm:p-8 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--cq-primary)]">Nurse and triage console</p>
            <h2 id="desk-heading" className="text-2xl font-extrabold mt-1">{clinicName}</h2>
            <p className="text-sm text-slate-500">Call the next patient. Messages are recorded, but SMS sending is not connected yet.</p>
          </div>
          <button type="button" className={primaryButton} disabled={Boolean(busy)} onClick={() => void run("next", () => callNext(queueId, label))}>{busy === "next" ? "Calling…" : "Call next patient"}</button>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Desk label">
            <input className={inputClass} value={desk} maxLength={40} onChange={(event) => setDesk(event.target.value)} />
          </Field>
          <Field label="Queue">
            <select className={inputClass} value={queueId} onChange={(event) => onQueue(event.target.value)}>
              {queues.map((queue) => <option key={queue.id} value={queue.id}>{queue.name}{queue.is_open ? "" : " (closed)"}</option>)}
            </select>
          </Field>
        </div>
        {error && <Banner kind="error">{error}</Banner>}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Stat label="At the desk" value={active.map((row) => row.ticket_code).join(", ") || "None"} />
          <Stat label="Waiting" value={String(waiting.length)} />
          <Stat label="Average minutes" value={summary ? String(summary.avg_minutes_per_patient) : "—"} />
        </div>
        {rows === null && <p className="text-sm text-slate-500">Loading today's queue…</p>}
        {rows?.length === 0 && <p className="text-sm text-slate-600">No tickets yet today.</p>}
        <ul className="space-y-2">
          {rows?.map((row) => (
            <li key={row.id} className="rounded-2xl border border-slate-200 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="font-extrabold">{row.ticket_code} <span className="font-semibold text-sm text-slate-500">{statusLabel(row.status)}{row.desk_label ? ` · ${row.desk_label}` : ""}{row.recall_count ? ` · recalled ${row.recall_count}` : ""}</span></p>
                <p className="text-sm text-slate-700">{row.patient_name}{row.patient_phone ? ` · ${row.patient_phone}` : ""}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {row.status === "waiting" && <button type="button" className={ghostButton} disabled={Boolean(busy)} onClick={() => void run(row.id, () => callTicket(row.id, label))}>Call</button>}
                {row.status === "called" && <button type="button" className={ghostButton} disabled={Boolean(busy)} onClick={() => void run(row.id, () => startServing(row.id))}>Start serving</button>}
                {(row.status === "called" || row.status === "serving") && <button type="button" className={ghostButton} disabled={Boolean(busy)} onClick={() => void run(row.id, () => completeTicket(row.id))}>Complete</button>}
                {(row.status === "waiting" || row.status === "called") && <button type="button" className={ghostButton} disabled={Boolean(busy)} onClick={() => void run(row.id, () => markNoShow(row.id))}>No-show</button>}
                {(row.status === "called" || row.status === "no_show") && <button type="button" className={ghostButton} disabled={Boolean(busy)} onClick={() => void run(row.id, () => recallTicket(row.id, label))}>Recall</button>}
                {(row.status === "called" || row.status === "no_show") && <button type="button" className={ghostButton} disabled={Boolean(busy)} onClick={() => void run(row.id, () => returnToQueue(row.id))}>Return to queue</button>}
                {(row.status === "waiting" || row.status === "called") && <button type="button" className={dangerButton} disabled={Boolean(busy)} onClick={() => void run(row.id, () => staffCancelTicket(row.id))}>Cancel</button>}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4"><p className="text-xs font-semibold text-slate-500">{label}</p><p className="text-xl font-extrabold mt-1">{value}</p></div>;
}

function MessagesView({ clinicId }: { clinicId: string }) {
  const [rows, setRows] = useState<StaffNotice[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancel = false;
    const reload = () => {
      listNotices(clinicId).then((notices) => {
        if (!cancel) setRows(notices);
      }).catch((reason: unknown) => {
        if (!cancel) setError(errorText(reason));
      });
    };
    reload();
    const channel = supabase
      .channel(`notices:${clinicId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `clinic_id=eq.${clinicId}` }, reload)
      .subscribe();
    return () => {
      cancel = true;
      void supabase.removeChannel(channel);
    };
  }, [clinicId]);
  return (
    <Panel labelledBy="messages-heading">
      <div className="p-6 sm:p-8">
        <h2 id="messages-heading" className="text-xl font-extrabold">Message outbox</h2>
        <p className="text-sm text-slate-500 mt-1">SMS sending is not connected yet. Pending rows are waiting for a sender. Skipped rows had no phone number.</p>
        {error && <Banner kind="error">{error}</Banner>}
        {rows === null && <p className="mt-4 text-sm">Loading messages…</p>}
        {rows?.length === 0 && <p className="mt-4 text-sm">No messages yet.</p>}
        <ul className="mt-4 space-y-3">
          {rows?.map((row) => (
            <li key={row.id} className="rounded-2xl border border-slate-200 p-4">
              <p className="text-xs font-bold text-slate-500">{row.kind} · {noticeStatusLabel(row.status)} · {formatTime(row.created_at)}</p>
              <p className="text-sm mt-1">{row.message}</p>
              <p className="text-xs text-slate-400 mt-1">{row.to_phone || "No phone"}{row.last_error ? ` · ${row.last_error}` : ""}</p>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}

function TeamView({ clinicId, userId }: { clinicId: string; userId: string }) {
  const [rows, setRows] = useState<StaffDirectoryRow[] | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("desk");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function reload() {
    listStaff(clinicId).then(setRows).catch((reason: unknown) => setError(errorText(reason)));
  }
  useEffect(reload, [clinicId]);

  async function onAdd(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await addStaff(clinicId, email.trim(), role, displayName.trim());
      setEmail("");
      setDisplayName("");
      reload();
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel labelledBy="team-heading">
      <div className="p-6 sm:p-8 space-y-4">
        <h2 id="team-heading" className="text-xl font-extrabold">Staff</h2>
        <p className="text-sm text-slate-600">The person must sign up before you can add their email.</p>
        {error && <Banner kind="error">{error}</Banner>}
        {rows === null && <p className="text-sm">Loading staff…</p>}
        <ul className="space-y-3">
          {rows?.map((row) => (
            <li key={row.user_id} className="rounded-2xl border border-slate-200 p-3 space-y-2">
              <p className="font-bold">{row.display_name || row.email}</p>
              <p className="text-xs text-slate-500">{row.email} · {row.role} · {row.is_active ? "Active" : "Inactive"}</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={ghostButton} onClick={() => void updateStaff({ clinicId, userId: row.user_id, role: row.role === "admin" ? "desk" : "admin", isActive: row.is_active, displayName: row.display_name ?? "" }).then(reload).catch((reason: unknown) => setError(errorText(reason)))}>{row.role === "admin" ? "Make desk" : "Make admin"}</button>
                <button type="button" className={ghostButton} onClick={() => void updateStaff({ clinicId, userId: row.user_id, role: row.role, isActive: !row.is_active, displayName: row.display_name ?? "" }).then(reload).catch((reason: unknown) => setError(errorText(reason)))}>{row.is_active ? "Deactivate" : "Activate"}</button>
                {row.user_id !== userId && <button type="button" className={dangerButton} onClick={() => void removeStaff(clinicId, row.user_id).then(reload).catch((reason: unknown) => setError(errorText(reason)))}>Remove</button>}
              </div>
            </li>
          ))}
        </ul>
        <form onSubmit={onAdd} className="grid sm:grid-cols-2 gap-3 pt-2">
          <Field label="Email"><input className={inputClass} type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
          <Field label="Name on the desk"><input className={inputClass} value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></Field>
          <Field label="Role">
            <select className={inputClass} value={role} onChange={(event) => setRole(event.target.value as StaffRole)}>
              <option value="desk">Desk</option>
              <option value="admin">Admin</option>
            </select>
          </Field>
          <div className="flex items-end"><button className={primaryButton} disabled={busy} type="submit">{busy ? "Adding…" : "Add staff"}</button></div>
        </form>
      </div>
    </Panel>
  );
}

function SettingsView({ clinicId, queues, onChanged }: { clinicId: string; queues: Queue[]; onChanged: () => void }) {
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [error, setError] = useState("");
  const [queueName, setQueueName] = useState("");
  const [queuePrefix, setQueuePrefix] = useState("");

  useEffect(() => {
    listClinics().then((rows) => setClinic(rows.find((item) => item.id === clinicId) ?? null)).catch((reason: unknown) => setError(errorText(reason)));
  }, [clinicId]);

  if (!clinic) return <Panel><p className="p-8 text-sm">Loading clinic settings…</p></Panel>;

  return (
    <Panel labelledBy="settings-heading">
      <div className="p-6 sm:p-8 space-y-6">
        <h2 id="settings-heading" className="text-xl font-extrabold">Clinic settings</h2>
        {error && <Banner kind="error">{error}</Banner>}
        <form className="grid sm:grid-cols-2 gap-3" onSubmit={(event) => {
          event.preventDefault();
          void updateClinic(clinic).then(() => setError("")).catch((reason: unknown) => setError(errorText(reason)));
        }}>
          <Field label="Name"><input className={inputClass} value={clinic.name} onChange={(event) => setClinic({ ...clinic, name: event.target.value })} /></Field>
          <Field label="Location"><input className={inputClass} value={clinic.location ?? ""} onChange={(event) => setClinic({ ...clinic, location: event.target.value })} /></Field>
          <Field label="Average minutes"><input className={inputClass} type="number" min={1} max={240} value={clinic.avg_minutes_per_patient} onChange={(event) => setClinic({ ...clinic, avg_minutes_per_patient: Number(event.target.value) })} /></Field>
          <label className="flex items-center gap-2 text-sm font-semibold mt-6"><input type="checkbox" checked={clinic.is_open} onChange={(event) => setClinic({ ...clinic, is_open: event.target.checked })} /> Clinic is open</label>
          <button className={primaryButton} type="submit">Save clinic</button>
        </form>
        <div className="space-y-3">
          <h3 className="font-bold">Queues</h3>
          {queues.map((queue) => (
            <QueueEditor key={`${queue.id}:${queue.name}:${queue.is_open}:${queue.ticket_prefix ?? ""}:${queue.avg_minutes_per_patient ?? ""}`} queue={queue} onSaved={onChanged} onError={setError} />
          ))}
          <form className="flex flex-wrap gap-2" onSubmit={(event) => {
            event.preventDefault();
            void createQueue({ clinicId, name: queueName.trim(), ticketPrefix: queuePrefix.trim().toUpperCase() || null })
              .then(() => {
                setQueueName("");
                setQueuePrefix("");
                onChanged();
              })
              .catch((reason: unknown) => setError(errorText(reason)));
          }}>
            <input className={inputClass} placeholder="New queue name" required value={queueName} onChange={(event) => setQueueName(event.target.value)} />
            <input className={inputClass} placeholder="Prefix" maxLength={6} value={queuePrefix} onChange={(event) => setQueuePrefix(event.target.value)} />
            <button className={primaryButton} type="submit">Add queue</button>
          </form>
        </div>
      </div>
    </Panel>
  );
}

function QueueEditor({ queue, onSaved, onError }: { queue: Queue; onSaved: () => void; onError: (message: string) => void }) {
  const [draft, setDraft] = useState(queue);
  return (
    <form className="grid sm:grid-cols-2 gap-2 rounded-2xl border border-slate-200 p-3" onSubmit={(event) => {
      event.preventDefault();
      void updateQueue({ ...draft, ticket_prefix: draft.ticket_prefix?.trim().toUpperCase() || null }).then(onSaved).catch((reason: unknown) => onError(errorText(reason)));
    }}>
      <input className={inputClass} aria-label={`${queue.name} name`} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
      <input className={inputClass} aria-label={`${queue.name} prefix`} value={draft.ticket_prefix ?? ""} onChange={(event) => setDraft({ ...draft, ticket_prefix: event.target.value })} />
      <input className={inputClass} aria-label={`${queue.name} minutes`} type="number" min={1} max={240} value={draft.avg_minutes_per_patient ?? ""} placeholder="Minutes" onChange={(event) => setDraft({ ...draft, avg_minutes_per_patient: event.target.value ? Number(event.target.value) : null })} />
      <label className="text-sm font-semibold flex items-center gap-2"><input type="checkbox" checked={draft.is_open} onChange={(event) => setDraft({ ...draft, is_open: event.target.checked })} /> Open</label>
      <button className={ghostButton} type="submit">Save {queue.name}</button>
    </form>
  );
}
