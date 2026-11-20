-- =====================================================================
-- ClinicQ production schema (Supabase / Postgres 15+)
-- Public schema  : tables exposed through the Data API (RLS on all) and
--                  thin SECURITY INVOKER RPC wrappers.
-- Private schema : not exposed; holds secrets, counters and all
--                  SECURITY DEFINER logic.
-- =====================================================================

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

-- ---------------------------------------------------------------- types
create type public.staff_role as enum ('admin', 'desk');
create type public.ticket_status as enum ('waiting', 'called', 'serving', 'done', 'no_show', 'cancelled');
create type public.notification_status as enum ('pending', 'sent', 'failed', 'skipped');

-- --------------------------------------------------------------- tables
create table public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  location text check (char_length(location) <= 200),
  ticket_prefix text not null unique check (ticket_prefix ~ '^[A-Z0-9]{2,6}$'),
  avg_minutes_per_patient integer not null default 12 check (avg_minutes_per_patient between 1 and 240),
  timezone text not null default 'Africa/Lusaka',
  is_open boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.clinics is 'Clinics/hospitals. Publicly readable so patients can pick one.';

create table public.queues (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 80),
  ticket_prefix text check (ticket_prefix ~ '^[A-Z0-9]{1,6}$'),
  avg_minutes_per_patient integer check (avg_minutes_per_patient between 1 and 240),
  daily_ticket_limit integer not null default 500 check (daily_ticket_limit between 1 and 5000),
  is_open boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, name),
  unique (id, clinic_id)
);
comment on table public.queues is 'Departments/queues per clinic (e.g. General OPD). ticket_prefix / avg_minutes_per_patient override the clinic values when set.';

create table public.staff_members (
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.staff_role not null default 'desk',
  display_name text check (char_length(display_name) <= 80),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (clinic_id, user_id)
);
create index staff_members_user_id_idx on public.staff_members (user_id);
comment on table public.staff_members is 'Authorization source of truth: which auth user works at which clinic, and with what role.';

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  queue_id uuid not null,
  service_date date not null,
  ticket_number integer not null check (ticket_number > 0),
  ticket_code text not null,
  patient_name text not null check (char_length(btrim(patient_name)) between 1 and 100),
  patient_phone text check (patient_phone ~ '^\+[0-9]{9,15}$'),
  booked_for_someone_else boolean not null default false,
  status public.ticket_status not null default 'waiting',
  desk_label text check (char_length(desk_label) <= 40),
  recall_count integer not null default 0,
  called_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  called_at timestamptz,
  serving_started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz not null default now(),
  foreign key (queue_id, clinic_id) references public.queues(id, clinic_id) on delete cascade,
  unique (queue_id, service_date, ticket_number)
);
create index tickets_queue_day_status_idx on public.tickets (queue_id, service_date, status, ticket_number);
create index tickets_clinic_day_idx on public.tickets (clinic_id, service_date);
create index tickets_called_by_idx on public.tickets (called_by);
create index tickets_queue_called_at_idx on public.tickets (queue_id, called_at desc) where called_at is not null;
comment on table public.tickets is 'Patient tickets. Contains PII: readable only by staff of the clinic. Patients use RPCs with their access token.';

