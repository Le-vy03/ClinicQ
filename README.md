# ClinicQ

A live queue for Zambia's public clinics. Patients take a ticket without an account. Staff sign in, call the next person, and the ticket on the patient's phone moves with the desk.

The running site is [https://le-vy03.github.io/ClinicQ/](https://le-vy03.github.io/ClinicQ/).

## How a clinic gets started

1. A staff member opens **Staff desk**, creates an account, and confirms the email.
2. The project owner gives them the one-time claim code in private. They enter it on **Claim clinic**. That person becomes the clinic admin. The code is not in this repo.
3. The admin adds colleagues by email after those people have signed up.
4. Alternatively, the owner can insert the first admin in the Supabase SQL editor. The exact statement is in [docs/API.md](docs/API.md) under "Bootstrapping the first admin".

University Teaching Hospital and its General OPD queue are already in the database.

## Run locally

```bash
npm install
npm start
```

Open [http://127.0.0.1:4179](http://127.0.0.1:4179).

`npm start` is the app. To check the production build that GitHub Pages serves under `/ClinicQ/`:

```bash
npm run build
npm run preview
```

The preview is at [http://127.0.0.1:4179/ClinicQ/](http://127.0.0.1:4179/ClinicQ/).

## Environment

The browser uses the public Supabase URL and publishable key in `src/lib/config.ts`. Override them without editing code:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Do not put a service role or secret key in the app or in this repo.

For staff email confirmation and password reset, set the Supabase Auth **Site URL** and **Redirect URLs** to:

- `https://le-vy03.github.io/ClinicQ/`
- `http://127.0.0.1:4179/`

## Backend contract

The database is not changed from this app. The contract is [docs/API.md](docs/API.md). The reference SQL is [supabase/schema.sql](supabase/schema.sql) and [supabase/seed.sql](supabase/seed.sql).

Patients call `take_ticket`, `get_ticket_status`, and `cancel_ticket`. Staff use Supabase Auth plus the desk RPCs. Live updates come from the `queue_events`, `tickets`, and `notifications` realtime publications. SMS rows are stored, but nothing sends them yet.
