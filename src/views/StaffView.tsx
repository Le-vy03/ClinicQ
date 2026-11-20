import { useState } from "react";
import { CLINICS, DEPARTMENTS, clinicById, departmentById } from "../catalog";
import { byQueue, statusLabel, todayLabel } from "../format";
import { activeCount, callNext, markDone, markNoShow, useClinicState } from "../store";
import type { ClinicId, DepartmentId } from "../types";

export function StaffView() {
  const state = useClinicState();
  const [clinicId, setClinicId] = useState<ClinicId>("uth");
  const [departmentId, setDepartmentId] = useState<DepartmentId>("opd");
  const clinic = clinicById(clinicId);
  const department = departmentById(departmentId);
  const inDesk = state.bookings
    .filter((item) => item.clinicId === clinicId && item.departmentId === departmentId)
    .sort(byQueue);
  const called = inDesk.find((item) => item.status === "called");
  const waiting = inDesk.filter((item) => item.status === "waiting");
  const finished = inDesk.filter((item) => item.status === "done" || item.status === "noshow").sort((a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0));

  return (
    <section className="panel" aria-labelledby="staff-heading">
      <p className="eyebrow">Staff desk · {todayLabel()}</p>
      <h2 id="staff-heading">Today's queue</h2>
      <p className="lede">Call patients in order. Their ticket on this phone updates straight away.</p>

      <div className="pills" role="tablist" aria-label="Clinic">
        {CLINICS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`pill ${clinicId === item.id ? "is-on" : ""}`}
            aria-pressed={clinicId === item.id}
            onClick={() => {
              setClinicId(item.id);
              const busiest = [...DEPARTMENTS].sort((a, b) => activeCount(state.bookings, item.id, b.id) - activeCount(state.bookings, item.id, a.id))[0];
              setDepartmentId(busiest?.id ?? "opd");
            }}
          >
            {item.short}
            <span>{activeCount(state.bookings, item.id)}</span>
          </button>
        ))}
      </div>

      <div className="pills" role="tablist" aria-label="Department">
        {DEPARTMENTS.map((item) => (
          <button key={item.id} type="button" className={`pill ${departmentId === item.id ? "is-on" : ""}`} aria-pressed={departmentId === item.id} onClick={() => setDepartmentId(item.id)}>
            {item.name}
            <span>{activeCount(state.bookings, clinicId, item.id)}</span>
          </button>
        ))}
      </div>

      <p className="desk-line">
        {clinic.name} · {department.name}
      </p>

      {called ? (
        <article className="now-card">
          <p className="now-kicker">Now calling</p>
          <h3>{called.patientName}</h3>
          <p>
            {called.ticket} · {called.slot} · {called.phone}
          </p>
          <div className="row-actions">
            <button className="btn btn-primary" type="button" onClick={() => markDone(called.id)}>Mark as seen</button>
            <button className="btn btn-danger" type="button" onClick={() => markNoShow(called.id, "staff")}>No-show</button>
          </div>
        </article>
      ) : (
        <p className="quiet">No one is at the desk yet.</p>
      )}

      <button className="btn btn-orange btn-block" type="button" disabled={Boolean(called) || waiting.length === 0} onClick={() => callNext(clinicId, departmentId)}>
        Call next patient
      </button>
      <p className="hint">
        {called ? `Mark ${called.patientName.split(" ")[0]} as seen or a no-show before calling the next person.` : waiting.length === 0 ? "No one is waiting in this department." : `${waiting.length} waiting. The next call is ${waiting[0].patientName.split(" ")[0]}.`}
      </p>

      <div className="stats">
        <p><b>{waiting.length}</b> waiting</p>
        <p><b>{called ? 1 : 0}</b> at desk</p>
        <p><b>{finished.filter((item) => item.status === "done").length}</b> seen</p>
        <p><b>{finished.filter((item) => item.status === "noshow").length}</b> no-show</p>
      </div>

      {waiting.length === 0 ? (
        <p className="empty">No one is waiting at {department.name}. Patients who book on ClinicQ line up here, in order.</p>
      ) : (
        <ol className="queue">
          {waiting.map((item, index) => (
            <li key={item.id} className={item.id === state.myTicketId ? "is-yours" : ""}>
              <span className="q-pos">{(called ? 2 : 1) + index}</span>
              <div>
                <strong>
                  {item.patientName}
                  {item.id === state.myTicketId && <em className="you-tag">Patient screen</em>}
                </strong>
                <p>
                  {item.ticket} · {item.slot} · {item.phone}
                </p>
              </div>
              <button className="text-btn" type="button" onClick={() => markNoShow(item.id, "staff")}>No-show</button>
            </li>
          ))}
        </ol>
      )}

      {finished.length > 0 && (
        <div className="finished">
          <h3>Earlier today</h3>
          <ul>
            {finished.map((item) => (
              <li key={item.id}>
                <span>{item.patientName}</span>
                <small>{item.ticket}</small>
                <em className={item.status === "noshow" ? "bad" : ""}>{statusLabel(item.status)}</em>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
