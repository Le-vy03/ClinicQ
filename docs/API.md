# ClinicQ backend API (Supabase)

Production backend for ClinicQ. The front-end is a static site, so it talks to Supabase directly with **supabase-js and the publishable key only**. All the security lives in Postgres: Row Level Security, column grants, and RPCs.

| | |
|---|---|
| Project | `clinicq` (ref `qmxtuhaczrsseetnlaeh`, org Grok, eu-west-1) |
| Project URL | `https://qmxtuhaczrsseetnlaeh.supabase.co` |
| Publishable key (safe to ship in the browser) | `sb_publishable_LMQQ1YBBnMe5kpU1ncIbBA_PfH15uMS` |
| Legacy anon key (only if a library needs a JWT key) | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFteHR1aGFjenJzc2VldG5sYWVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUyMTAxMDksImV4cCI6MjExMDc4NjEwOX0.dSS8xZrAsJDI7B0kl7BdDicfocMkE6SsOLFomRZAq_A` |
| Seed clinic | University Teaching Hospital, `d7054420-b428-4af2-8138-39ddfaa395ab`, prefix `UTH`, 12 min/patient |
| Seed queue | General OPD, `41110700-f2b3-45d9-99ff-4f389b63299a` |

Never put the service_role or secret key in the front-end or in this repo.

```ts
import { createClient } from '@supabase/supabase-js'
export const supabase = createClient(
  'https://qmxtuhaczrsseetnlaeh.supabase.co',
  'sb_publishable_LMQQ1YBBnMe5kpU1ncIbBA_PfH15uMS'
)
```

Full SQL: `schema.sql` (migrations `clinicq_core_schema` and `clinicq_index_ticket_queue_clinic_fk`) and `seed.sql` (migration `clinicq_seed_uth`).

---

## 1. Concepts

- **Patients are anonymous.** They never log in. `take_ticket` returns a `ticket_id` and a secret `access_token` (48 hex chars). Store both in `localStorage` (for example under the key `clinicq.tickets`, as an array, because one phone can hold several tickets, including ones booked for someone else). Put them in the URL too (`#/ticket/<id>?t=<token>`) so the patient can reopen the ticket on another device. The token is stored server-side only as a SHA-256 hash. Without the token, nobody can see or cancel a ticket.
- **Staff are Supabase Auth users** (email + password). Permissions come only from the `staff_members` table. `user_metadata` and `app_metadata` are ignored, so a user who edits their own metadata gains nothing.
- **Service day:** tickets belong to a `service_date`, which is the clinic's local date (`clinics.timezone`, default `Africa/Lusaka`). Numbers restart at 001 each day and are unique per queue per day. The code is `<prefix>-<NNN>`. The prefix is `queues.ticket_prefix` if set, otherwise `clinics.ticket_prefix`, for example `UTH-001`.
- **Wait estimate** = people ahead × `avg_minutes_per_patient`. The queue value overrides the clinic value when set.
- **Phone numbers** are normalised to E.164 format. Zambian local `0977 123456` becomes `+260977123456`, and `260…` becomes `+260…`. Invalid numbers are rejected. Phone is optional; without one, the SMS rows are saved with `status='skipped'`.

### Ticket statuses
`waiting → called → serving → done`, plus `no_show` and `cancelled`.

| Transition | Who / RPC |
|---|---|
| (new) → waiting | patient `take_ticket` |
| waiting → called | staff `call_next` (oldest waiting) or `call_ticket` (a specific ticket, out of order) |
| called → serving | staff `start_serving` |
| called / serving → done | staff `complete_ticket` |
| waiting / called → no_show | staff `mark_no_show` |
| called / no_show → called (recall_count+1) | staff `recall_ticket` |
| called / no_show → waiting | staff `return_to_queue` (keeps the original number, so the ticket goes back to its place in line) |
| waiting / called → cancelled | patient `cancel_ticket` ("I can't make it") or staff `staff_cancel_ticket` |

---

## 2. Tables (schema `public`, RLS on all)

