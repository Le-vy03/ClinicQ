export type TicketStatus = "waiting" | "called" | "serving" | "done" | "no_show" | "cancelled";
export type StaffRole = "admin" | "desk";
export type NotificationStatus = "pending" | "sent" | "failed" | "skipped";
export type ThemeName = "navy" | "teal" | "forest";

export type Clinic = {
  id: string;
  name: string;
  location: string | null;
  ticket_prefix: string;
  avg_minutes_per_patient: number;
  timezone: string;
  is_open: boolean;
};

export type Queue = {
  id: string;
  clinic_id: string;
  name: string;
  ticket_prefix: string | null;
  avg_minutes_per_patient: number | null;
  daily_ticket_limit: number;
  is_open: boolean;
  sort_order: number;
};

export type TicketRow = {
  id: string;
  clinic_id: string;
  queue_id: string;
  service_date: string;
  ticket_number: number;
  ticket_code: string;
  patient_name: string;
  patient_phone: string | null;
  booked_for_someone_else: boolean;
  status: TicketStatus;
  desk_label: string | null;
  recall_count: number;
  called_at: string | null;
  serving_started_at: string | null;
  finished_at: string | null;
  created_at: string;
};

export type RecentCall = {
  ticket_code: string;
  status: string;
  desk_label: string | null;
  called_at: string | null;
};

export type TicketNotice = {
  id: number;
  kind: string;
  message: string;
  status: NotificationStatus;
  created_at: string;
};

export type StaffNotice = TicketNotice & {
  ticket_id: string;
  to_phone: string | null;
  channel: string;
  attempts: number;
  last_error: string | null;
};

export type TakeTicketResult = {
  ticket_id: string;
  ticket_code: string;
  access_token: string;
  queue_id: string;
  clinic_id: string;
  service_date: string;
};

export type TicketSnapshot = {
  ticket: {
    id: string;
    ticket_code: string;
    ticket_number: number;
    patient_name: string;
    patient_phone: string | null;
    booked_for_someone_else: boolean;
    status: TicketStatus;
    desk_label: string | null;
    recall_count: number;
    service_date: string;
    created_at: string;
    called_at: string | null;
    serving_started_at: string | null;
    finished_at: string | null;
  };
  clinic: { id: string; name: string; location: string | null };
  queue: {
    id: string;
    name: string;
    is_open: boolean;
    avg_minutes_per_patient: number;
    waiting_count: number;
  };
  position: number | null;
  people_ahead: number;
  estimated_wait_minutes: number;
  recent_calls: RecentCall[];
  notifications: TicketNotice[];
};

export type QueueSummary = {
  queue_id: string;
  queue_name: string;
  clinic_id: string;
  clinic_name: string;
  is_open: boolean;
  service_date: string;
  waiting_count: number;
  avg_minutes_per_patient: number;
  estimated_wait_minutes_for_new_ticket: number;
  now_serving: RecentCall[];
  recent_calls: RecentCall[];
};

export type StaffMembership = {
  clinic_id: string;
  role: StaffRole;
  display_name: string | null;
  is_active: boolean;
  clinics: Clinic | null;
};

export type StaffDirectoryRow = {
  user_id: string;
  email: string;
  role: StaffRole;
  display_name: string | null;
  is_active: boolean;
  created_at: string;
};

export type SavedTicket = {
  ticketId: string;
  accessToken: string;
  ticketCode: string;
  queueId: string;
  clinicId: string;
  patientName: string;
  savedAt: string;
};
