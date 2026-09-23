import { describe, it, expect } from "vitest";
import {
  buildReplay, validateReplay, replayFrame, replayHoleDuration, thinReplayPath,
  replayId, isReplayId, REPLAY_PAUSE, REPLAY_HOLE_TAIL,
} from "../lib/discgolf/replay";

const line = (x0: number, y0: number, x1: number, y1: number, n = 40) =>
  Array.from({ length: n }, (_, i) => ({ x: x0 + ((x1 - x0) * i) / (n - 1), y: y0 + ((y1 - y0) * i) / (n - 1) }));

const sample = () => buildReplay({
  mode: "course", seed: 12345, name: "  Henry  ", scores: [3, 4], pars: [3, 4],
  paths: [[line(100, 900, 110, 300), line(110, 300, 112, 120, 10)], [line(80, 1000, 90, 200), line(90, 200, 95, 90, 12), line(95, 90, 96, 80, 4)]],
});

describe("replay packing", () => {
  it("thins paths to every 3rd point plus the last, rounded", () => {
    const p = thinReplayPath(line(0.4, 0.4, 100.6, 50.2, 10));
    expect(p.length).toBe(4); // indices 0,3,6,9
    expect(p[0]).toEqual({ x: 0, y: 0 });
    expect(p[p.length - 1]).toEqual({ x: 101, y: 50 });
  });

  it("builds a replay that survives a JSON round trip through validation", () => {
    const r = sample();
    expect(r.name).toBe("Henry");
    expect(r.scale).toBeUndefined();
    const back = validateReplay(JSON.parse(JSON.stringify(r)));
    expect(back).toEqual(r);
  });

  it("keeps a non-default career hole-length scale", () => {
    const r = buildReplay({ mode: "tour", seed: 7, scale: 0.8, name: "x", scores: [3], pars: [3], paths: [[line(0, 0, 0, 100)]] });
    expect(validateReplay(JSON.parse(JSON.stringify(r)))?.scale).toBe(0.8);
  });
});

// Loosely-typed copy so each case can break one field.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;

describe("validateReplay rejects bad input", () => {
  const good = (): Loose => JSON.parse(JSON.stringify(sample()));
  it.each([
    ["wrong version", (r: Loose) => { r.v = 2; }],
    ["unknown mode", (r: Loose) => { r.mode = "party"; }],
    ["non-integer seed", (r: Loose) => { r.seed = 1.5; }],
    ["scores length mismatch", (r: Loose) => { r.scores.push(3); }],
    ["absurd score", (r: Loose) => { r.scores[0] = 500; }],
    ["NaN coordinate", (r: Loose) => { r.paths[0][0][2].x = null; }],
    ["huge coordinate", (r: Loose) => { r.paths[0][0][2].y = 1e9; }],
    ["too many shots", (r: Loose) => { r.paths[0] = Array(21).fill(r.paths[0][0]); }],
    ["empty path", (r: Loose) => { r.paths[0][0] = []; }],
    ["silly scale", (r: Loose) => { r.scale = 50; }],
  ])("%s", (_label, mutate) => {
    const r = good();
    mutate(r);
    expect(validateReplay(r)).toBeNull();
  });
  it("non-objects", () => {
    expect(validateReplay(null)).toBeNull();
    expect(validateReplay("nope")).toBeNull();
  });
});

describe("replayFrame timeline", () => {
  const shots = [line(0, 1000, 0, 400), line(0, 400, 0, 100, 20)];

  it("stands over the lie before each throw", () => {
    const f = replayFrame(shots, 100);
    expect(f).toMatchObject({ x: 0, y: 1000, done: 0, flying: -1, finished: false });
  });

  it("flies along the path with a live trail, then leaves the shot done", () => {
    const mid = replayFrame(shots, REPLAY_PAUSE + 600);
    expect(mid.flying).toBe(0);
    expect(mid.y).toBeLessThan(1000);
    expect(mid.y).toBeGreaterThan(400);
    expect(mid.lift).toBeGreaterThan(0);
    expect(mid.trail.length).toBeGreaterThan(1);
    expect(mid.trail[mid.trail.length - 1]).toEqual({ x: mid.x, y: mid.y });
    // second shot's pause: first shot is done, disc waits at its landing spot
    const t2 = replayHoleDuration([shots[0]]) - REPLAY_HOLE_TAIL + 50;
    expect(replayFrame(shots, t2)).toMatchObject({ x: 0, y: 400, done: 1, flying: -1 });
  });

  it("finishes only after the closing pause", () => {
    const total = replayHoleDuration(shots);
    const end = replayFrame(shots, total - 10);
    expect(end).toMatchObject({ done: 2, finished: false, y: 100 });
    expect(replayFrame(shots, total + 1).finished).toBe(true);
  });

  it("is monotonic toward the basket on a straight hole", () => {
    let prev = Infinity;
    for (let t = 0; t < replayHoleDuration(shots); t += 50) {
      const y = replayFrame(shots, t).y;
      expect(y).toBeLessThanOrEqual(prev + 1e-9);
      prev = y;
    }
  });
});

describe("replay ids", () => {
  it("are 10 unambiguous characters", () => {
    for (let i = 0; i < 50; i++) expect(isReplayId(replayId())).toBe(true);
    expect(isReplayId("../../etc")).toBe(false);
    expect(isReplayId("ABCDEFGHJK")).toBe(false);
    expect(isReplayId("abc0efghjk")).toBe(false); // 0 is ambiguous, never issued
  });
});
