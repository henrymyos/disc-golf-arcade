// ── Cross-domain progress transfer. Anonymous progress lives in localStorage,
// which is scoped to a single origin — so a player on the old `*.vercel.app` link
// can't see it on the canonical discgolfarcade.com domain. (Signed-in players are
// already covered: their progress mirrors to Supabase by user_id, which is
// domain-independent.) This packs a progress snapshot into a URL fragment that the
// canonical domain decodes and merges on arrival, so progress moves over in one
// click. The fragment is client-only — it never reaches the server, so its length
// isn't bounded by request limits. ──

import { type Progress, readLocalProgress } from "../progress";

export const CANONICAL_HOST = "discgolfarcade.com";
const PARAM = "xfer";

// True when running on the old Vercel link (or a preview) rather than the canonical
// custom domain — i.e. progress here is stranded in this origin's localStorage.
export function isLegacyHost(): boolean {
  if (typeof window === "undefined") return false;
  return location.hostname.endsWith(".vercel.app");
}

// URL-safe base64 of a UTF-8 string (so emoji/names in profiles survive).
function b64encode(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64decode(s: string): string {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

// Serialize a snapshot into a transfer token. History is trimmed to the most recent
// 100 rounds (matching applyProgress) to keep the fragment compact.
export function encodeProgress(p: Progress): string {
  const slim: Progress = { ...p, history: (p.history ?? []).slice(-100) };
  return b64encode(JSON.stringify(slim));
}
export function decodeProgress(token: string): Progress | null {
  try {
    const obj = JSON.parse(b64decode(token));
    return obj && typeof obj === "object" ? (obj as Progress) : null;
  } catch {
    return null;
  }
}

// The link that carries this device's progress to the canonical domain.
export function transferUrl(p: Progress = readLocalProgress()): string {
  return `https://${CANONICAL_HOST}/#${PARAM}=${encodeProgress(p)}`;
}

// Decode a transfer token from the current URL fragment, or null if there's none.
export function readTransferToken(): Progress | null {
  if (typeof window === "undefined") return null;
  const m = location.hash.match(new RegExp(`[#&]${PARAM}=([^&]+)`));
  return m ? decodeProgress(m[1]) : null;
}

// Strip just the transfer token from the address bar (leaving any other fragment,
// e.g. a Supabase auth callback, intact) — no navigation.
export function clearTransferToken(): void {
  if (typeof window === "undefined") return;
  const kept = location.hash.replace(/^#/, "").split("&").filter((kv) => !kv.startsWith(`${PARAM}=`)).join("&");
  try {
    history.replaceState(null, "", location.pathname + location.search + (kept ? `#${kept}` : ""));
  } catch {
    /* ignore */
  }
}
