import { describe, it, expect } from "vitest";
import { padKeys, padPresses, cycleBag, spatialNext, PAD_REPEAT_DELAY, PAD_REPEAT_EVERY } from "../lib/discgolf/gamepad";

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
    expect([...padKeys(pad([9]))]).toEqual(["p"]); // Start opens the in-round menu
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

describe("bag cycling", () => {
  const bag = ["aviar", "buzzz", "destroyer"];
  it("steps through the bag and wraps both ways", () => {
    expect(cycleBag(bag, "buzzz", "]")).toBe("destroyer");
    expect(cycleBag(bag, "destroyer", "]")).toBe("aviar");
    expect(cycleBag(bag, "aviar", "[")).toBe("destroyer");
  });
  it("falls back to the first slot, ignores other keys and empty bags", () => {
    expect(cycleBag(bag, "wraith", "]")).toBe("aviar");
    expect(cycleBag(bag, undefined, "[")).toBe("aviar");
    expect(cycleBag(bag, "buzzz", "x")).toBeNull();
    expect(cycleBag([], "buzzz", "]")).toBeNull();
  });
  it("pad bumpers and face buttons map to the bag and stance keys", () => {
    expect([...padKeys(pad([2, 3, 4, 5]))].sort()).toEqual(["[", "]", "b", "f"]);
  });

  it("menu arrows move to the nearest button that way, down a grid before across", () => {
    const box = (left: number, top: number) => ({ left, top, width: 100, height: 40 });
    // 2-column hub: 0 1 / 2 3, then a wide Close button 4 under the grid
    const boxes = [box(0, 0), box(120, 0), box(0, 60), box(120, 60), { left: 0, top: 120, width: 220, height: 40 }];
    expect(spatialNext(boxes, 0, "ArrowDown")).toBe(2);
    expect(spatialNext(boxes, 0, "ArrowRight")).toBe(1);
    expect(spatialNext(boxes, 3, "ArrowLeft")).toBe(2);
    expect(spatialNext(boxes, 3, "ArrowUp")).toBe(1);
    expect(spatialNext(boxes, 2, "ArrowDown")).toBe(4);
    expect(spatialNext(boxes, 4, "ArrowDown")).toBe(-1); // nothing below: stay put
    expect(spatialNext(boxes, 0, "Escape")).toBe(-1);
  });
});
