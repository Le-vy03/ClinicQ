import type {
  Clinic,
  Queue,
  QueueSummary,
  StaffDirectoryRow,
  StaffMembership,
  StaffNotice,
  TakeTicketResult,
  TicketRow,
  TicketSnapshot,
  TicketStatus,
} from "../types";
import { supabase } from "./supabase";

function fail(error: { message: string } | null): asserts error is null {
  if (error) throw new Error(error.message);
}

export async function listClinics(): Promise<Clinic[]> {
  const { data, error } = await supabase
    .from("clinics")
    .select("id, name, location, ticket_prefix, avg_minutes_per_patient, timezone, is_open")
    .order("name");
  fail(error);
  return (data ?? []) as Clinic[];
}

export async function listQueues(clinicId: string): Promise<Queue[]> {
  const { data, error } = await supabase
    .from("queues")
    .select("id, clinic_id, name, ticket_prefix, avg_minutes_per_patient, daily_ticket_limit, is_open, sort_order")
    .eq("clinic_id", clinicId)
    .order("sort_order")
    .order("name");
  fail(error);
  return (data ?? []) as Queue[];
}

export async function queueSummary(queueId: string): Promise<QueueSummary> {
  const { data, error } = await supabase.rpc("get_queue_summary", { p_queue_id: queueId });
  fail(error);
  return data as QueueSummary;
}

export async function takeTicket(input: {
  queueId: string;
  name: string;
  phone: string | null;
  bookedForSomeoneElse: boolean;
}): Promise<TakeTicketResult> {
  const { data, error } = await supabase.rpc("take_ticket", {
    p_queue_id: input.queueId,
    p_patient_name: input.name,
    p_patient_phone: input.phone,
    p_booked_for_someone_else: input.bookedForSomeoneElse,
  });
  fail(error);
  return data as TakeTicketResult;
}

export async function ticketStatus(ticketId: string, accessToken: string): Promise<TicketSnapshot> {
  const { data, error } = await supabase.rpc("get_ticket_status", {
    p_ticket_id: ticketId,
    p_access_token: accessToken,
  });
  fail(error);
  return data as TicketSnapshot;
}

export async function cancelTicket(ticketId: string, accessToken: string): Promise<{ status: TicketStatus }> {
  const { data, error } = await supabase.rpc("cancel_ticket", {
    p_ticket_id: ticketId,
    p_access_token: accessToken,
  });
  fail(error);
  return data as { status: TicketStatus };
}

export async function myMemberships(userId: string): Promise<StaffMembership[]> {
  const { data, error } = await supabase
    .from("staff_members")
    .select("clinic_id, role, display_name, is_active, clinics(id, name, location, ticket_prefix, avg_minutes_per_patient, timezone, is_open)")
    .eq("user_id", userId)
    .eq("is_active", true);
  fail(error);
  return (data ?? []).map((row) => {
    const record = row as StaffMembership & { clinics: Clinic | Clinic[] | null };
    const clinics = Array.isArray(record.clinics) ? record.clinics[0] ?? null : record.clinics;
    return { ...record, clinics };
  });
}

export async function claimClinic(clinicId: string, code: string, displayName: string) {
  const { data, error } = await supabase.rpc("claim_clinic", {
    p_clinic_id: clinicId,
    p_claim_code: code,
    p_display_name: displayName || null,
  });
  fail(error);
  return data;
}

export async function listQueue(queueId: string): Promise<TicketRow[]> {
  const { data, error } = await supabase.rpc("list_queue", { p_queue_id: queueId });
  fail(error);
  return (data ?? []) as TicketRow[];
}

export async function callNext(queueId: string, deskLabel: string | null): Promise<TicketRow | null> {
  const { data, error } = await supabase.rpc("call_next", { p_queue_id: queueId, p_desk_label: deskLabel });
  fail(error);
  return (data as TicketRow | null) ?? null;
}

