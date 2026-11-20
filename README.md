# ClinicQ

A queue number for Zambia's public clinics. Patients book a desk and a time, hold a live place in line, and get the SMS or WhatsApp they would otherwise have waited all morning to hear.

ClinicQ is a single-page demo. There is no server. Today's queue, tickets, and the message feed live in `localStorage` under `clinicq.v1`, so a patient's ticket and the staff desk stay in step in the same browser — including across two tabs.

## Run

```bash
npm install
npm start
```

Open [http://127.0.0.1:4179](http://127.0.0.1:4179).

`npm start` is the app. To check the production build:

```bash
npm run build
npm run preview
```

## 60-second demo

1. Open the app. The green panel is the pitch: patients lose whole days queuing at government clinics, and ClinicQ holds a place at UTH and other Lusaka clinics, then messages you when it is time to walk in.
2. Stay on **Patient**. The ticket is already Lweendo Tembo, **UTH-118**, General OPD, 5th in line, about 48 minutes, with the people ahead of her listed.
3. Press **Play demo**. Every few seconds the UTH desk sees one patient and calls the next. Lweendo's place climbs. When she is 3rd, a WhatsApp lands: "you are 3rd in line… Start heading in." When her number is called, the ticket turns red: it is your turn. One more step and she is seen, with a pharmacy reminder.
4. Open **Messages**. The feed is the simulated SMS and WhatsApp log, in plain Zambian English: booking confirmation, "start heading in", "it is your turn", a missed-turn note, and a medicine reminder.
5. Open **Staff desk**. That is the same UTH queue. **Mark as seen** or **No-show**, then **Call next patient**. Open Patient in a second tab if you want to show the ticket move while the desk works. **Reset demo day** puts the seeded morning back.

To book a new patient instead of using Lweendo: **Book for someone else**, pick a clinic, a desk, and a time, then enter a name and a `+260` mobile (097 Airtel, 096 MTN, 095 Zamtel).

## What's seeded

- **UTH** General OPD is the busy story queue, with Mutale Phiri already at the desk.
- **Chilenje Level 1 Hospital** Maternal Health, **Kanyama Clinic** Paediatrics, and **Matero Clinic** ART Clinic each have their own line.
- Dental and the quieter desks start empty, so the staff view can show a clear queue.
