import { useSyncExternalStore } from "react";
import { clinicById, departmentById, SLOT_CAPACITY } from "./catalog";
import { baseNotice, confirmationBody, followupBody, headingBody, makeNotice, minute, noshowBody, turnBody } from "./copy";
import { byQueue, cleanName, isActive, normalizePhone, positionOf, queueFor, todayKey } from "./format";
import type { Booking, ClinicId, DepartmentId, Notice, State } from "./types";

const KEY = "clinicq.v1";

function atMorning(minutesFromSix: number): number {
  const start = new Date();
  start.setHours(6, 0, 0, 0);
  return start.getTime() + minutesFromSix * minute;
}

function booking(input: Booking): Booking {
  return input;
}

function seed(): State {
  const now = Date.now();
  const bookings: Booking[] = [
    booking({
      id: "bk-kelvin",
      ticket: "UTH-113",
      clinicId: "uth",
      departmentId: "opd",
      slot: "07:30",
      patientName: "Kelvin Mbewe",
      phone: "+260 95 610 2284",
      status: "noshow",
      createdAt: atMorning(10),
      closedAt: now - 33 * minute,
      headingSent: true,
    }),
    booking({
      id: "bk-mutale",
      ticket: "UTH-114",
      clinicId: "uth",
      departmentId: "opd",
      slot: "07:30",
      patientName: "Mutale Phiri",
      phone: "+260 97 711 2044",
      status: "called",
      createdAt: atMorning(18),
      headingSent: true,
    }),
    booking({
      id: "bk-natasha",
      ticket: "UTH-115",
      clinicId: "uth",
      departmentId: "opd",
      slot: "07:30",
      patientName: "Natasha Mwansa",
      phone: "+260 96 455 8812",
      status: "waiting",
      createdAt: atMorning(26),
      headingSent: true,
    }),
    booking({
      id: "bk-joseph",
      ticket: "UTH-116",
      clinicId: "uth",
      departmentId: "opd",
      slot: "08:00",
      patientName: "Joseph Bwalya",
      phone: "+260 95 332 1098",
      status: "waiting",
      createdAt: atMorning(34),
      headingSent: true,
    }),
    booking({
      id: "bk-chanda",
      ticket: "UTH-117",
      clinicId: "uth",
      departmentId: "opd",
      slot: "08:00",
      patientName: "Chanda Mulenga",
      phone: "+260 97 220 6641",
      status: "waiting",
      createdAt: atMorning(41),
      headingSent: true,
    }),
    booking({
      id: "bk-lweendo",
      ticket: "UTH-118",
      clinicId: "uth",
      departmentId: "opd",
      slot: "08:30",
      patientName: "Lweendo Tembo",
      phone: "+260 97 418 6620",
      status: "waiting",
      createdAt: atMorning(52),
      headingSent: false,
    }),
    booking({
      id: "bk-brian",
      ticket: "UTH-119",
      clinicId: "uth",
      departmentId: "opd",
      slot: "08:30",
      patientName: "Brian Zulu",
      phone: "+260 96 778 3310",
      status: "waiting",
      createdAt: atMorning(63),
      headingSent: true,
    }),
    booking({
      id: "bk-bupe",
      ticket: "CHI-088",
      clinicId: "chilenje",
      departmentId: "maternal",
      slot: "08:00",
      patientName: "Bupe Sakala",
      phone: "+260 97 553 0194",
      status: "called",
      createdAt: atMorning(22),
      headingSent: true,
    }),
    booking({
      id: "bk-inonge",
      ticket: "CHI-089",
      clinicId: "chilenje",
      departmentId: "maternal",
      slot: "08:00",
      patientName: "Inonge Hamoonga",
      phone: "+260 96 214 7781",
      status: "waiting",
      createdAt: atMorning(30),
      headingSent: true,
    }),
    booking({
      id: "bk-thandiwe",
      ticket: "CHI-090",
      clinicId: "chilenje",
      departmentId: "maternal",
      slot: "08:30",
      patientName: "Thandiwe Ngoma",
      phone: "+260 97 880 4412",
      status: "waiting",
      createdAt: atMorning(44),
      headingSent: true,
    }),
    booking({
      id: "bk-memory",
      ticket: "CHI-091",
      clinicId: "chilenje",
      departmentId: "maternal",
      slot: "09:00",
      patientName: "Memory Daka",
      phone: "+260 95 267 9033",
      status: "waiting",
      createdAt: atMorning(58),
      headingSent: true,
    }),
    booking({
      id: "bk-peter",
      ticket: "KAN-054",
      clinicId: "kanyama",
      departmentId: "paeds",
      slot: "08:30",
      patientName: "Peter Kaluba",
      phone: "+260 96 501 2287",
      status: "called",
      createdAt: atMorning(28),
      headingSent: true,
    }),
    booking({
      id: "bk-ruth",
      ticket: "KAN-055",
      clinicId: "kanyama",
      departmentId: "paeds",
      slot: "09:00",
      patientName: "Ruth Chileshe",
      phone: "+260 97 334 6150",
      status: "waiting",
      createdAt: atMorning(40),
      headingSent: true,
    }),
    booking({
      id: "bk-aaron",
      ticket: "KAN-056",
      clinicId: "kanyama",
      departmentId: "paeds",
      slot: "09:00",
      patientName: "Aaron Phiri",
      phone: "+260 95 778 2046",
      status: "waiting",
      createdAt: atMorning(49),
      headingSent: true,
    }),
    booking({
      id: "bk-esther",
      ticket: "MAT-033",
      clinicId: "matero",
      departmentId: "art",
      slot: "07:30",
      patientName: "Esther Mwanza",
      phone: "+260 97 612 8804",
      status: "done",
      createdAt: atMorning(12),
      closedAt: now - 46 * minute,
      headingSent: true,
    }),
    booking({
      id: "bk-gift",
      ticket: "MAT-034",
      clinicId: "matero",
      departmentId: "art",
      slot: "08:00",
      patientName: "Gift Lungu",
      phone: "+260 96 445 1173",
      status: "waiting",
      createdAt: atMorning(24),
      headingSent: true,
    }),
    booking({
      id: "bk-daniel",
      ticket: "MAT-035",
      clinicId: "matero",
      departmentId: "art",
      slot: "08:30",
      patientName: "Daniel Sichone",
      phone: "+260 97 290 5541",
      status: "waiting",
      createdAt: atMorning(36),
      headingSent: true,
    }),
    booking({
      id: "bk-naomi",
      ticket: "MAT-036",
      clinicId: "matero",
      departmentId: "art",
      slot: "09:00",
      patientName: "Naomi Banda",
      phone: "+260 95 863 7720",
      status: "waiting",
      createdAt: atMorning(47),
      headingSent: true,
    }),
  ];

  const find = (id: string) => bookings.find((item) => item.id === id)!;

  const notices: Notice[] = [
    makeNotice({
      ...baseNotice(find("bk-peter"), now - 6 * minute, "nt-peter"),
      channel: "whatsapp",
      kind: "turn",
      body: turnBody(find("bk-peter")),
    }),
    makeNotice({
      ...baseNotice(find("bk-thandiwe"), now - 12 * minute, "nt-thandiwe"),
      channel: "whatsapp",
      kind: "heading",
      body: headingBody(find("bk-thandiwe"), 3),
    }),
    makeNotice({
      ...baseNotice(find("bk-bupe"), now - 20 * minute, "nt-bupe"),
      channel: "whatsapp",
      kind: "turn",
      body: turnBody(find("bk-bupe")),
    }),
    makeNotice({
      ...baseNotice(find("bk-kelvin"), now - 33 * minute, "nt-kelvin"),
      channel: "sms",
      kind: "noshow",
      body: noshowBody(find("bk-kelvin"), "staff"),
    }),
    makeNotice({
      ...baseNotice(find("bk-esther"), now - 46 * minute, "nt-esther"),
      channel: "sms",
      kind: "followup",
      body: followupBody(find("bk-esther")),
    }),
    makeNotice({
      ...baseNotice(find("bk-lweendo"), now - 70 * minute, "nt-lweendo"),
      channel: "sms",
      kind: "confirmation",
      body: confirmationBody(bookings, find("bk-lweendo")),
    }),
  ];

  return {
    day: todayKey(),
    bookings,
    notices,
    myTicketId: "bk-lweendo",
    sequences: { uth: 120, chilenje: 92, kanyama: 57, matero: 37 },
  };
}

