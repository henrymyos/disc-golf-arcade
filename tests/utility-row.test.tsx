import { describe, expect, it } from "vitest";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { UtilityRow } from "../components/menu/UtilityRow";

const noop = () => {};
const row = (goalsReady: number) => renderToStaticMarkup(h(UtilityRow, { goalsReady, onBag: noop, onShop: noop, onGoals: noop, onBoards: noop }));

describe("home utility icon row", () => {
  it("four square icon buttons in order, named by the full word, each a >= 44 px target", () => {
    const html = row(0);
    const labels = [...html.matchAll(/<button[^>]*aria-label="([^"]+)"/g)].map((m) => m[1]);
    expect(labels).toEqual(["Bag", "Shop", "Goals", "Leaderboards"]);
    expect(html.match(/<button[^>]*min-h-11/g)).toHaveLength(4);
    expect(html.match(/w-12 h-12/g)).toHaveLength(4); // 48 px squares
    for (const icon of ["🎒", "🛒", "🎯", "🏆"]) expect(html).toContain(icon);
    expect(html).not.toContain("utility-badge");
  });
  it("Goals shows a badge with the claimable count and says it in its name", () => {
    const html = row(2);
    expect(html).toContain('aria-label="Goals, 2 to claim"');
    expect(html).toMatch(/data-testid="utility-badge">2<\/span>/);
    expect(html.match(/utility-badge/g)).toHaveLength(1);
  });
  it("each button calls its own handler", () => {
    const calls: string[] = [];
    const el = UtilityRow({ goalsReady: 0, onBag: () => calls.push("bag"), onShop: () => calls.push("shop"), onGoals: () => calls.push("goals"), onBoards: () => calls.push("boards") });
    for (const b of (el.props.children as { props: { onClick: () => void } }[])) b.props.onClick();
    expect(calls).toEqual(["bag", "shop", "goals", "boards"]);
  });
});
