import { useEffect, useState } from "react";
import { advanceDemo, resetDay } from "./store";
import { MessagesView } from "./views/MessagesView";
import { PatientView } from "./views/PatientView";
import { StaffView } from "./views/StaffView";

type View = "patient" | "staff" | "messages";

function viewFromHash(): View {
  const hash = window.location.hash.replace(/^#\/?/, "");
  if (hash.startsWith("staff")) return "staff";
  if (hash.startsWith("message") || hash.startsWith("alert")) return "messages";
  return "patient";
}

export default function App() {
  const [view, setView] = useState<View>(viewFromHash);
  const [demoOn, setDemoOn] = useState(false);
  const [demoNote, setDemoNote] = useState("");

  useEffect(() => {
    const onHash = () => setView(viewFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    const titles: Record<View, string> = {
      patient: "ClinicQ — your ticket",
      staff: "ClinicQ — staff desk",
      messages: "ClinicQ — messages",
    };
    document.title = titles[view];
  }, [view]);

  useEffect(() => {
    if (!demoOn) return;
    const id = window.setInterval(() => {
      const result = advanceDemo();
      setDemoNote(result.note);
      if (!result.running) setDemoOn(false);
    }, 3200);
    return () => window.clearInterval(id);
  }, [demoOn]);

  function openView(next: View) {
    const hash = next === "patient" ? "#/patient" : next === "staff" ? "#/staff" : "#/messages";
    if (window.location.hash !== hash) window.location.hash = hash;
    setView(next);
    document.querySelector(".workspace")?.scrollTo({ top: 0 });
  }

  function toggleDemo() {
    setDemoOn((on) => {
      const next = !on;
      setDemoNote(next ? "Demo on. UTH General OPD moves every few seconds." : "Demo paused. The queue stays where it is.");
      return next;
    });
  }

  return (
    <div className="shell">
      <div className="flagbar" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>
      <aside className="brand">
        <div className="logo">
          <span className="mark" aria-hidden="true">CQ</span>
          <span>
            <strong>ClinicQ</strong>
            <em>Lusaka public clinics</em>
          </span>
        </div>
        <p className="problem">Patients in Zambia lose whole days queuing at government clinics.</p>
        <p className="pitch">ClinicQ holds your place at UTH and other Lusaka clinics, then messages you when it is time to walk in.</p>
        <nav className="side-nav" aria-label="Views">
          <button id="nav-patient" type="button" className={view === "patient" ? "is-on" : ""} aria-current={view === "patient" ? "page" : undefined} onClick={() => openView("patient")}>Patient</button>
          <button id="nav-staff" type="button" className={view === "staff" ? "is-on" : ""} aria-current={view === "staff" ? "page" : undefined} onClick={() => openView("staff")}>Staff desk</button>
          <button id="nav-messages" type="button" className={view === "messages" ? "is-on" : ""} aria-current={view === "messages" ? "page" : undefined} onClick={() => openView("messages")}>Messages</button>
        </nav>
        <div className="demo-box">
          <button id="demo-toggle" type="button" className={`btn btn-block ${demoOn ? "btn-orange" : "btn-light"}`} aria-pressed={demoOn} onClick={toggleDemo}>
            {demoOn ? "Stop demo" : "Play demo"}
          </button>
          <button id="reset-day" type="button" className="text-btn light" onClick={() => { resetDay(); setDemoNote("Demo day reset. Lweendo is 5th at UTH again."); }}>
            Reset demo day
          </button>
          {demoNote && <p className="demo-note">{demoNote}</p>}
        </div>
      </aside>
      <div className="workspace">
        {view === "patient" && <PatientView />}
        {view === "staff" && <StaffView />}
        {view === "messages" && <MessagesView />}
      </div>
      <nav className="mobile-nav" aria-label="Views">
        <button type="button" className={view === "patient" ? "is-on" : ""} onClick={() => openView("patient")}>Patient</button>
        <button type="button" className={view === "staff" ? "is-on" : ""} onClick={() => openView("staff")}>Staff</button>
        <button type="button" className={view === "messages" ? "is-on" : ""} onClick={() => openView("messages")}>Messages</button>
      </nav>
    </div>
  );
}
