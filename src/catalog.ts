import type { ClinicId, DepartmentId } from "./types";

export type Clinic = {
  id: ClinicId;
  code: string;
  short: string;
  name: string;
  area: string;
  note: string;
};

export type Department = {
  id: DepartmentId;
  name: string;
  minutes: number;
  blurb: string;
};

export const CLINICS: Clinic[] = [
  {
    id: "uth",
    code: "UTH",
    short: "UTH",
    name: "University Teaching Hospital",
    area: "Ridgeway, Lusaka",
    note: "National referral. The OPD benches fill before sunrise.",
  },
  {
    id: "chilenje",
    code: "CHI",
    short: "Chilenje",
    name: "Chilenje Level 1 Hospital",
    area: "Chilenje, Lusaka",
    note: "Level 1 hospital on the south side. Busy maternal desk.",
  },
  {
    id: "kanyama",
    code: "KAN",
    short: "Kanyama",
    name: "Kanyama Clinic",
    area: "Kanyama, Lusaka",
    note: "One of the fullest urban clinics. Under-5 days run long.",
  },
  {
    id: "matero",
    code: "MAT",
    short: "Matero",
    name: "Matero Clinic",
    area: "Matero, Lusaka",
    note: "Community clinic. ART refills and general care on weekdays.",
  },
];

export const DEPARTMENTS: Department[] = [
  {
    id: "opd",
    name: "General OPD",
    minutes: 12,
    blurb: "Fever, pain, cough, blood pressure, and new complaints.",
  },
  {
    id: "maternal",
    name: "Maternal Health",
    minutes: 15,
    blurb: "Antenatal visits, postnatal checks, and family planning.",
  },
  {
    id: "paeds",
    name: "Paediatrics",
    minutes: 10,
    blurb: "Under-5 clinic, growth monitoring, and sick children.",
  },
  {
    id: "art",
    name: "ART Clinic",
    minutes: 8,
    blurb: "HIV care, medicine refills, and routine reviews.",
  },
  {
    id: "dental",
    name: "Dental",
    minutes: 20,
    blurb: "Toothache, extractions, and reviews.",
  },
];

export const SLOTS = [
  "07:30",
  "08:00",
  "08:30",
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
];

export const SLOT_CAPACITY = 6;

export function clinicById(id: ClinicId): Clinic {
  return CLINICS.find((clinic) => clinic.id === id) ?? CLINICS[0];
}

export function departmentById(id: DepartmentId): Department {
  return DEPARTMENTS.find((department) => department.id === id) ?? DEPARTMENTS[0];
}