| Table | anon | authenticated |
|---|---|---|
| `clinics` | SELECT all | SELECT all. Clinic admins can UPDATE `name, location, avg_minutes_per_patient, is_open` |
| `queues` | SELECT all | SELECT all. Clinic admins can INSERT, UPDATE, DELETE their clinic's queues |
| `staff_members` | none | SELECT their own row and their colleagues' rows. Writes go through admin RPCs |
| `tickets` (PII) | **none** | SELECT for active staff of that clinic. Writes go through RPCs |
| `notifications` (PII) | **none** | SELECT for active staff of that clinic |
| `queue_events` (PII-free) | SELECT all | SELECT all |

### clinics
`id uuid, name text, location text, ticket_prefix text (2–6 of A-Z0-9, unique), avg_minutes_per_patient int (1–240, default 12), timezone text, is_open bool, created_at, updated_at`

### queues
`id uuid, clinic_id uuid, name text (unique per clinic), ticket_prefix text|null (1–6 A-Z0-9, overrides clinic), avg_minutes_per_patient int|null, daily_ticket_limit int (default 500), is_open bool, sort_order int, created_at, updated_at`
Admin insert example: `supabase.from('queues').insert({ clinic_id, name: 'Pharmacy', ticket_prefix: 'PH' })`. Give each extra queue its own prefix so codes don't clash on the waiting-room screen. Allowed insert columns: `clinic_id, name, ticket_prefix, avg_minutes_per_patient, daily_ticket_limit, is_open, sort_order`.

### staff_members
`clinic_id uuid, user_id uuid, role 'admin'|'desk', display_name text, is_active bool, created_at`. The primary key is `(clinic_id, user_id)`.
To find "which clinic am I staff at" after login:
```ts
const { data } = await supabase.from('staff_members')
  .select('clinic_id, role, display_name, is_active, clinics(*)')
  .eq('user_id', (await supabase.auth.getUser()).data.user!.id)
  .eq('is_active', true)
```
If the result is empty, the user is signed in but not yet staff anywhere. Show "Ask your clinic admin to add you" or the "Claim clinic" form.

### tickets
`id uuid, clinic_id, queue_id, service_date date, ticket_number int, ticket_code text, patient_name text, patient_phone text|null, booked_for_someone_else bool, status ticket_status, desk_label text|null, recall_count int, called_by uuid|null, created_at, called_at, serving_started_at, finished_at, updated_at`

### notifications (SMS outbox)
`id bigint, ticket_id, clinic_id, kind, channel 'sms', to_phone, message, status 'pending'|'sent'|'failed'|'skipped', attempts, last_error, sent_at, created_at`

`kind` is one of:

| kind | When it is created |
|---|---|
| `ticket_created` | When the ticket is taken. Says the number, the people ahead and the estimated minutes |
| `almost_your_turn` | Once, when the ticket becomes 2nd in line |
| `next_in_line` | Once, when the ticket becomes 1st in line |
| `called` | "please come to <desk>" |
| `recalled` | Second call |
| `no_show` | Ticket marked as missed |
| `cancelled` | Ticket cancelled |

