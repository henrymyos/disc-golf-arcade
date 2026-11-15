import { describe, it, expect } from "vitest";
import { padKeys, padPresses, PAD_REPEAT_DELAY, PAD_REPEAT_EVERY } from "../lib/discgolf/gamepad";

const pad = (pressed: number[], axes = [0, 0]) => ({
  buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i) })),
  axes,
});

describe("gamepad", () => {
  it("maps d-pad, stick and A/B to the keyboard keys", () => {
    expect([...padKeys(pad([14, 0]))].sort()).toEqual([" ", "ArrowLeft"]);
    expect([...padKeys(pad([1], [0.9, -0.8]))].sort()).toEqual(["ArrowRight", "ArrowUp", "Escape"]);
    expect(padKeys(pad([], [0.3, -0.3])).size).toBe(0); // inside the dead zone
    expect(padKeys({ buttons: [], axes: [] }).size).toBe(0); // non-standard / empty pad
  });

  it("fires new presses once, repeats held arrows after a delay, never repeats buttons", () => {
    const held = new Map<string, number>();
    const both = new Set(["ArrowUp", " "]);
    expect(padPresses(both, held, 0)).toEqual(["ArrowUp", " "]);
    expect(padPresses(both, held, PAD_REPEAT_DELAY - 1)).toEqual([]);
    expect(padPresses(both, held, PAD_REPEAT_DELAY)).toEqual(["ArrowUp"]);
    expect(padPresses(both, held, PAD_REPEAT_DELAY + PAD_REPEAT_EVERY)).toEqual(["ArrowUp"]);
    expect(padPresses(new Set(), held, 1000)).toEqual([]); // release clears
    expect(held.size).toBe(0);
    expect(padPresses(new Set([" "]), held, 1001)).toEqual([" "]); // a fresh press fires again
  });
});
