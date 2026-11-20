import { clinicById, departmentById } from "./catalog";
import { firstName, ordinal, positionOf, waitMinutes } from "./format";
import type { Booking, Notice } from "./types";

const minute = 60_000;

export function confirmationBody(bookings: Booking[], booking: Booking): string {
  const clinic = clinicById(booking.clinicId);
  const department = departmentById(booking.departmentId);
  const position = positionOf(bookings, booking);
  const wait = waitMinutes(bookings, booking);
  return `ClinicQ: Hello ${firstName(booking.patientName)}. You are booked at ${clinic.short}, ${department.name}, today ${booking.slot}. Ticket ${booking.ticket}. You are ${ordinal(position)} in line, about ${wait} minutes. No need to queue from 05:00. We will message you when to start heading in. Bring your NRC if you have it.`;
}

export function headingBody(booking: Booking, position: number): string {
  const clinic = clinicById(booking.clinicId);
  const department = departmentById(booking.departmentId);
  const line = position === 1 ? "you are next in line" : position === 2 ? "you are now 2nd in line" : "you are 3rd in line";
  return `Hi ${firstName(booking.patientName)}, ${line} at ${clinic.short} ${department.name}. Start heading in so you do not lose your place. The walk from the rank can take a while. Ticket ${booking.ticket}. We will message you when it is your turn.`;
}

export function turnBody(booking: Booking): string {
  const clinic = clinicById(booking.clinicId);
  const department = departmentById(booking.departmentId);
  return `${firstName(booking.patientName)}, it is your turn. Please come to the ${department.name} desk at ${clinic.name} now. Ticket ${booking.ticket}. We can hold your place for 5 minutes, then we call the next person.`;
}

export function followupBody(booking: Booking): string {
  const clinic = clinicById(booking.clinicId);
  const name = firstName(booking.patientName);
  switch (booking.departmentId) {
    case "maternal":
      return `Thank you, ${name}. Reminder from ${clinic.short} Maternal Health: take your iron tablets this evening with food, and keep your next antenatal date. If you have heavy bleeding, a bad headache, or the baby is moving less, come back straight away.`;
    case "paeds":
      return `Thank you for coming to ${clinic.short}. Give the full course of medicine, even when the child looks better, and keep fluids going. Come back the same day if the fever will not come down, the breathing is fast, or they stop feeding.`;
    case "art":
      return `Thank you, ${name}. Reminder: take your ART this evening at the usual time. Do not share the medicine. If you miss a dose, take it when you remember, and come back to ${clinic.short} if you feel unwell.`;
    case "dental":
      return `Thank you, ${name}. Soft food today, and avoid very hot drinks until the numbness wears off. If the pain is worse tomorrow, come back to the dental desk at ${clinic.short}.`;
    default:
      return `Thank you for coming to ${clinic.short}, ${name}. If you were given medicine, collect it at the pharmacy before 16:00 and take it with food. Rest today. If you feel worse tonight, come back or call 991.`;
  }
}

export function noshowBody(booking: Booking, by: "staff" | "patient"): string {
  const clinic = clinicById(booking.clinicId);
  if (by === "patient") {
    return `ClinicQ: ${firstName(booking.patientName)}, you have given up ticket ${booking.ticket} at ${clinic.short}. Your place has gone to the next patient. You can book again when you are on the way.`;
  }
  return `Hello ${firstName(booking.patientName)}, we called ticket ${booking.ticket} at ${clinic.short} and you were not there. We have released your place so the next patient can be seen. You can book again on ClinicQ when you are on the way.`;
}

export function makeNotice(input: Omit<Notice, "id"> & { id?: string }): Notice {
  return {
    id: input.id ?? crypto.randomUUID(),
    channel: input.channel,
    kind: input.kind,
    to: input.to,
    patientName: input.patientName,
    clinicId: input.clinicId,
    bookingId: input.bookingId,
    body: input.body,
    createdAt: input.createdAt,
  };
}

export function baseNotice(booking: Booking, createdAt: number, id?: string): Pick<Notice, "id" | "to" | "patientName" | "clinicId" | "bookingId" | "createdAt"> {
  return {
    id: id ?? crypto.randomUUID(),
    to: booking.phone,
    patientName: booking.patientName,
    clinicId: booking.clinicId,
    bookingId: booking.id,
    createdAt,
  };
}

export { minute };
