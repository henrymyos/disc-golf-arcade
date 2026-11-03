import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SupportLink, SupportPromptsToggle, SupportSettingsRow } from "../components/support/Support";
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
});
