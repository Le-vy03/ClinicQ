import { departmentById } from "./catalog";
import type { Booking, Status } from "./types";

export function todayKey(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function todayLabel(now = new Date()): string {
  return now.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
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

export function normalizePhone(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("260")) digits = digits.slice(3);
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (!/^(9[5-7]|7[5-7])\d{7}$/.test(digits)) return null;
  return `+260 ${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
}

export function cleanName(input: string): string | null {
  const name = input.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 40) return null;
  if (!/^[A-Za-z][A-Za-z'’-]*(?: [A-Za-z][A-Za-z'’-]*)*$/.test(name)) return null;
  return name;
}

export function byQueue(a: Booking, b: Booking): number {
  if (a.slot !== b.slot) return a.slot < b.slot ? -1 : 1;
  if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
  return a.ticket < b.ticket ? -1 : 1;
}

export function isActive(booking: Booking): boolean {
  return booking.status === "waiting" || booking.status === "called";
}

export function queueFor(bookings: Booking[], clinicId: Booking["clinicId"], departmentId: Booking["departmentId"]): Booking[] {
  return bookings.filter((booking) => booking.clinicId === clinicId && booking.departmentId === departmentId && isActive(booking)).sort(byQueue);
}

export function positionOf(bookings: Booking[], booking: Booking): number {
  const index = queueFor(bookings, booking.clinicId, booking.departmentId).findIndex((item) => item.id === booking.id);
  return index === -1 ? 0 : index + 1;
}

export function aheadOf(bookings: Booking[], booking: Booking): Booking[] {
  return queueFor(bookings, booking.clinicId, booking.departmentId).filter((item) => byQueue(item, booking) < 0);
}

export function waitMinutes(bookings: Booking[], booking: Booking): number {
  if (booking.status !== "waiting") return 0;
  const ahead = aheadOf(bookings, booking).length;
  const average = departmentById(booking.departmentId).minutes;
  if (ahead === 0) return Math.max(4, Math.round(average / 2));
  return ahead * average;
}

export function waitLabel(booking: Booking, minutes: number): string {
  if (booking.status === "called") return "Go to the desk now";
  if (booking.status === "done") return "Visit complete";
  if (booking.status === "noshow") return "Place released";
  if (minutes < 10) return "Under 10 minutes";
  return `About ${minutes} minutes`;
}

export function placeLabel(booking: Booking, position: number): string {
  if (booking.status === "called") return "It's your turn";
  if (booking.status === "done") return "Seen";
  if (booking.status === "noshow") return "No-show";
  if (position <= 1) return "You are next";
  return `${ordinal(position)} in line`;
}

export function statusLabel(status: Status): string {
  switch (status) {
    case "waiting":
      return "Waiting";
    case "called":
      return "At the desk";
    case "done":
      return "Seen";
    case "noshow":
      return "No-show";
  }
}

export function ago(timestamp: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 20) return "Just now";
  if (seconds < 60) return `${seconds} sec ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return minutes === 1 ? "1 min ago" : `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 12) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  return "Earlier today";
}
