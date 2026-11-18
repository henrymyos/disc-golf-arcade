import { describe, expect, it } from "vitest";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DailyCard } from "../components/menu/DailyCard";
import type { Goal } from "../lib/discgolf/goals";

const goal: Goal = { id: "stars", kind: "daily", emoji: "⭐", title: "Earn today's Daily stars", detail: "0/3 stars", progress: 0.5 };
const base = { stars: 1, best: -2, streak: 3, onPlay: () => {}, goal: null as Goal | null };
const card = (props: Partial<Parameters<typeof DailyCard>[0]>) =>
  renderToStaticMarkup(h(DailyCard, { ...base, reward: { available: false, streak: 5, onClaim: () => {} }, ...props }));

describe("home Daily card", () => {
  it("one play button carrying stars, today's best and the Daily streak", () => {
    const html = card({});
    expect(html.match(/<button/g)).toHaveLength(1);
    expect(html).toContain("Play today&#x27;s Daily");
    expect(html).toContain("Best today -2");
    expect(html).toContain('aria-label="Daily streak 3 days"');
    expect(html).toContain('aria-label="1 of 3 stars today"');
  });
  it("reward: a 44 px claim button when available, else Claimed with the reward streak", () => {
    const open = card({ reward: { available: true, streak: 5, onClaim: () => {} } });
    expect(open.match(/<button/g)).toHaveLength(2);
    expect(open).toMatch(/<button[^>]*min-h-11[^>]*>🎁 Daily reward<\/button>/);
    expect(card({})).toContain("🎁 Claimed · 🔥 5d");
  });
  it("Next goal folds in as one line with a progress bar, and hides when there is none", () => {
    const html = card({ goal });
    expect(html).toContain('aria-label="Next goal"');
    expect(html).toContain("Earn today&#x27;s Daily stars");
    expect(html).toContain('aria-valuenow="50"');
    expect(card({})).not.toContain("Next goal");
  });
});