function validState(value: unknown): value is State {
  if (!value || typeof value !== "object") return false;
  const state = value as State;
  return state.day === todayKey() && Array.isArray(state.bookings) && Array.isArray(state.notices) && Boolean(state.sequences);
}

function readState(): State {
  try {
    if (typeof localStorage === "undefined") return seed();
    const raw = localStorage.getItem(KEY);
    if (!raw) return seed();
    const parsed: unknown = JSON.parse(raw);
    if (validState(parsed)) return parsed;
  } catch {
    /* reseed below */
  }
  return seed();
}

let state = readState();
const listeners = new Set<() => void>();

if (typeof localStorage !== "undefined") {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!validState(parsed)) localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    localStorage.setItem(KEY, JSON.stringify(state));
  }
}

function persist() {
  if (typeof localStorage !== "undefined") localStorage.setItem(KEY, JSON.stringify(state));
  listeners.forEach((listener) => listener());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== KEY || !event.newValue) return;
    try {
      const parsed: unknown = JSON.parse(event.newValue);
      if (validState(parsed)) {
        state = parsed;
        listeners.forEach((listener) => listener());
      }
    } catch {
      /* ignore broken writes from another tab */
    }
  });
}

export function getState(): State {
  return state;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useClinicState(): State {
  return useSyncExternalStore(subscribe, getState, getState);
}

function draft(): State {
  return structuredClone(state);
}

function save(next: State) {
  next.notices = next.notices.slice(0, 40);
  state = next;
  persist();
}

function collectHeadings(next: State): Notice[] {
  const created: Notice[] = [];
  for (const item of next.bookings) {
    if (item.status !== "waiting" || item.headingSent) continue;
    const position = positionOf(next.bookings, item);
    if (position >= 1 && position <= 3) {
      item.headingSent = true;
      created.push(
        makeNotice({
          ...baseNotice(item, Date.now()),
          channel: "whatsapp",
          kind: "heading",
          body: headingBody(item, position),
        }),
      );
    }
  }
  return created;
}

export function placesLeft(bookings: Booking[], clinicId: ClinicId, departmentId: DepartmentId, slot: string): number {
  const used = bookings.filter((item) => item.clinicId === clinicId && item.departmentId === departmentId && item.slot === slot && isActive(item)).length;
  return Math.max(0, SLOT_CAPACITY - used);
}

export function bookVisit(input: { clinicId: ClinicId; departmentId: DepartmentId; slot: string; name: string; phone: string }): { ok: true } | { ok: false; error: string } {
  const name = cleanName(input.name);
  if (!name) return { ok: false, error: "Enter the patient name, for example Grace Banda." };
  const phone = normalizePhone(input.phone);
  if (!phone) return { ok: false, error: "Use a Zambian mobile number, for example +260 97 123 4567." };

  const next = draft();
  if (placesLeft(next.bookings, input.clinicId, input.departmentId, input.slot) < 1) {
    return { ok: false, error: "That window just filled. Pick another time." };
  }

  const sequence = next.sequences[input.clinicId];
  const ticket = `${clinicById(input.clinicId).code}-${String(sequence).padStart(3, "0")}`;
  next.sequences[input.clinicId] = sequence + 1;
  const created: Booking = {
    id: crypto.randomUUID(),
    ticket,
    clinicId: input.clinicId,
    departmentId: input.departmentId,
    slot: input.slot,
    patientName: name,
    phone,
    status: "waiting",
    createdAt: Date.now(),
    headingSent: false,
  };
  next.bookings.push(created);
  next.myTicketId = created.id;
  const confirmation = makeNotice({
    ...baseNotice(created, Date.now()),
    channel: "sms",
    kind: "confirmation",
    body: confirmationBody(next.bookings, created),
  });
  const headings = collectHeadings(next);
  next.notices = [...headings, confirmation, ...next.notices];
  save(next);
  return { ok: true };
}

export function callNext(clinicId: ClinicId, departmentId: DepartmentId): void {
  const next = draft();
  const called = next.bookings.find((item) => item.clinicId === clinicId && item.departmentId === departmentId && item.status === "called");
  if (called) return;
  const waiting = queueFor(next.bookings, clinicId, departmentId).find((item) => item.status === "waiting");
  if (!waiting) return;
  waiting.status = "called";
  const turn = makeNotice({
    ...baseNotice(waiting, Date.now()),
    channel: "whatsapp",
    kind: "turn",
    body: turnBody(waiting),
  });
  const headings = collectHeadings(next);
  next.notices = [turn, ...headings, ...next.notices];
  save(next);
}

export function markDone(id: string): void {
  const next = draft();
  const item = next.bookings.find((booking) => booking.id === id);
  if (!item || (item.status !== "called" && item.status !== "waiting")) return;
  item.status = "done";
  item.closedAt = Date.now();
  const followup = makeNotice({
    ...baseNotice(item, Date.now()),
    channel: "sms",
    kind: "followup",
    body: followupBody(item),
  });
  const headings = collectHeadings(next);
  next.notices = [...headings, followup, ...next.notices];
  save(next);
}

export function markNoShow(id: string, by: "staff" | "patient"): void {
  const next = draft();
  const item = next.bookings.find((booking) => booking.id === id);
  if (!item || (item.status !== "called" && item.status !== "waiting")) return;
  item.status = "noshow";
  item.closedAt = Date.now();
  const notice = makeNotice({
    ...baseNotice(item, Date.now()),
    channel: "sms",
    kind: "noshow",
    body: noshowBody(item, by),
  });
  const headings = collectHeadings(next);
  next.notices = [...headings, notice, ...next.notices];
  save(next);
}

export function advanceDemo(): { note: string; running: boolean } {
  const clinicId: ClinicId = "uth";
  const departmentId: DepartmentId = "opd";
  const next = draft();
  const called = next.bookings.find((item) => item.clinicId === clinicId && item.departmentId === departmentId && item.status === "called");
  const followups: Notice[] = [];
  if (called) {
    called.status = "done";
    called.closedAt = Date.now();
    followups.push(
      makeNotice({
        ...baseNotice(called, Date.now()),
        channel: "sms",
        kind: "followup",
        body: followupBody(called),
      }),
    );
  }
  const upcoming = next.bookings
    .filter((item) => item.clinicId === clinicId && item.departmentId === departmentId && item.status === "waiting")
    .sort(byQueue)[0];
  const turns: Notice[] = [];
  if (upcoming) {
    upcoming.status = "called";
    turns.push(
      makeNotice({
        ...baseNotice(upcoming, Date.now()),
        channel: "whatsapp",
        kind: "turn",
        body: turnBody(upcoming),
      }),
    );
  }
  const headings = collectHeadings(next);
  next.notices = [...turns, ...headings, ...followups, ...next.notices];
  save(next);

  const desk = departmentById(departmentId).name;
  if (upcoming && called) {
    return {
      note: `${called.patientName.split(" ")[0]} seen. Now calling ${upcoming.patientName.split(" ")[0]} · ${upcoming.ticket} at UTH ${desk}.`,
      running: true,
    };
  }
  if (upcoming) {
    return { note: `Now calling ${upcoming.patientName.split(" ")[0]} · ${upcoming.ticket} at UTH ${desk}.`, running: true };
  }
  if (called) {
    return { note: `${called.patientName.split(" ")[0]} seen. The UTH ${desk} queue is clear.`, running: false };
  }
  return { note: "The UTH General OPD queue is clear. Reset the demo day to play it again.", running: false };
}

export function resetDay(): void {
  state = seed();
  persist();
}

export function activeCount(bookings: Booking[], clinicId: ClinicId, departmentId?: DepartmentId): number {
  return bookings.filter((item) => item.clinicId === clinicId && (!departmentId || item.departmentId === departmentId) && isActive(item)).length;
}
