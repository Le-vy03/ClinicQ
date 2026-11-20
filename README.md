# ClinicQ

A queue number for Zambia's public clinics. Patients book a desk and a time, hold a live place in line, and get the SMS or WhatsApp they would otherwise have waited all morning to hear.

ClinicQ is a single static page. There is no server. The queue and the message feed live in `localStorage` under `clinicq.desk.v1`, so the patient ticket and the staff desk stay in step across two tabs in the same browser.

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

1. Open the app. The navy panel states the problem: patients lose whole days queuing at government clinics. ClinicQ holds a place at UTH, then messages you when it is time to walk in. The header can switch Medical Blue, Clean Teal, or Classic Green.
2. Stay on **Patient**. Lweendo Tembo already holds **UTH-118** at University Teaching Hospital, General OPD, 5th in line, about 48 minutes.
3. Press **Play demo**, or open **Staff desk** and press **Call Next Patient**. Each step removes the person at the desk. When two people are ahead, an SMS says to start heading in. When it is her turn, the ticket says "Your turn now!"
4. Open **Messages** for the SMS feed sent to +260 97 418 6620. **Book for someone else** issues UTH-119. **I can't make it** releases UTH-118.
5. Open the same URL in a second tab. Calling the next patient on the staff desk moves the ticket in the other tab. **Reset demo day** puts UTH-118 back to 5th.
