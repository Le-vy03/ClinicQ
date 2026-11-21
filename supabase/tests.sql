do $$
declare
  v_clinic uuid; v_queue uuid; v_other_clinic uuid; v_other_queue uuid;
  v_admin uuid := gen_random_uuid(); v_desk uuid := gen_random_uuid(); v_stranger uuid := gen_random_uuid();
  a jsonb; b jsonb; c jsonb; d jsonb; s jsonb; t public.tickets; n int; log text := '';
  ok boolean;
begin
  select id into v_clinic from public.clinics where ticket_prefix = 'UTH';
  select id into v_queue from public.queues where clinic_id = v_clinic;
  insert into public.clinics (name, location, ticket_prefix) values ('Test Clinic', 'Ndola', 'TST') returning id into v_other_clinic;
  insert into public.queues (clinic_id, name) values (v_other_clinic, 'OPD') returning id into v_other_queue;
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (v_admin, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@test.zm', '{}', '{}', now(), now()),
         (v_desk, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'desk@test.zm', '{}', '{}', now(), now()),
         (v_stranger, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'x@test.zm', '{"role":"admin"}', '{"role":"admin","clinic_id":"x"}', now(), now());
  insert into private.clinic_claim_codes (clinic_id, code_hash) values (v_clinic, private.hash_secret('TEST-CODE'));

  -- ================= ANON =================
  set local role anon;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);

  select count(*) into n from public.clinics; log := log || format('anon clinics=%s; ', n);
  select count(*) into n from public.queues; log := log || format('anon queues=%s; ', n);

  a := public.take_ticket(v_queue, 'Mutale Banda', '0977 123456', false);
  b := public.take_ticket(v_queue, 'Natasha Phiri', '+260966111222', false);
  c := public.take_ticket(v_queue, 'Joseph Mwale', null, true);
  d := public.take_ticket(v_queue, 'Chanda Zulu', '0955000111', false);
  log := log || format('codes=%s,%s,%s,%s; ', a->>'ticket_code', b->>'ticket_code', c->>'ticket_code', d->>'ticket_code');
  if length(a->>'access_token') <> 48 then raise exception 'token length'; end if;

  s := public.get_ticket_status((d->>'ticket_id')::uuid, d->>'access_token');
  log := log || format('D pos=%s ahead=%s wait=%s phone=%s notifs=%s; ', s->>'position', s->>'people_ahead', s->>'estimated_wait_minutes', s#>>'{ticket,patient_phone}', jsonb_array_length(s->'notifications'));

  -- wrong token
  begin perform public.get_ticket_status((d->>'ticket_id')::uuid, 'wrong'); log := log || 'FAIL wrong token accepted; ';
  exception when others then log := log || 'wrong-token rejected; '; end;
  begin perform public.get_ticket_status((d->>'ticket_id')::uuid, a->>'access_token'); log := log || 'FAIL other token accepted; ';
  exception when others then log := log || 'other-ticket-token rejected; '; end;

  -- PII leak checks
  begin select count(*) into n from public.tickets; log := log || format('FAIL anon tickets=%s; ', n);
  exception when insufficient_privilege then log := log || 'anon tickets denied; '; end;
  begin select count(*) into n from public.notifications; log := log || format('FAIL anon notifs=%s; ', n);
  exception when insufficient_privilege then log := log || 'anon notifications denied; '; end;
  begin select count(*) into n from public.staff_members; log := log || 'FAIL anon staff; ';
  exception when insufficient_privilege then log := log || 'anon staff denied; '; end;
  begin perform public.call_next(v_queue); log := log || 'FAIL anon call_next; ';
  exception when insufficient_privilege then log := log || 'anon call_next denied; '; end;
  begin perform private.ticket_by_token((d->>'ticket_id')::uuid, 'x'); log := log || 'FAIL anon private fn; ';
  exception when insufficient_privilege then log := log || 'anon private fn denied; '; end;
  begin select count(*) into n from private.ticket_secrets; log := log || 'FAIL secrets; ';
  exception when insufficient_privilege then log := log || 'anon secrets denied; '; end;
  begin update public.clinics set is_open = false; log := log || 'FAIL anon update clinic; ';
  exception when insufficient_privilege then log := log || 'anon clinic update denied; '; end;
  select count(*) into n from public.queue_events; log := log || format('anon queue_events=%s; ', n);
  if exists (select 1 from information_schema.columns where table_name='queue_events' and column_name in ('patient_name','patient_phone')) then raise exception 'PII in events'; end if;

  s := public.get_queue_summary(v_queue);
  log := log || format('summary waiting=%s est=%s; ', s->>'waiting_count', s->>'estimated_wait_minutes_for_new_ticket');
  if s::text ~ 'Mutale|0977|260977' then raise exception 'PII in summary'; end if;

  -- cancel own ticket (C)
  s := public.cancel_ticket((c->>'ticket_id')::uuid, c->>'access_token');
  log := log || format('C cancel=%s; ', s->>'status');
  begin perform public.cancel_ticket((c->>'ticket_id')::uuid, c->>'access_token'); log := log || 'FAIL double cancel; ';
  exception when others then log := log || 'double-cancel rejected; '; end;
  s := public.get_ticket_status((d->>'ticket_id')::uuid, d->>'access_token');
  log := log || format('D after C cancel pos=%s; ', s->>'position');

  begin perform public.take_ticket(v_queue, '', null); log := log || 'FAIL empty name; ';
  exception when others then log := log || 'empty-name rejected; '; end;
  begin perform public.take_ticket(v_queue, 'X', '12ab'); log := log || 'FAIL bad phone; ';
  exception when others then log := log || 'bad-phone rejected; '; end;

  -- ================= STRANGER (authenticated, no staff row, admin in metadata) =================
  reset role; set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_stranger, 'role', 'authenticated', 'user_metadata', json_build_object('role','admin'), 'app_metadata', json_build_object('role','admin'))::text, true);
  select count(*) into n from public.tickets; log := log || format('stranger tickets=%s; ', n);
  select count(*) into n from public.notifications; log := log || format('stranger notifs=%s; ', n);
  begin perform public.call_next(v_queue); log := log || 'FAIL stranger call_next; ';
  exception when insufficient_privilege then log := log || 'stranger call_next denied; '; end;
  update public.clinics set is_open = false where id = v_clinic; get diagnostics n = row_count;
  log := log || format('stranger clinic update rows=%s; ', n);
  begin perform public.claim_clinic(v_clinic, 'WRONG'); log := log || 'FAIL bad claim; ';
  exception when insufficient_privilege then log := log || 'bad claim code rejected; '; end;

  -- ================= ADMIN bootstrap via claim =================
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform public.claim_clinic(v_clinic, 'TEST-CODE', 'Dr Admin');
  log := log || 'admin claimed UTH; ';
  perform set_config('request.jwt.claims', json_build_object('sub', v_stranger, 'role', 'authenticated')::text, true);
  begin perform public.claim_clinic(v_clinic, 'TEST-CODE'); log := log || 'FAIL reused claim; ';
  exception when others then log := log || 'claim code single-use; '; end;

  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform public.add_staff_member(v_clinic, 'DESK@test.zm', 'desk', 'Nurse Desk');
  select count(*) into n from public.list_staff(v_clinic); log := log || format('staff=%s; ', n);
  begin perform public.add_staff_member(v_clinic, 'nobody@test.zm', 'desk'); log := log || 'FAIL add unknown; ';
  exception when others then log := log || 'unknown email rejected; '; end;
  begin perform public.remove_staff_member(v_clinic, v_admin); log := log || 'FAIL removed last admin; ';
  exception when others then log := log || 'last-admin protected; '; end;
  begin perform public.add_staff_member(v_other_clinic, 'x@test.zm', 'admin'); log := log || 'FAIL cross-clinic admin; ';
  exception when insufficient_privilege then log := log || 'cross-clinic add denied; '; end;
  insert into public.queues (clinic_id, name) values (v_clinic, 'Pharmacy'); log := log || 'admin added queue; ';
  begin insert into public.queues (clinic_id, name) values (v_other_clinic, 'Hack'); log := log || 'FAIL cross-clinic queue; ';
  exception when insufficient_privilege then log := log || 'cross-clinic queue denied; '; end;
  update public.clinics set avg_minutes_per_patient = 12 where id = v_clinic; get diagnostics n = row_count;
  log := log || format('admin clinic update rows=%s; ', n);

  -- ================= DESK =================
  perform set_config('request.jwt.claims', json_build_object('sub', v_desk, 'role', 'authenticated')::text, true);
  select count(*) into n from public.list_queue(v_queue); log := log || format('desk list_queue=%s; ', n);
  begin perform public.add_staff_member(v_clinic, 'x@test.zm', 'admin'); log := log || 'FAIL desk added staff; ';
  exception when insufficient_privilege then log := log || 'desk add-staff denied; '; end;
  update public.queues set is_open = false where id = v_queue; get diagnostics n = row_count;
  log := log || format('desk queue update rows=%s; ', n);

  t := public.call_next(v_queue, 'Desk 2'); log := log || format('called=%s; ', t.ticket_code);
  t := public.start_serving(t.id); t := public.complete_ticket(t.id); log := log || format('%s=%s; ', t.ticket_code, t.status);
  t := public.call_next(v_queue, 'Desk 2'); log := log || format('called=%s; ', t.ticket_code);
  t := public.mark_no_show(t.id); t := public.recall_ticket(t.id); log := log || format('recalled %s status=%s count=%s; ', t.ticket_code, t.status, t.recall_count);
  begin perform public.start_serving((a->>'ticket_id')::uuid); log := log || 'FAIL done->serving; ';
  exception when others then log := log || 'invalid transition rejected; '; end;

  -- ================= patient D view after calls =================
  reset role; set local role anon;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  s := public.get_ticket_status((d->>'ticket_id')::uuid, d->>'access_token');
  log := log || format('D pos=%s recent_calls=%s notifs=%s; ', s->>'position', s->'recent_calls', s->'notifications');
  if (s->'recent_calls')::text ~ 'Mutale|Natasha' then raise exception 'PII in recent_calls'; end if;
  select count(*) into n from public.queue_events where queue_id = v_queue; log := log || format('events=%s; ', n);

  reset role;
  select count(*) into n from public.notifications where status = 'pending'; log := log || format('pending sms=%s; ', n);
  select count(*) into n from public.notifications where status = 'skipped'; log := log || format('skipped (no phone)=%s; ', n);

  raise exception 'TEST LOG (rolled back): %', log;
end $$;