A database trigger writes these rows automatically. **SMS hook:** a future sender (an Edge Function or cron job using the service role, for example with Africa's Talking) reads `status='pending'` rows (there is an index for this), sends them, and then sets `status='sent'`, `sent_at` (or `failed`, `attempts`, `last_error`). No SMS is sent today.

### queue_events (public, for live updates)
`id bigint, clinic_id, queue_id, ticket_id, ticket_code, event ('created'|'called'|'recalled'|'serving'|'done'|'no_show'|'cancelled'), status, desk_label, service_date, created_at`. It holds no names or phone numbers.

---

## 3. RPCs

Call them with `supabase.rpc(name, params)`. Errors come back as `error.message` (human readable) and `error.code` (`P0001` business rule, `P0002` not found, `42501` not allowed, `22023` bad input, `28000` not signed in).

### Patient (anon or authenticated)

#### `take_ticket(p_queue_id uuid, p_patient_name text, p_patient_phone text = null, p_booked_for_someone_else boolean = false) → jsonb`
Atomically assigns the next number.
Returns `{ ticket_id, ticket_code, access_token, queue_id, clinic_id, service_date }`.
Errors:
- The queue or clinic is closed.
- The name is empty or over 100 characters.
- The phone number is invalid.
- The phone number already has 5 or more active tickets in this queue today.
- The queue has reached its daily limit.

The "Book for someone else" flow is the same call with `p_booked_for_someone_else: true` and the other person's name and phone. Store the returned token too.

#### `get_ticket_status(p_ticket_id uuid, p_access_token text) → jsonb`
```jsonc
{
  "ticket": { "id", "ticket_code", "ticket_number", "patient_name", "patient_phone",
              "booked_for_someone_else", "status", "desk_label", "recall_count",
              "service_date", "created_at", "called_at", "serving_started_at", "finished_at" },
  "clinic": { "id", "name", "location" },
  "queue":  { "id", "name", "is_open", "avg_minutes_per_patient", "waiting_count" },
  "position": 4,                 // null unless status = waiting (1 = next)
  "people_ahead": 3,
  "estimated_wait_minutes": 36,
  "recent_calls": [ { "ticket_code", "status", "desk_label", "called_at" } ],  // last 5 calls in this queue today, codes only
  "notifications": [ { "id", "kind", "message", "status", "created_at" } ]     // this ticket's SMS feed ("Messages" tab)
}
```
A wrong token or ticket gives error `Ticket not found`. It's the same error in both cases, so it doesn't reveal whether the ticket exists.

#### `cancel_ticket(p_ticket_id uuid, p_access_token text) → jsonb`
"I can't make it". Works only while the status is `waiting` or `called`. Returns `{ ticket_id, ticket_code, status: 'cancelled' }`.

#### `get_queue_summary(p_queue_id uuid) → jsonb`
For the clinic picker and the waiting-room screen. No PII.
`{ queue_id, queue_name, clinic_id, clinic_name, is_open, service_date, waiting_count, avg_minutes_per_patient, estimated_wait_minutes_for_new_ticket, now_serving: [{ticket_code,status,desk_label,called_at}], recent_calls: [...] }`

### Staff (authenticated + active row in `staff_members` for that clinic; desk or admin)

Each of these returns the updated `tickets` row, or `null` from `call_next` when nobody is waiting. Each one first checks that the caller is staff at the ticket's clinic.

| RPC | Params | Notes |
|---|---|---|
| `list_queue` | `p_queue_id uuid, p_service_date date = today` | `setof tickets`, ordered by number. RLS-filtered. Use it for the staff desk list |
| `call_next` | `p_queue_id uuid, p_desk_label text = null` | Oldest waiting ticket → called. Safe with several desks (`FOR UPDATE SKIP LOCKED`). Example desk label: `'Desk 2'` |
| `call_ticket` | `p_ticket_id uuid, p_desk_label text = null` | Call a specific waiting ticket, for example an emergency |
| `start_serving` | `p_ticket_id uuid` | called → serving |
| `complete_ticket` | `p_ticket_id uuid` | → done |
| `mark_no_show` | `p_ticket_id uuid` | → no_show |
| `recall_ticket` | `p_ticket_id uuid, p_desk_label text = null` | Second call (also from no_show) |
| `return_to_queue` | `p_ticket_id uuid` | called/no_show → waiting |
| `staff_cancel_ticket` | `p_ticket_id uuid` | → cancelled |

Staff can also read `notifications` directly, for example `supabase.from('notifications').select('*').eq('clinic_id', id).order('created_at', {ascending:false}).limit(50)`, to build the staff Messages tab.

### Admin (clinic `role = 'admin'`)

| RPC | Params | Returns |
|---|---|---|
| `list_staff` | `p_clinic_id uuid` | `table(user_id, email, role, display_name, is_active, created_at)`. Any staff member can call it |
| `add_staff_member` | `p_clinic_id uuid, p_email text, p_role staff_role = 'desk', p_display_name text = null` | `staff_members` row. The person must have signed up first; if not, you get the error "No account with that email…" |
| `update_staff_member` | `p_clinic_id uuid, p_user_id uuid, p_role = null, p_is_active = null, p_display_name = null` | `staff_members` row |
| `remove_staff_member` | `p_clinic_id uuid, p_user_id uuid` | void |

A clinic always keeps at least one active admin, so demoting, deactivating or removing the last admin is rejected. Admins also edit clinics and queues directly through the tables (see section 2).

### Bootstrap

#### `claim_clinic(p_clinic_id uuid, p_claim_code text, p_display_name text = null) → staff_members`
A signed-in user becomes the first admin of a clinic. It works only if all of these are true:
1. The one-time claim code matches (it is stored as a hash).
2. The code hasn't expired (30 days).
3. The code hasn't been used.
4. The clinic has no active admin yet.

---

## 4. Auth flow (staff)

1. Sign up: `supabase.auth.signUp({ email, password })`. Email confirmation is the Supabase default. Set the project **Auth → URL Configuration → Site URL / Redirect URLs** to `https://le-vy03.github.io/ClinicQ/` so confirmation links return to the app.
2. Sign in: `supabase.auth.signInWithPassword({ email, password })`. Keep the session with `onAuthStateChange`.
3. Load memberships from `staff_members` (see above). No membership means "not staff yet". If the clinic is unclaimed, show the "Claim clinic" form.
4. Admin adds colleagues by email (`add_staff_member`) after they sign up.
5. Sign out: `supabase.auth.signOut()`.

Because permissions are table-based, removing or deactivating a staff member takes effect on their very next request. No token refresh is needed.

## 5. Bootstrapping the first admin

**Option A: claim code (no SQL needed).** The project owner already has a one-time code for UTH, which was sent privately. Don't commit it to the repo. Sign up and sign in in the app, then call:
```ts
await supabase.rpc('claim_clinic', { p_clinic_id: 'd7054420-b428-4af2-8138-39ddfaa395ab', p_claim_code: '<CODE>', p_display_name: 'Your name' })
```
To issue a new code (also for new clinics), the owner runs this in the Supabase SQL editor:
```sql
insert into private.clinic_claim_codes (clinic_id, code_hash, expires_at)
values ('<clinic uuid>', private.hash_secret('<NEW-LONG-RANDOM-CODE>'), now() + interval '7 days')
on conflict (clinic_id) do update set code_hash = excluded.code_hash, expires_at = excluded.expires_at, used_at = null, used_by = null;
```

**Option B: SQL editor (owner only).** Sign up in the app first, then run:
```sql
insert into public.staff_members (clinic_id, user_id, role, display_name)
select 'd7054420-b428-4af2-8138-39ddfaa395ab', id, 'admin', 'Clinic Admin'
from auth.users where email = 'you@example.com'
on conflict (clinic_id, user_id) do update set role = 'admin', is_active = true;
```

**New clinic** (owner, SQL editor):
```sql
with c as (insert into public.clinics (name, location, ticket_prefix, avg_minutes_per_patient)
           values ('Chilenje Level 1 Hospital', 'Chilenje, Lusaka', 'CHL', 10) returning id)
insert into public.queues (clinic_id, name) select id, 'General OPD' from c;
```
Then issue a claim code (Option A) or add an admin (Option B).

---

## 6. Realtime

The `supabase_realtime` publication contains `queue_events`, `tickets` and `notifications`. Realtime applies RLS, so anon only ever receives `queue_events`.

**Patient / waiting-room screen (anon):**
```ts
supabase.channel(`queue:${queueId}`)
  .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'queue_events', filter: `queue_id=eq.${queueId}` },
      () => refresh())   // refresh() = get_ticket_status(...) or get_queue_summary(...)
  .subscribe()
```
Each event carries `ticket_code`, `event`, `status` and `desk_label`, so a display board can show "UTH-014 → Desk 2" straight from the payload. Also refresh on `visibilitychange` and every ~60 s as a fallback.

**Staff desk (authenticated):**
```ts
supabase.channel(`desk:${queueId}`)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets', filter: `queue_id=eq.${queueId}` }, reloadQueue)
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `clinic_id=eq.${clinicId}` }, reloadMessages)
  .subscribe()
```
Call `supabase.realtime.setAuth()` after login, or create the channel after the session exists, so RLS sees the staff JWT.

---

## 7. What the front-end must remove

- No more Play demo, Reset demo day, or seeded fake patients.
- Patient "my ticket" comes from `get_ticket_status`. The SMS feed shows `notifications` from the same call. Recent calls come from `recent_calls`.
- "Book for someone else" means `take_ticket` with `p_booked_for_someone_else: true`.
- "I can't make it" means `cancel_ticket`.
- The staff desk needs a login, a queue picker (from `staff_members` → `queues`), `list_queue`, and the call and complete buttons that use the RPCs above.
