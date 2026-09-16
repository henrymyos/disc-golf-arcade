// WCAG relative luminance / contrast helpers, plus the disc outline rule.

export function relLum(hex: string): number {
  const m = /#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(hex);
  const lin = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const r = m ? parseInt(m[1], 16) : 128, g = m ? parseInt(m[2], 16) : 128, b = m ? parseInt(m[3], 16) : 128;
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = relLum(a), lb = relLum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// Minimum contrast for a graphical object to read against its background (WCAG 1.4.11).
export const MIN_EDGE_CONTRAST = 3;
export const OUTLINE_DARK_HEX = "#000000";
export const OUTLINE_LIGHT_HEX = "#ffffff";

export type DiscOutline = { inner: string; outer: string };

/**
 * Two-tone edge for the disc on a course, or null when the body color already
 * reads at 3:1 against every ground surface the disc can sit on (fairway,
 * stripe, rough). Skins and course themes are never changed. Where a body falls
 * short (Ember on Olympus sand, Shadow on Night, Sky on Snow…) the disc gets a
 * one-pixel ring in the shade that contrasts with the body, wrapped in a
 * one-pixel ring of the opposite shade: black and white contrast 21:1 with each
 * other and at least ~4.5:1 with any ground, so one of the two rings always
 * draws a visible boundary, whatever the surface underneath.
 */
export function discOutline(bodyHex: string, groundHexes: string | string[]): DiscOutline | null {
  const grounds = Array.isArray(groundHexes) ? groundHexes : [groundHexes];
  if (grounds.every((gnd) => contrastRatio(bodyHex, gnd) >= MIN_EDGE_CONTRAST)) return null;
  const darkVsBody = contrastRatio(OUTLINE_DARK_HEX, bodyHex);
  const lightVsBody = contrastRatio(OUTLINE_LIGHT_HEX, bodyHex);
  return darkVsBody >= lightVsBody
    ? { inner: OUTLINE_DARK_HEX, outer: OUTLINE_LIGHT_HEX }
    : { inner: OUTLINE_LIGHT_HEX, outer: OUTLINE_DARK_HEX };
}