create table public.notifications (
  id bigint generated always as identity primary key,
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  kind text not null check (kind in ('ticket_created', 'almost_your_turn', 'next_in_line', 'called', 'recalled', 'no_show', 'cancelled')),
  channel text not null default 'sms' check (channel in ('sms')),
  to_phone text,
  message text not null,
  status public.notification_status not null default 'pending',
  attempts integer not null default 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_ticket_idx on public.notifications (ticket_id, created_at);
create index notifications_clinic_idx on public.notifications (clinic_id, created_at desc);
create index notifications_pending_idx on public.notifications (created_at) where status = 'pending';
create unique index notifications_one_alert_per_ticket on public.notifications (ticket_id, kind) where kind in ('almost_your_turn', 'next_in_line');
comment on table public.notifications is 'Outbox of SMS messages. status=pending is the hook for a future SMS sender (e.g. Africa''s Talking) running with the service role.';

create table public.queue_events (
  id bigint generated always as identity primary key,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  queue_id uuid not null references public.queues(id) on delete cascade,
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  ticket_code text not null,
  event text not null check (event in ('created', 'called', 'recalled', 'serving', 'done', 'no_show', 'cancelled')),
  status public.ticket_status not null,
  desk_label text,
  service_date date not null,
  created_at timestamptz not null default now()
);
create index queue_events_queue_idx on public.queue_events (queue_id, created_at desc);
create index queue_events_clinic_idx on public.queue_events (clinic_id);
create index queue_events_ticket_idx on public.queue_events (ticket_id);
comment on table public.queue_events is 'PII-free public event log (ticket code + status only). Subscribe with Realtime for live updates.';

-- private tables (not exposed; RLS on as defense in depth, no policies)
create table private.ticket_secrets (
  ticket_id uuid primary key references public.tickets(id) on delete cascade,
  token_hash bytea not null
);
create table private.queue_counters (
  queue_id uuid not null references public.queues(id) on delete cascade,
  service_date date not null,
  last_number integer not null,
  primary key (queue_id, service_date)
);
create table private.clinic_claim_codes (
  clinic_id uuid primary key references public.clinics(id) on delete cascade,
  code_hash bytea not null,
  expires_at timestamptz not null default now() + interval '30 days',
  used_at timestamptz,
  used_by uuid references auth.users(id) on delete set null
);
create index clinic_claim_codes_used_by_idx on private.clinic_claim_codes (used_by);
alter table private.ticket_secrets enable row level security;
alter table private.queue_counters enable row level security;
alter table private.clinic_claim_codes enable row level security;
revoke all on all tables in schema private from public, anon, authenticated;

-- ------------------------------------------------------ private helpers
create function private.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;

create trigger clinics_updated_at before update on public.clinics for each row execute function private.set_updated_at();
create trigger queues_updated_at before update on public.queues for each row execute function private.set_updated_at();
create trigger tickets_updated_at before update on public.tickets for each row execute function private.set_updated_at();

create function private.hash_secret(p text) returns bytea
language sql immutable set search_path = '' as $$
  select extensions.digest(convert_to(coalesce(p, ''), 'UTF8'), 'sha256') $$;

create function private.staff_clinic_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select clinic_id from public.staff_members
  where user_id = (select auth.uid()) and is_active $$;

create function private.admin_clinic_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select clinic_id from public.staff_members
  where user_id = (select auth.uid()) and is_active and role = 'admin' $$;

create function private.assert_staff(p_clinic_id uuid, p_admin boolean default false) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  if not exists (
    select 1 from public.staff_members
    where clinic_id = p_clinic_id and user_id = (select auth.uid()) and is_active
      and (not p_admin or role = 'admin')
  ) then
    raise exception '%', case when p_admin then 'Admin access required for this clinic' else 'Staff access required for this clinic' end
      using errcode = '42501';
  end if;
end $$;

create function private.clinic_today(p_clinic_id uuid) returns date
language sql stable security definer set search_path = '' as $$
  select (now() at time zone c.timezone)::date from public.clinics c where c.id = p_clinic_id $$;

create function private.queue_avg_minutes(p_queue_id uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select coalesce(q.avg_minutes_per_patient, c.avg_minutes_per_patient)
  from public.queues q join public.clinics c on c.id = q.clinic_id where q.id = p_queue_id $$;

create function private.normalize_phone(p text) returns text
language plpgsql immutable set search_path = '' as $$
declare v text;
begin
  if p is null or btrim(p) = '' then return null; end if;
  v := regexp_replace(p, '[\s\-().]', '', 'g');
  if v ~ '^0[0-9]{9}$' then v := '+260' || substr(v, 2);        -- Zambian local 09xxxxxxxx
  elsif v ~ '^260[0-9]{9}$' then v := '+' || v;
  elsif v ~ '^00[0-9]+$' then v := '+' || substr(v, 3);
  end if;
  if v !~ '^\+[0-9]{9,15}$' then
    raise exception 'Invalid phone number' using errcode = '22023';
  end if;
  return v;
end $$;

-- ---------------------------------------- trigger: events + SMS outbox
create function private.on_ticket_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_event text;
  v_ahead integer;
  v_avg integer;
  v_queue text;
  v_clinic text;
  v_msg text;
  r record;
begin
  if tg_op = 'INSERT' then
    v_event := 'created';
  elsif new.recall_count > old.recall_count then
    v_event := 'recalled';
  elsif new.status is distinct from old.status and new.status <> 'waiting' then
    v_event := new.status::text;
  else
    return new;
  end if;

  insert into public.queue_events (clinic_id, queue_id, ticket_id, ticket_code, event, status, desk_label, service_date)
  values (new.clinic_id, new.queue_id, new.id, new.ticket_code, v_event, new.status, new.desk_label, new.service_date);

  select q.name, c.name into v_queue, v_clinic
  from public.queues q join public.clinics c on c.id = q.clinic_id where q.id = new.queue_id;
  v_avg := private.queue_avg_minutes(new.queue_id);

  v_msg := case v_event
    when 'created' then null
    when 'called' then format('ClinicQ: %s, it is your turn. Please come to %s now.', new.ticket_code, coalesce(new.desk_label, 'the desk'))
    when 'recalled' then format('ClinicQ: %s, second call. Please come to %s now.', new.ticket_code, coalesce(new.desk_label, 'the desk'))
    when 'no_show' then format('ClinicQ: %s was marked as missed. Please see the front desk if you are still at %s.', new.ticket_code, v_clinic)
    when 'cancelled' then format('ClinicQ: %s at %s has been cancelled. Your place was given to the next patient.', new.ticket_code, v_clinic)
    else null end;

  if v_event = 'created' then
    select count(*) into v_ahead from public.tickets t
    where t.queue_id = new.queue_id and t.service_date = new.service_date
      and t.status = 'waiting' and t.ticket_number < new.ticket_number;
    v_msg := format('ClinicQ: Your ticket is %s for %s at %s. %s ahead of you, about %s min. We will text you when it is nearly your turn.',
      new.ticket_code, v_queue, v_clinic,
      case v_ahead when 0 then 'Nobody is' when 1 then '1 person is' else v_ahead || ' people are' end,
      v_ahead * v_avg);
  end if;

  if v_msg is not null then
    insert into public.notifications (ticket_id, clinic_id, kind, to_phone, message, status)
    values (new.id, new.clinic_id,
      case v_event when 'created' then 'ticket_created' else v_event end,
      new.patient_phone, v_msg,
      case when new.patient_phone is null then 'skipped'::public.notification_status else 'pending' end);
  end if;

  -- someone left the waiting line: alert the patients now 1st/2nd in line (once per kind)
  if tg_op = 'UPDATE' and old.status = 'waiting' and new.status <> 'waiting' then
    for r in
      select t.id, t.ticket_code, t.patient_phone, t.clinic_id,
             row_number() over (order by t.ticket_number) as pos
      from public.tickets t
      where t.queue_id = new.queue_id and t.service_date = new.service_date and t.status = 'waiting'
      order by t.ticket_number
      limit 2
    loop
      insert into public.notifications (ticket_id, clinic_id, kind, to_phone, message, status)
      values (r.id, r.clinic_id, case r.pos when 1 then 'next_in_line' else 'almost_your_turn' end, r.patient_phone,
        case r.pos when 1 then format('ClinicQ: %s, you are next in line at %s. Please be ready near the desk.', r.ticket_code, v_queue)
                   else format('ClinicQ: %s, you are 2nd in line at %s (about %s min). Please make your way to the waiting area.', r.ticket_code, v_queue, v_avg) end,
        case when r.patient_phone is null then 'skipped'::public.notification_status else 'pending' end)
      on conflict (ticket_id, kind) where kind in ('almost_your_turn', 'next_in_line') do nothing;
    end loop;
  end if;

  return new;
end $$;

create trigger tickets_after_change
after insert or update of status, recall_count on public.tickets
for each row execute function private.on_ticket_change();

-- ----------------------------------------------- private RPC bodies
create function private.take_ticket(p_queue_id uuid, p_patient_name text, p_patient_phone text, p_booked_for_someone_else boolean)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  q record;
  v_date date;
  v_phone text := private.normalize_phone(p_patient_phone);
  v_name text := btrim(coalesce(p_patient_name, ''));
  v_num integer;
  v_code text;
  v_token text;
  v_id uuid;
begin
  if char_length(v_name) not between 1 and 100 then
    raise exception 'Patient name is required (max 100 characters)' using errcode = '22023';
  end if;

  select qu.id, qu.clinic_id, qu.is_open as q_open, qu.daily_ticket_limit,
         coalesce(qu.ticket_prefix, c.ticket_prefix) as prefix, c.is_open as c_open, c.timezone
    into q
  from public.queues qu join public.clinics c on c.id = qu.clinic_id
  where qu.id = p_queue_id;
  if not found then raise exception 'Queue not found' using errcode = 'P0002'; end if;
  if not (q.q_open and q.c_open) then raise exception 'This queue is closed right now' using errcode = 'P0001'; end if;

  v_date := (now() at time zone q.timezone)::date;

  if v_phone is not null and (
    select count(*) from public.tickets t
    where t.queue_id = p_queue_id and t.service_date = v_date and t.patient_phone = v_phone
      and t.status in ('waiting', 'called', 'serving')) >= 5 then
    raise exception 'Too many active tickets for this phone number' using errcode = 'P0001';
  end if;

  insert into private.queue_counters as qc (queue_id, service_date, last_number)
  values (p_queue_id, v_date, 1)
  on conflict (queue_id, service_date) do update set last_number = qc.last_number + 1
  returning last_number into v_num;

  if v_num > q.daily_ticket_limit then
    raise exception 'This queue is full for today' using errcode = 'P0001';
  end if;

  v_code := q.prefix || '-' || lpad(v_num::text, 3, '0');
  v_token := encode(extensions.gen_random_bytes(24), 'hex');

  insert into public.tickets (clinic_id, queue_id, service_date, ticket_number, ticket_code,
                              patient_name, patient_phone, booked_for_someone_else)
  values (q.clinic_id, p_queue_id, v_date, v_num, v_code, v_name, v_phone, coalesce(p_booked_for_someone_else, false))
  returning id into v_id;

  insert into private.ticket_secrets (ticket_id, token_hash) values (v_id, private.hash_secret(v_token));

  return jsonb_build_object('ticket_id', v_id, 'ticket_code', v_code, 'access_token', v_token,
                            'queue_id', p_queue_id, 'clinic_id', q.clinic_id, 'service_date', v_date);
end $$;

create function private.ticket_by_token(p_ticket_id uuid, p_access_token text) returns public.tickets
language plpgsql stable security definer set search_path = '' as $$
declare t public.tickets;
begin
  select tk.* into t from public.tickets tk
  join private.ticket_secrets s on s.ticket_id = tk.id
  where tk.id = p_ticket_id and s.token_hash = private.hash_secret(p_access_token);
  if not found then raise exception 'Ticket not found' using errcode = 'P0002'; end if;
  return t;
end $$;

create function private.get_ticket_status(p_ticket_id uuid, p_access_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  t public.tickets := private.ticket_by_token(p_ticket_id, p_access_token);
  v_avg integer := private.queue_avg_minutes(t.queue_id);
  v_ahead integer;
  v_waiting integer;
  v_info record;
begin
  select q.name as queue_name, c.name as clinic_name, c.location, q.is_open and c.is_open as is_open
    into v_info from public.queues q join public.clinics c on c.id = q.clinic_id where q.id = t.queue_id;

  select count(*) filter (where tk.ticket_number < t.ticket_number), count(*)
    into v_ahead, v_waiting
  from public.tickets tk
  where tk.queue_id = t.queue_id and tk.service_date = t.service_date and tk.status = 'waiting';

  return jsonb_build_object(
    'ticket', jsonb_build_object(
      'id', t.id, 'ticket_code', t.ticket_code, 'ticket_number', t.ticket_number,
      'patient_name', t.patient_name, 'patient_phone', t.patient_phone,
      'booked_for_someone_else', t.booked_for_someone_else, 'status', t.status,
      'desk_label', t.desk_label, 'recall_count', t.recall_count, 'service_date', t.service_date,
      'created_at', t.created_at, 'called_at', t.called_at,
      'serving_started_at', t.serving_started_at, 'finished_at', t.finished_at),
    'clinic', jsonb_build_object('id', t.clinic_id, 'name', v_info.clinic_name, 'location', v_info.location),
    'queue', jsonb_build_object('id', t.queue_id, 'name', v_info.queue_name, 'is_open', v_info.is_open,
                                'avg_minutes_per_patient', v_avg, 'waiting_count', v_waiting),
    'position', case when t.status = 'waiting' then v_ahead + 1 end,
    'people_ahead', case when t.status = 'waiting' then v_ahead else 0 end,
    'estimated_wait_minutes', case when t.status = 'waiting' then v_ahead * v_avg else 0 end,
    'recent_calls', coalesce((
      select jsonb_agg(x order by x.called_at desc) from (
        select tk.ticket_code, tk.status, tk.desk_label, tk.called_at
        from public.tickets tk
        where tk.queue_id = t.queue_id and tk.service_date = t.service_date and tk.called_at is not null
        order by tk.called_at desc limit 5) x), '[]'::jsonb),
    'notifications', coalesce((
      select jsonb_agg(jsonb_build_object('id', n.id, 'kind', n.kind, 'message', n.message,
                                          'status', n.status, 'created_at', n.created_at) order by n.created_at, n.id)
      from public.notifications n where n.ticket_id = t.id), '[]'::jsonb)
  );
end $$;

create function private.cancel_ticket(p_ticket_id uuid, p_access_token text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare t public.tickets := private.ticket_by_token(p_ticket_id, p_access_token);
begin
  update public.tickets set status = 'cancelled', finished_at = now()
  where id = t.id and status in ('waiting', 'called')
  returning * into t;
  if not found then raise exception 'This ticket can no longer be cancelled' using errcode = 'P0001'; end if;
  return jsonb_build_object('ticket_id', t.id, 'ticket_code', t.ticket_code, 'status', t.status);
end $$;

create function private.get_queue_summary(p_queue_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare q record; v_date date; v_waiting integer;
begin
  select qu.id, qu.name, qu.clinic_id, c.name as clinic_name, qu.is_open and c.is_open as is_open, c.timezone
    into q from public.queues qu join public.clinics c on c.id = qu.clinic_id where qu.id = p_queue_id;
  if not found then raise exception 'Queue not found' using errcode = 'P0002'; end if;
  v_date := (now() at time zone q.timezone)::date;
  select count(*) into v_waiting from public.tickets t
  where t.queue_id = p_queue_id and t.service_date = v_date and t.status = 'waiting';
  return jsonb_build_object(
    'queue_id', q.id, 'queue_name', q.name, 'clinic_id', q.clinic_id, 'clinic_name', q.clinic_name,
    'is_open', q.is_open, 'service_date', v_date, 'waiting_count', v_waiting,
    'avg_minutes_per_patient', private.queue_avg_minutes(p_queue_id),
    'estimated_wait_minutes_for_new_ticket', v_waiting * private.queue_avg_minutes(p_queue_id),
    'now_serving', coalesce((
      select jsonb_agg(jsonb_build_object('ticket_code', t.ticket_code, 'status', t.status, 'desk_label', t.desk_label, 'called_at', t.called_at) order by t.called_at desc)
      from public.tickets t where t.queue_id = p_queue_id and t.service_date = v_date and t.status in ('called', 'serving')), '[]'::jsonb),
    'recent_calls', coalesce((
      select jsonb_agg(x order by x.called_at desc) from (
        select t.ticket_code, t.status, t.desk_label, t.called_at from public.tickets t
        where t.queue_id = p_queue_id and t.service_date = v_date and t.called_at is not null
        order by t.called_at desc limit 5) x), '[]'::jsonb));
end $$;

-- staff transitions -------------------------------------------------
create function private.call_next(p_queue_id uuid, p_desk_label text)
returns public.tickets language plpgsql volatile security definer set search_path = '' as $$
declare v_clinic uuid; t public.tickets;
begin
  select clinic_id into v_clinic from public.queues where id = p_queue_id;
  if v_clinic is null then raise exception 'Queue not found' using errcode = 'P0002'; end if;
  perform private.assert_staff(v_clinic);

  select * into t from public.tickets
  where queue_id = p_queue_id and service_date = private.clinic_today(v_clinic) and status = 'waiting'
  order by ticket_number limit 1
  for update skip locked;
  if not found then return null; end if;

  update public.tickets set status = 'called', called_at = now(), called_by = (select auth.uid()),
         desk_label = nullif(btrim(p_desk_label), '')
  where id = t.id returning * into t;
  return t;
end $$;

create function private.staff_set_status(p_ticket_id uuid, p_new public.ticket_status, p_desk_label text default null)
returns public.tickets language plpgsql volatile security definer set search_path = '' as $$
declare t public.tickets; v_allowed public.ticket_status[];
begin
  select * into t from public.tickets where id = p_ticket_id for update;
  if not found then raise exception 'Ticket not found' using errcode = 'P0002'; end if;
  perform private.assert_staff(t.clinic_id);

  v_allowed := case p_new
    when 'called'    then array['waiting']::public.ticket_status[]                 -- call a specific ticket out of order
    when 'serving'   then array['called']::public.ticket_status[]
    when 'done'      then array['called', 'serving']::public.ticket_status[]
    when 'no_show'   then array['waiting', 'called']::public.ticket_status[]
    when 'cancelled' then array['waiting', 'called']::public.ticket_status[]
    when 'waiting'   then array['called', 'no_show']::public.ticket_status[]        -- put back in line
  end;
  if not (t.status = any (v_allowed)) then
    raise exception 'Cannot change ticket % from % to %', t.ticket_code, t.status, p_new using errcode = 'P0001';
  end if;

  update public.tickets set
    status = p_new,
    called_at = case when p_new = 'called' then now() when p_new = 'waiting' then null else called_at end,
    called_by = case when p_new = 'called' then (select auth.uid()) else called_by end,
    desk_label = case when p_new = 'called' then nullif(btrim(p_desk_label), '') else desk_label end,
    serving_started_at = case when p_new = 'serving' then now() else serving_started_at end,
    finished_at = case when p_new in ('done', 'no_show', 'cancelled') then now() when p_new = 'waiting' then null else finished_at end
  where id = t.id returning * into t;
  return t;
end $$;

create function private.recall_ticket(p_ticket_id uuid, p_desk_label text)
returns public.tickets language plpgsql volatile security definer set search_path = '' as $$
declare t public.tickets;
begin
  select * into t from public.tickets where id = p_ticket_id for update;
  if not found then raise exception 'Ticket not found' using errcode = 'P0002'; end if;
  perform private.assert_staff(t.clinic_id);
  if t.status not in ('called', 'no_show') then
    raise exception 'Only called or no-show tickets can be recalled' using errcode = 'P0001';
  end if;
  update public.tickets set status = 'called', recall_count = recall_count + 1, called_at = now(),
         called_by = (select auth.uid()), finished_at = null,
         desk_label = coalesce(nullif(btrim(p_desk_label), ''), desk_label)
  where id = t.id returning * into t;
  return t;
end $$;

-- admin ---------------------------------------------------------------
create function private.add_staff_member(p_clinic_id uuid, p_email text, p_role public.staff_role, p_display_name text)
returns public.staff_members language plpgsql volatile security definer set search_path = '' as $$
declare v_user uuid; s public.staff_members;
begin
  perform private.assert_staff(p_clinic_id, true);
  select id into v_user from auth.users where lower(email) = lower(btrim(p_email));
  if v_user is null then
    raise exception 'No account with that email. Ask them to sign up first.' using errcode = 'P0002';
  end if;
  insert into public.staff_members (clinic_id, user_id, role, display_name)
  values (p_clinic_id, v_user, coalesce(p_role, 'desk'), nullif(btrim(p_display_name), ''))
  on conflict (clinic_id, user_id) do update
    set role = excluded.role, display_name = coalesce(excluded.display_name, public.staff_members.display_name), is_active = true
  returning * into s;
  return s;
end $$;

create function private.assert_keeps_admin(p_clinic_id uuid, p_user_id uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.staff_members
                 where clinic_id = p_clinic_id and user_id <> p_user_id and role = 'admin' and is_active) then
    raise exception 'A clinic must keep at least one active admin' using errcode = 'P0001';
  end if;
end $$;

create function private.update_staff_member(p_clinic_id uuid, p_user_id uuid, p_role public.staff_role, p_is_active boolean, p_display_name text)
returns public.staff_members language plpgsql volatile security definer set search_path = '' as $$
declare s public.staff_members;
begin
  perform private.assert_staff(p_clinic_id, true);
  select * into s from public.staff_members where clinic_id = p_clinic_id and user_id = p_user_id for update;
  if not found then raise exception 'Staff member not found' using errcode = 'P0002'; end if;
  if s.role = 'admin' and s.is_active and (coalesce(p_role, s.role) <> 'admin' or not coalesce(p_is_active, s.is_active)) then
    perform private.assert_keeps_admin(p_clinic_id, p_user_id);
  end if;
  update public.staff_members set role = coalesce(p_role, role), is_active = coalesce(p_is_active, is_active),
         display_name = coalesce(nullif(btrim(p_display_name), ''), display_name)
  where clinic_id = p_clinic_id and user_id = p_user_id returning * into s;
  return s;
end $$;

create function private.remove_staff_member(p_clinic_id uuid, p_user_id uuid)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.assert_staff(p_clinic_id, true);
  if exists (select 1 from public.staff_members where clinic_id = p_clinic_id and user_id = p_user_id and role = 'admin' and is_active) then
    perform private.assert_keeps_admin(p_clinic_id, p_user_id);
  end if;
  delete from public.staff_members where clinic_id = p_clinic_id and user_id = p_user_id;
end $$;

create function private.list_staff(p_clinic_id uuid)
returns table (user_id uuid, email text, role public.staff_role, display_name text, is_active boolean, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.assert_staff(p_clinic_id);
  return query select s.user_id, u.email::text, s.role, s.display_name, s.is_active, s.created_at
    from public.staff_members s join auth.users u on u.id = s.user_id
    where s.clinic_id = p_clinic_id order by s.role, s.created_at;
end $$;

create function private.claim_clinic(p_clinic_id uuid, p_claim_code text, p_display_name text)
returns public.staff_members language plpgsql volatile security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); s public.staff_members;
begin
  if v_uid is null then raise exception 'Not signed in' using errcode = '28000'; end if;
  perform 1 from private.clinic_claim_codes
  where clinic_id = p_clinic_id and code_hash = private.hash_secret(btrim(p_claim_code))
    and used_at is null and expires_at > now()
  for update;
  if not found then raise exception 'Invalid or expired claim code' using errcode = '42501'; end if;
  if exists (select 1 from public.staff_members where clinic_id = p_clinic_id and role = 'admin' and is_active) then
    raise exception 'This clinic already has an admin' using errcode = 'P0001';
  end if;
  insert into public.staff_members (clinic_id, user_id, role, display_name)
  values (p_clinic_id, v_uid, 'admin', nullif(btrim(p_display_name), ''))
  on conflict (clinic_id, user_id) do update set role = 'admin', is_active = true
  returning * into s;
  update private.clinic_claim_codes set used_at = now(), used_by = v_uid where clinic_id = p_clinic_id;
  return s;
end $$;

-- ------------------------------------------- public RPC wrappers (INVOKER)
create function public.take_ticket(p_queue_id uuid, p_patient_name text, p_patient_phone text default null, p_booked_for_someone_else boolean default false)
returns jsonb language sql volatile security invoker set search_path = '' as $$
  select private.take_ticket(p_queue_id, p_patient_name, p_patient_phone, p_booked_for_someone_else) $$;

create function public.get_ticket_status(p_ticket_id uuid, p_access_token text)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select private.get_ticket_status(p_ticket_id, p_access_token) $$;

create function public.cancel_ticket(p_ticket_id uuid, p_access_token text)
returns jsonb language sql volatile security invoker set search_path = '' as $$
  select private.cancel_ticket(p_ticket_id, p_access_token) $$;

create function public.get_queue_summary(p_queue_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select private.get_queue_summary(p_queue_id) $$;

create function public.call_next(p_queue_id uuid, p_desk_label text default null)
returns public.tickets language sql volatile security invoker set search_path = '' as $$
  select * from private.call_next(p_queue_id, p_desk_label) $$;

create function public.call_ticket(p_ticket_id uuid, p_desk_label text default null)
returns public.tickets language sql volatile security invoker set search_path = '' as $$
  select * from private.staff_set_status(p_ticket_id, 'called', p_desk_label) $$;

create function public.start_serving(p_ticket_id uuid)
returns public.tickets language sql volatile security invoker set search_path = '' as $$
  select * from private.staff_set_status(p_ticket_id, 'serving') $$;

create function public.complete_ticket(p_ticket_id uuid)
returns public.tickets language sql volatile security invoker set search_path = '' as $$
  select * from private.staff_set_status(p_ticket_id, 'done') $$;

create function public.mark_no_show(p_ticket_id uuid)
returns public.tickets language sql volatile security invoker set search_path = '' as $$
  select * from private.staff_set_status(p_ticket_id, 'no_show') $$;

create function public.staff_cancel_ticket(p_ticket_id uuid)
returns public.tickets language sql volatile security invoker set search_path = '' as $$
  select * from private.staff_set_status(p_ticket_id, 'cancelled') $$;

create function public.return_to_queue(p_ticket_id uuid)
returns public.tickets language sql volatile security invoker set search_path = '' as $$
  select * from private.staff_set_status(p_ticket_id, 'waiting') $$;

create function public.recall_ticket(p_ticket_id uuid, p_desk_label text default null)
returns public.tickets language sql volatile security invoker set search_path = '' as $$
  select * from private.recall_ticket(p_ticket_id, p_desk_label) $$;

-- today's queue for a staff member (RLS on tickets applies)
create function public.list_queue(p_queue_id uuid, p_service_date date default null)
returns setof public.tickets language sql stable security invoker set search_path = '' as $$
  select t.* from public.tickets t
  where t.queue_id = p_queue_id
    and t.service_date = coalesce(p_service_date,
          (select (now() at time zone c.timezone)::date from public.queues q join public.clinics c on c.id = q.clinic_id where q.id = p_queue_id))
  order by t.ticket_number $$;

create function public.add_staff_member(p_clinic_id uuid, p_email text, p_role public.staff_role default 'desk', p_display_name text default null)
returns public.staff_members language sql volatile security invoker set search_path = '' as $$
  select * from private.add_staff_member(p_clinic_id, p_email, p_role, p_display_name) $$;

create function public.update_staff_member(p_clinic_id uuid, p_user_id uuid, p_role public.staff_role default null, p_is_active boolean default null, p_display_name text default null)
returns public.staff_members language sql volatile security invoker set search_path = '' as $$
  select * from private.update_staff_member(p_clinic_id, p_user_id, p_role, p_is_active, p_display_name) $$;

create function public.remove_staff_member(p_clinic_id uuid, p_user_id uuid)
returns void language sql volatile security invoker set search_path = '' as $$
  select private.remove_staff_member(p_clinic_id, p_user_id) $$;

create function public.list_staff(p_clinic_id uuid)
returns table (user_id uuid, email text, role public.staff_role, display_name text, is_active boolean, created_at timestamptz)
language sql stable security invoker set search_path = '' as $$
  select * from private.list_staff(p_clinic_id) $$;

create function public.claim_clinic(p_clinic_id uuid, p_claim_code text, p_display_name text default null)
returns public.staff_members language sql volatile security invoker set search_path = '' as $$
  select * from private.claim_clinic(p_clinic_id, p_claim_code, p_display_name) $$;

-- ------------------------------------------------------------ privileges
revoke execute on all functions in schema private from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function
  private.take_ticket(uuid, text, text, boolean),
  private.get_ticket_status(uuid, text),
  private.cancel_ticket(uuid, text),
  private.get_queue_summary(uuid)
to anon, authenticated;
grant execute on function
  public.take_ticket(uuid, text, text, boolean),
  public.get_ticket_status(uuid, text),
  public.cancel_ticket(uuid, text),
  public.get_queue_summary(uuid)
to anon, authenticated;

grant execute on function
  private.staff_clinic_ids(), private.admin_clinic_ids(),
  private.call_next(uuid, text), private.staff_set_status(uuid, public.ticket_status, text),
  private.recall_ticket(uuid, text),
  private.add_staff_member(uuid, text, public.staff_role, text),
  private.update_staff_member(uuid, uuid, public.staff_role, boolean, text),
  private.remove_staff_member(uuid, uuid), private.list_staff(uuid),
  private.claim_clinic(uuid, text, text)
to authenticated;
grant execute on function
  public.call_next(uuid, text), public.call_ticket(uuid, text), public.start_serving(uuid),
  public.complete_ticket(uuid), public.mark_no_show(uuid), public.staff_cancel_ticket(uuid),
  public.return_to_queue(uuid), public.recall_ticket(uuid, text), public.list_queue(uuid, date),
  public.add_staff_member(uuid, text, public.staff_role, text),
  public.update_staff_member(uuid, uuid, public.staff_role, boolean, text),
  public.remove_staff_member(uuid, uuid), public.list_staff(uuid),
  public.claim_clinic(uuid, text, text)
to authenticated;

-- tables: least privilege, RLS does row filtering
revoke all on public.clinics, public.queues, public.staff_members, public.tickets,
              public.notifications, public.queue_events from anon, authenticated;
grant select on public.clinics, public.queues, public.queue_events to anon, authenticated;
grant update (name, location, avg_minutes_per_patient, is_open) on public.clinics to authenticated;
grant insert (clinic_id, name, ticket_prefix, avg_minutes_per_patient, daily_ticket_limit, is_open, sort_order),
      update (name, ticket_prefix, avg_minutes_per_patient, daily_ticket_limit, is_open, sort_order),
      delete on public.queues to authenticated;
grant select on public.staff_members, public.tickets, public.notifications to authenticated;

-- ------------------------------------------------------------------ RLS
alter table public.clinics enable row level security;
alter table public.queues enable row level security;
alter table public.staff_members enable row level security;
alter table public.tickets enable row level security;
alter table public.notifications enable row level security;
alter table public.queue_events enable row level security;

create policy "Clinics are public" on public.clinics for select to anon, authenticated using (true);
create policy "Admins update their clinic" on public.clinics for update to authenticated
  using (id in (select private.admin_clinic_ids())) with check (id in (select private.admin_clinic_ids()));

create policy "Queues are public" on public.queues for select to anon, authenticated using (true);
create policy "Admins add queues" on public.queues for insert to authenticated
  with check (clinic_id in (select private.admin_clinic_ids()));
create policy "Admins update queues" on public.queues for update to authenticated
  using (clinic_id in (select private.admin_clinic_ids())) with check (clinic_id in (select private.admin_clinic_ids()));
create policy "Admins delete queues" on public.queues for delete to authenticated
  using (clinic_id in (select private.admin_clinic_ids()));

create policy "Staff see own membership and colleagues" on public.staff_members for select to authenticated
  using (user_id = (select auth.uid()) or clinic_id in (select private.staff_clinic_ids()));

create policy "Staff read their clinic tickets" on public.tickets for select to authenticated
  using (clinic_id in (select private.staff_clinic_ids()));

create policy "Staff read their clinic notifications" on public.notifications for select to authenticated
  using (clinic_id in (select private.staff_clinic_ids()));

create policy "Queue events are public" on public.queue_events for select to anon, authenticated using (true);

-- ------------------------------------------------------------- Realtime
alter publication supabase_realtime add table public.queue_events, public.tickets, public.notifications;

-- migration: clinicq_index_ticket_queue_clinic_fk (covering index for composite FK, from performance advisor)
create index tickets_queue_clinic_idx on public.tickets (queue_id, clinic_id);

-- migration: clinicq_seed_uth (also in seed.sql)
-- Seed: one real clinic, no patients.
with c as (
  insert into public.clinics (name, location, ticket_prefix, avg_minutes_per_patient, timezone)
  values ('University Teaching Hospital', 'Nationalist Road, Lusaka', 'UTH', 12, 'Africa/Lusaka')
  returning id)
insert into public.queues (clinic_id, name, sort_order) select id, 'General OPD', 0 from c;
