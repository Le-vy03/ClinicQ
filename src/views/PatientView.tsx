import { useState, type FormEvent } from "react";
import { CLINICS, DEPARTMENTS, SLOTS, clinicById, departmentById } from "../catalog";
import { aheadOf, firstName, placeLabel, statusLabel, todayLabel, waitLabel, waitMinutes } from "../format";
import { bookVisit, markNoShow, placesLeft, useClinicState } from "../store";
import type { ClinicId, DepartmentId } from "../types";

export function PatientView() {
  const state = useClinicState();
  const mine = state.bookings.find((item) => item.id === state.myTicketId);
  const [composing, setComposing] = useState(!mine);

  if (composing || !mine) {
    return <Wizard onBooked={() => setComposing(false)} onCancel={mine ? () => setComposing(false) : undefined} />;
  }

  const clinic = clinicById(mine.clinicId);
  const department = departmentById(mine.departmentId);
  const position = aheadOf(state.bookings, mine).length + (mine.status === "waiting" || mine.status === "called" ? 1 : 0);
  const activePosition = mine.status === "waiting" || mine.status === "called" ? position : 0;
  const minutes = waitMinutes(state.bookings, mine);
  const ahead = aheadOf(state.bookings, mine);
  const followup = state.notices.find((notice) => notice.bookingId === mine.id && notice.kind === "followup");
  const canLeave = mine.status === "waiting" || mine.status === "called";

  return (
    <section className="panel" aria-labelledby="patient-heading">
      <p className="eyebrow">Your visit · {todayLabel()}</p>
      <h2 id="patient-heading">Hold this ticket. The desk can see it.</h2>
      <article className={`ticket ${mine.status === "called" ? "is-turn" : ""} ${mine.status === "done" ? "is-done" : ""} ${mine.status === "noshow" ? "is-missed" : ""}`}>
        <div className="flagbar thin" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </div>
        {mine.status === "called" && <p className="banner banner-turn">It is your turn. Go to {department.name} now.</p>}
        {mine.status === "done" && <p className="banner banner-done">You have been seen. Thank you for coming.</p>}
        {mine.status === "noshow" && <p className="banner banner-miss">Your place was released.</p>}
        <div className="ticket-top">
          <div>
            <p className="ticket-kicker">{clinic.area}</p>
            <h3>{clinic.name}</h3>
            <p className="ticket-meta">
              {department.name} · today {mine.slot}
            </p>
          </div>
          <p className="who">
            {mine.patientName}
            <span>{mine.phone}</span>
          </p>
        </div>
        <div className="ticket-number">
          <p>Queue number</p>
          <p className="num" key={`${mine.ticket}-${mine.status}`}>{mine.ticket}</p>
        </div>
        <div className="ticket-stats">
          <div>
            <p>Place in line</p>
            <strong key={activePosition + mine.status}>{mine.status === "waiting" || mine.status === "called" ? placeLabel(mine, activePosition) : statusLabel(mine.status)}</strong>
          </div>
          <div>
            <p>Estimated wait</p>
            <strong>{waitLabel(mine, minutes)}</strong>
          </div>
        </div>
        {(mine.status === "waiting" || mine.status === "called") && (
          <p className="live" aria-live="polite">
            <i className="dot" aria-hidden="true" />
            Live · {ahead.length === 0 ? "You are at the front of this desk." : `${ahead.length} ${ahead.length === 1 ? "person" : "people"} ahead, about ${department.minutes} minutes each.`}
          </p>
        )}
        {mine.status === "waiting" && ahead.length > 0 && (
          <ol className="ahead">
            {ahead.map((person, index) => (
              <li key={person.id}>
                <span>{index + 1}</span>
                <b>{firstName(person.patientName)}</b>
                <em>
                  {person.status === "called" ? "At the desk" : person.slot} · {person.ticket}
                </em>
              </li>
            ))}
          </ol>
        )}
        {mine.status === "done" && followup && <p className="follow">{followup.body}</p>}
        {mine.status === "noshow" && <p className="follow">The desk moved on. Book again when you are on the way and you will get a new number.</p>}
      </article>
      <div className="row-actions">
        <button className="btn btn-primary" type="button" onClick={() => setComposing(true)}>
          {canLeave ? "Book for someone else" : "Book another visit"}
        </button>
        {canLeave && (
          <button className="btn btn-danger" type="button" onClick={() => markNoShow(mine.id, "patient")}>
            I can't make it
          </button>
        )}
      </div>
    </section>
  );
}