export async function callTicket(ticketId: string, deskLabel: string | null): Promise<TicketRow> {
  const { data, error } = await supabase.rpc("call_ticket", { p_ticket_id: ticketId, p_desk_label: deskLabel });
  fail(error);
  return data as TicketRow;
}

async function ticketRpc(name: "start_serving" | "complete_ticket" | "mark_no_show" | "return_to_queue" | "staff_cancel_ticket", ticketId: string) {
  const { data, error } = await supabase.rpc(name, { p_ticket_id: ticketId });
  fail(error);
  return data as TicketRow;
}

export const startServing = (ticketId: string) => ticketRpc("start_serving", ticketId);
export const completeTicket = (ticketId: string) => ticketRpc("complete_ticket", ticketId);
export const markNoShow = (ticketId: string) => ticketRpc("mark_no_show", ticketId);
export const returnToQueue = (ticketId: string) => ticketRpc("return_to_queue", ticketId);
export const staffCancelTicket = (ticketId: string) => ticketRpc("staff_cancel_ticket", ticketId);

export async function recallTicket(ticketId: string, deskLabel: string | null): Promise<TicketRow> {
  const { data, error } = await supabase.rpc("recall_ticket", { p_ticket_id: ticketId, p_desk_label: deskLabel });
  fail(error);
  return data as TicketRow;
}

export async function listNotices(clinicId: string): Promise<StaffNotice[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, ticket_id, kind, channel, to_phone, message, status, attempts, last_error, created_at")
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false })
    .limit(50);
  fail(error);
  return (data ?? []) as StaffNotice[];
}

export async function listStaff(clinicId: string): Promise<StaffDirectoryRow[]> {
  const { data, error } = await supabase.rpc("list_staff", { p_clinic_id: clinicId });
  fail(error);
  return (data ?? []) as StaffDirectoryRow[];
}

export async function addStaff(clinicId: string, email: string, role: "admin" | "desk", displayName: string) {
  const { data, error } = await supabase.rpc("add_staff_member", {
    p_clinic_id: clinicId,
    p_email: email,
    p_role: role,
    p_display_name: displayName || null,
  });
  fail(error);
  return data;
}

export async function updateStaff(input: {
  clinicId: string;
  userId: string;
  role: "admin" | "desk";
  isActive: boolean;
  displayName: string;
}) {
  const { data, error } = await supabase.rpc("update_staff_member", {
    p_clinic_id: input.clinicId,
    p_user_id: input.userId,
    p_role: input.role,
    p_is_active: input.isActive,
    p_display_name: input.displayName || null,
  });
  fail(error);
  return data;
}

export async function removeStaff(clinicId: string, userId: string) {
  const { error } = await supabase.rpc("remove_staff_member", { p_clinic_id: clinicId, p_user_id: userId });
  fail(error);
}

export async function updateClinic(clinic: Pick<Clinic, "id" | "name" | "location" | "avg_minutes_per_patient" | "is_open">) {
  const { error } = await supabase
    .from("clinics")
    .update({
      name: clinic.name,
      location: clinic.location,
      avg_minutes_per_patient: clinic.avg_minutes_per_patient,
      is_open: clinic.is_open,
    })
    .eq("id", clinic.id);
  fail(error);
}

export async function updateQueue(queue: Pick<Queue, "id" | "name" | "ticket_prefix" | "avg_minutes_per_patient" | "daily_ticket_limit" | "is_open" | "sort_order">) {
  const { error } = await supabase
    .from("queues")
    .update({
      name: queue.name,
      ticket_prefix: queue.ticket_prefix,
      avg_minutes_per_patient: queue.avg_minutes_per_patient,
      daily_ticket_limit: queue.daily_ticket_limit,
      is_open: queue.is_open,
      sort_order: queue.sort_order,
    })
    .eq("id", queue.id);
  fail(error);
}

export async function createQueue(input: { clinicId: string; name: string; ticketPrefix: string | null }) {
  const { error } = await supabase.from("queues").insert({
    clinic_id: input.clinicId,
    name: input.name,
    ticket_prefix: input.ticketPrefix,
  });
  fail(error);
}
