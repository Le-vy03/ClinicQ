import type { NotificationStatus, TicketStatus } from "../types";

export function errorText(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "Something went wrong. Please try again.";
}

export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export function statusLabel(status: TicketStatus | string): string {
  switch (status) {
    case "waiting":
      return "Waiting";
    case "called":
      return "Called";
    case "serving":
      return "Being seen";
    case "done":
      return "Done";
    case "no_show":
      return "No-show";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

export function noticeStatusLabel(status: NotificationStatus): string {
  switch (status) {
    case "pending":
      return "Pending — SMS sending not connected yet";
    case "skipped":
      return "Skipped — no phone number";
    case "sent":
      return "Sent";
    case "failed":
      return "Failed";
    default:
      return status;
  }
}

export function formatServiceDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function formatTime(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Lusaka",
  });
}

export function waitLabel(minutes: number | null | undefined): string {
  if (minutes == null || Number.isNaN(minutes)) return "—";
  if (minutes <= 0) return "Now";
  return `~${minutes} min${minutes === 1 ? "" : "s"}`;
}

export function progressPercent(status: TicketStatus, peopleAhead: number): number {
  if (status === "cancelled" || status === "no_show") return 0;
  if (status === "called" || status === "serving" || status === "done") return 100;
  return Math.max(8, Math.min(100, Math.round(100 / (peopleAhead + 1))));
}

export function cleanName(input: string): string | null {
  const name = input.trim().replace(/\s+/g, " ");
  if (name.length < 1 || name.length > 100) return null;
  return name;
}

export function cleanPhone(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  return trimmed;
}

export function ticketLink(ticketId: string, accessToken: string): string {
  const base = import.meta.env.BASE_URL || "/";
  const prefix = base.endsWith("/") ? base : `${base}/`;
  return `${window.location.origin}${prefix}#/ticket/${ticketId}?t=${encodeURIComponent(accessToken)}`;
}

export function playCallChime() {
  const audioWindow = window as Window & { webkitAudioContext?: typeof AudioContext };
  const Context = window.AudioContext ?? audioWindow.webkitAudioContext;
  if (!Context) return;
  const context = new Context();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = 880;
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.45);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.46);
  oscillator.onended = () => void context.close();
}

export async function notifyCalled(code: string, desk: string | null) {
  const body = desk ? `Go to ${desk}. Ticket ${code}.` : `Please come to the desk. Ticket ${code}.`;
  try {
    playCallChime();
  } catch {
    /* sound is optional */
  }
  if (typeof Notification === "undefined") return;
  let permission = Notification.permission;
  if (permission === "default") {
    try {
      permission = await Notification.requestPermission();
    } catch {
      return;
    }
  }
  if (permission === "granted") {
    new Notification("ClinicQ — your turn", { body });
  }
}
