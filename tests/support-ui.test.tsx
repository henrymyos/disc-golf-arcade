import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SupportLink, SupportNudgeBar, SupportPromptsToggle, SupportSettingsRow } from "../components/support/Support";
import { SUPPORTERS } from "../lib/supporters";

const URL = "https://ko-fi.com/test";
afterEach(() => vi.unstubAllEnvs());

describe("support UI", () => {
  it("renders nothing anywhere when NEXT_PUBLIC_SUPPORT_URL is unset", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPPORT_URL", "");
    for (const el of [h(SupportLink), h(SupportPromptsToggle), h(SupportSettingsRow), h(SupportSettingsRow, { supporters: ["Ann"] })]) {
      expect(renderToStaticMarkup(el)).toBe("");
    }
  });
  it("with the URL set: menu link copy, Settings row, new-tab links", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPPORT_URL", URL);
    const menu = renderToStaticMarkup(h(SupportLink));
    expect(menu).toContain("Support the Arcade");
    expect(menu).toContain("Free, no ads, no paywalls. Tips help pay for new courses.");
    const row = renderToStaticMarkup(h(SupportSettingsRow));
    expect(row).toContain(`href="${URL}"`);
    expect(row).toContain('target="_blank" rel="noopener"');
    expect(row).not.toContain("Thanks to our supporters");
  });
  it("supporters line shows only when the list has names", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPPORT_URL", URL);
    expect(SUPPORTERS).toEqual([]);
    expect(renderToStaticMarkup(h(SupportSettingsRow, { supporters: ["Ann", "Bo", "Cy"] }))).toContain("Thanks to our supporters: Ann, Bo, Cy");
  });
  it("Settings row: the whole row is the link, at least 44 px tall", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPPORT_URL", URL);
    const row = renderToStaticMarkup(h(SupportSettingsRow));
    expect(row).toMatch(/<a href="[^"]+" target="_blank" rel="noopener" class="[^"]*min-h-11[^"]*"><span[^>]*>Support<\/span>/);
  });
  it("round-end nudge: copy, new-tab Ko-fi link, 44 px dismiss button", () => {
    const bar = renderToStaticMarkup(h(SupportNudgeBar, { url: URL, onDismiss: () => {} }));
    expect(bar).toContain("Enjoying the Arcade? A tip on Ko-fi helps pay for new courses.");
    expect(bar).toContain(`<a href="${URL}" target="_blank" rel="noopener"`);
    expect(bar).toContain(">Tip on Ko-fi</a>");
    expect(bar).toMatch(/<button type="button" aria-label="Dismiss" class="[^"]*min-w-11 min-h-11[^"]*">✕<\/button>/);
  });
});
