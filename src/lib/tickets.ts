import type { SavedTicket } from "../types";

const KEY = "clinicq.tickets";

function isSaved(value: unknown): value is SavedTicket {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<SavedTicket>;
  return Boolean(row.ticketId && row.accessToken && row.ticketCode && row.queueId && row.clinicId && row.patientName);
}

export function loadTickets(): SavedTicket[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSaved);
  } catch {
    return [];
  }
}

export function saveTicket(ticket: SavedTicket) {
  const next = [ticket, ...loadTickets().filter((item) => item.ticketId !== ticket.ticketId)];
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("clinicq-tickets"));
}

export function ticketById(ticketId: string): SavedTicket | undefined {
  return loadTickets().find((item) => item.ticketId === ticketId);
}

export function forgetDemoState() {
  localStorage.removeItem("clinicq.desk.v1");
}
