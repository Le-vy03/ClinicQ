import { useEffect, useState } from "react";
import { Shell } from "./components/Shell";
import { forgetDemoState } from "./lib/tickets";
import { useRoute } from "./lib/route";
import type { ThemeName } from "./types";
import { DisplayPage } from "./views/DisplayPage";
import { PatientHome } from "./views/PatientHome";
import { StaffPage } from "./views/StaffPage";
import { TicketPage } from "./views/TicketPage";

const THEME_KEY = "clinicq.theme";

function readTheme(): ThemeName {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "teal" || stored === "forest" || stored === "navy") return stored;
  return "navy";
}

export default function App() {
  const route = useRoute();
  const [theme, setTheme] = useState<ThemeName>(readTheme);

  useEffect(() => {
    forgetDemoState();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  if (route.name === "display") return <DisplayPage queueId={route.queueId} />;

  return (
    <Shell route={route} theme={theme} setTheme={setTheme}>
      {route.name === "home" && <PatientHome bookForElse={route.bookForElse} />}
      {route.name === "ticket" && <TicketPage id={route.id} token={route.token} />}
      {route.name === "staff" && <StaffPage tab={route.tab} />}
      {route.name === "notfound" && (
        <section className="max-w-xl mx-auto p-8">
          <h2 className="text-xl font-extrabold">Page not found</h2>
          <p className="text-sm text-slate-600 mt-2">That address is not part of ClinicQ.</p>
        </section>
      )}
    </Shell>
  );
}
