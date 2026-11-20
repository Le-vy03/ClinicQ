-- Seed: one real clinic, no patients.
with c as (
  insert into public.clinics (name, location, ticket_prefix, avg_minutes_per_patient, timezone)
  values ('University Teaching Hospital', 'Nationalist Road, Lusaka', 'UTH', 12, 'Africa/Lusaka')
  returning id)
insert into public.queues (clinic_id, name, sort_order) select id, 'General OPD', 0 from c;
