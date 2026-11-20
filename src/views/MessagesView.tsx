import { useEffect, useState } from "react";
import { ago } from "../format";
import { useClinicState } from "../store";
import type { Channel, NoticeKind } from "../types";

const KIND_LABEL: Record<NoticeKind, string> = {
  confirmation: "Booking",
  heading: "Head in",
  turn: "Your turn",
  followup: "Reminder",
  noshow: "Released",
};

export function MessagesView() {
  const state = useClinicState();
  const [filter, setFilter] = useState<"all" | Channel | "mine">("all");
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((value) => value + 1), 15000);
    return () => window.clearInterval(id);
  }, []);

  const notices = state.notices.filter((notice) => {
    if (filter === "all") return true;
    if (filter === "mine") return notice.bookingId === state.myTicketId;
    return notice.channel === filter;
  });

  return (
    <section className="panel" aria-labelledby="messages-heading">
      <p className="eyebrow">Notifications</p>
      <h2 id="messages-heading">Messages ClinicQ would send</h2>
      <p className="lede">SMS and WhatsApp, in plain Zambian English. Nothing leaves this phone — this feed is the demo.</p>
      <div className="pills" role="tablist" aria-label="Message filter">
        {([
          ["all", "All"],
          ["whatsapp", "WhatsApp"],
          ["sms", "SMS"],
          ["mine", "This visit"],
        ] as const).map(([id, label]) => (
          <button key={id} type="button" className={`pill ${filter === id ? "is-on" : ""}`} aria-pressed={filter === id} onClick={() => setFilter(id)}>
            {label}
          </button>
        ))}
      </div>
      {notices.length === 0 ? (
        <p className="empty">No messages in this filter yet. Book a visit or play the demo and they will land here.</p>
      ) : (
        <ol className="feed">
          {notices.map((notice) => (
            <li key={notice.id} className={`bubble tone-${notice.channel}`}>
              <div className="bubble-top">
                <span className={`channel tone-${notice.channel}`}>{notice.channel === "whatsapp" ? "WhatsApp" : "SMS"}</span>
                <span className="kind">{KIND_LABEL[notice.kind]}</span>
                <time dateTime={new Date(notice.createdAt).toISOString()}>{ago(notice.createdAt)}</time>
              </div>
              <p className="bubble-who">
                {notice.patientName}
                <span>{notice.to}</span>
              </p>
              <p className="bubble-body">{notice.body}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
