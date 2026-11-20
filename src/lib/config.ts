const DEFAULT_URL = "https://qmxtuhaczrsseetnlaeh.supabase.co";
const DEFAULT_PUBLISHABLE_KEY = "sb_publishable_LMQQ1YBBnMe5kpU1ncIbBA_PfH15uMS";

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || DEFAULT_URL;
export const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || DEFAULT_PUBLISHABLE_KEY;

export const appBaseUrl = () => {
  const base = import.meta.env.BASE_URL || "/";
  return `${window.location.origin}${base.endsWith("/") ? base : `${base}/`}`;
};
