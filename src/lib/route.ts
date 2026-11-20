import { useEffect, useState } from "react";

export type Route =
  | { name: "home"; bookForElse: boolean }
  | { name: "ticket"; id: string; token: string | null }
  | { name: "staff"; tab: "desk" | "messages" | "team" | "settings" }
  | { name: "display"; queueId: string }
  | { name: "notfound" };

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, "") || "/";
  const [pathPart, queryPart] = raw.split("?");
  const path = pathPart.startsWith("/") ? pathPart : `/${pathPart}`;
  const query = new URLSearchParams(queryPart ?? "");
  const bits = path.split("/").filter(Boolean);
  if (bits.length === 0) return { name: "home", bookForElse: query.get("book") === "else" };
  if (bits[0] === "ticket" && bits[1]) return { name: "ticket", id: decodeURIComponent(bits[1]), token: query.get("t") };
  if (bits[0] === "staff") {
    const tab = bits[1];
    if (tab === "messages" || tab === "team" || tab === "settings") return { name: "staff", tab };
    return { name: "staff", tab: "desk" };
  }
  if (bits[0] === "display" && bits[1]) return { name: "display", queueId: decodeURIComponent(bits[1]) };
  return { name: "notfound" };
}

export function go(path: string) {
  const next = path.startsWith("#") ? path : `#${path.startsWith("/") ? path : `/${path}`}`;
  if (window.location.hash === next) {
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    return;
  }
  window.location.hash = next;
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}