function Wizard({ onBooked, onCancel }: { onBooked: () => void; onCancel?: () => void }) {
  const state = useClinicState();
  const [step, setStep] = useState(1);
  const [clinicId, setClinicId] = useState<ClinicId>("uth");
  const [departmentId, setDepartmentId] = useState<DepartmentId>("opd");
  const [slot, setSlot] = useState<string>("09:00");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");

  const clinic = clinicById(clinicId);
  const department = departmentById(departmentId);
  const morning = SLOTS.filter((item) => item < "12:00");
  const afternoon = SLOTS.filter((item) => item >= "12:00");

  function submit(event: FormEvent) {
    event.preventDefault();
    const result = bookVisit({ clinicId, departmentId, slot, name, phone });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onBooked();
  }

  return (
    <section className="panel" aria-labelledby="book-heading">
      <p className="eyebrow">Book a visit · step {step} of 4</p>
      <h2 id="book-heading">{step === 1 ? "Choose a clinic" : step === 2 ? "Choose a desk" : step === 3 ? "Choose a time today" : "Your name and phone"}</h2>
      {(step > 1 || onCancel) && (
        <p className="crumbs">
          {step > 1 && <button type="button" onClick={() => setStep(1)}>{clinic.short}</button>}
          {step > 2 && <button type="button" onClick={() => setStep(2)}>{department.name}</button>}
          {step > 3 && <button type="button" onClick={() => setStep(3)}>{slot}</button>}
          {onCancel && <button type="button" onClick={onCancel}>Back to my ticket</button>}
        </p>
      )}

      {step === 1 && (
        <div className="choice-list">
          {CLINICS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`choice ${clinicId === item.id ? "is-selected" : ""}`}
              aria-pressed={clinicId === item.id}
              onClick={() => {
                setClinicId(item.id);
                setStep(2);
              }}
            >
              <strong>{item.name}</strong>
              <span>{item.area}</span>
              <small>{item.note}</small>
            </button>
          ))}
        </div>
      )}

      {step === 2 && (
        <div className="choice-list">
          {DEPARTMENTS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`choice ${departmentId === item.id ? "is-selected" : ""}`}
              aria-pressed={departmentId === item.id}
              onClick={() => {
                setDepartmentId(item.id);
                setStep(3);
              }}
            >
              <strong>{item.name}</strong>
              <span>About {item.minutes} min a patient</span>
              <small>{item.blurb}</small>
            </button>
          ))}
          <button className="btn btn-ghost" type="button" onClick={() => setStep(1)}>Back</button>
        </div>
      )}

      {step === 3 && (
        <div className="slots-wrap">
          <SlotGroup
            label="Morning"
            slots={morning}
            selected={slot}
            clinicId={clinicId}
            departmentId={departmentId}
            bookings={state.bookings}
            onPick={(value) => {
              setSlot(value);
              setStep(4);
            }}
          />
          <SlotGroup
            label="Afternoon"
            slots={afternoon}
            selected={slot}
            clinicId={clinicId}
            departmentId={departmentId}
            bookings={state.bookings}
            onPick={(value) => {
              setSlot(value);
              setStep(4);
            }}
          />
          <button className="btn btn-ghost" type="button" onClick={() => setStep(2)}>Back</button>
        </div>
      )}

      {step === 4 && (
        <form className="book-form" onSubmit={submit}>
          <p className="summary">
            {clinic.name} · {department.name} · today {slot}
          </p>
          <label>
            Full name
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Grace Banda" autoComplete="name" required />
          </label>
          <label>
            Mobile number
            <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+260 97 123 4567" inputMode="tel" autoComplete="tel" required />
          </label>
          <p className="hint">Airtel 097, MTN 096, or Zamtel 095. We only use it for this visit's messages.</p>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="row-actions">
            <button className="btn btn-primary" type="submit">Get my queue number</button>
            <button className="btn btn-ghost" type="button" onClick={() => setStep(3)}>Back</button>
          </div>
        </form>
      )}
    </section>
  );
}

function SlotGroup({
  label,
  slots,
  selected,
  clinicId,
  departmentId,
  bookings,
  onPick,
}: {
  label: string;
  slots: string[];
  selected: string;
  clinicId: ClinicId;
  departmentId: DepartmentId;
  bookings: ReturnType<typeof useClinicState>["bookings"];
  onPick: (slot: string) => void;
}) {
  return (
    <fieldset className="slots">
      <legend>{label}</legend>
      <div className="slot-grid">
        {slots.map((item) => {
          const left = placesLeft(bookings, clinicId, departmentId, item);
          const full = left === 0;
          return (
            <button
              key={item}
              type="button"
              className={`slot ${selected === item ? "is-selected" : ""}`}
              aria-pressed={selected === item}
              disabled={full}
              onClick={() => onPick(item)}
            >
              <b>{item}</b>
              <small>{full ? "Full" : left === 1 ? "1 left" : `${left} left`}</small>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
