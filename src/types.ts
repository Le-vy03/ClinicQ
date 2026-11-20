export type ClinicId = "uth" | "chilenje" | "kanyama" | "matero";
export type DepartmentId = "opd" | "maternal" | "paeds" | "art" | "dental";
export type Status = "waiting" | "called" | "done" | "noshow";
export type Channel = "sms" | "whatsapp";
export type NoticeKind = "confirmation" | "heading" | "turn" | "followup" | "noshow";

export type Booking = {
  id: string;
  ticket: string;
  clinicId: ClinicId;
  departmentId: DepartmentId;
  slot: string;
  patientName: string;
  phone: string;
  status: Status;
  createdAt: number;
  closedAt?: number;
  headingSent: boolean;
};

export type Notice = {
  id: string;
  channel: Channel;
  kind: NoticeKind;
  to: string;
  patientName: string;
  clinicId: ClinicId;
  bookingId: string;
  body: string;
  createdAt: number;
};

export type State = {
  day: string;
  bookings: Booking[];
  notices: Notice[];
  myTicketId: string;
  sequences: Record<ClinicId, number>;
};
