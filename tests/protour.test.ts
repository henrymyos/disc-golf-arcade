import { describe, it, expect } from "vitest";
import {
  proHoleToHole,
  proHoleBoundsFt,
  PROTOUR_COURSES,
  isProTourSeed,
  proTourCourseById,
  generateTourCourse,
  courseHoles,
  tourVenue,
  TOUR_COURSES,
  stepFlight,
  resolvePenalty,
  treesAtLie,
  fullPowerRange,
  distBetween,
  pathLengthPx,
  ADV_DISCS,
  STRAIGHT_SPEED_MUL,
  W,
  TEE_BEHIND,
  buildRound,
  isTeeLie,
  catchRFor,
  CATCH_R,
  PROTOUR_TEE_CATCH_MUL,
} from "../lib/discgolf/engine";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import type { Hole, Vec, Flight, Disc } from "../lib/discgolf/engine";
import type { ProHole } from "../lib/discgolf/protour/types";
import { SEASON_2026, BUILT_COURSE_IDS } from "../lib/discgolf/protour/season2026";
import { MAPLE_HILL } from "../lib/discgolf/protour/maple-hill";
import { BREWSTER_RIDGE } from "../lib/discgolf/protour/brewster-ridge";
import { IDLEWILD } from "../lib/discgolf/protour/idlewild";
import { WINTHROP_GOLD } from "../lib/discgolf/protour/winthrop-gold";
import { KENSINGTON_TOBOGGAN } from "../lib/discgolf/protour/kensington-toboggan";
import { FOX_RUN_MEADOWS } from "../lib/discgolf/protour/fox-run-meadows";
import { IVY_HILL } from "../lib/discgolf/protour/ivy-hill";
import { NORTHWOOD_BLACK } from "../lib/discgolf/protour/northwood-black";
import { HARVEY_PENICK } from "../lib/discgolf/protour/harvey-penick";
import { BRIGHTON_MAJESTIC } from "../lib/discgolf/protour/brighton-majestic";
import { BLACK_LOCUST_SOUTH } from "../lib/discgolf/protour/black-locust-south";
import { stopSummary } from "../lib/discgolf/protour/stopSummary";

const FT = 1.8; // FEET_PER_PX

// The MPO scorecards from the three 2026 caddie books (spec §6), typed in by
// hand so a data edit can never silently drift from the books.
const CARDS: Record<string, { par: number[]; ft: number[]; pages?: number[]; totalPar: number; totalFt: number }> = {
  "maple-hill": {
    par: [4, 3, 3, 3, 3, 3, 3, 3, 5, 3, 4, 4, 3, 3, 3, 3, 4, 4],
    ft: [868, 381, 407, 277, 262, 385, 422, 364, 950, 327, 855, 710, 472, 445, 322, 476, 730, 640],
    totalPar: 61, totalFt: 9293,
  },
  "brewster-ridge": {
    par: [3, 4, 3, 4, 3, 3, 4, 5, 3, 3, 4, 3, 4, 3, 3, 3, 4, 3],
    ft: [385, 550, 320, 550, 305, 345, 575, 830, 375, 475, 665, 430, 570, 355, 400, 410, 715, 400],
    totalPar: 62, totalFt: 8655,
  },
  idlewild: {
    par: [4, 4, 4, 4, 3, 4, 4, 4, 3, 3, 3, 4, 4, 4, 4, 5, 3, 4],
    ft: [638, 601, 656, 722, 432, 555, 484, 576, 258, 368, 242, 564, 584, 556, 487, 969, 287, 650],
    totalPar: 68, totalFt: 9629,
  },
  // Wave 1 (spec addendum disc-golf-arcade-pro-tour-wave1.md).
  // Winthrop Gold (USDGC), MPO A pins. The holes add up to 9,727 ft; the book's
  // TOT cell prints 9,728, a rounding artefact of its metre source.
  "winthrop-gold": {
    par: [3, 3, 4, 3, 5, 3, 3, 4, 3, 4, 4, 4, 4, 3, 4, 3, 3, 4],
    ft: [282, 410, 833, 299, 1024, 371, 285, 696, 394, 548, 735, 902, 712, 413, 538, 390, 249, 646],
    pages: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
    totalPar: 64, totalFt: 9727,
  },
  // Kensington Toboggan (Pro Worlds final round), MPO.
  "kensington-toboggan": {
    par: [3, 4, 4, 4, 3, 4, 4, 4, 3, 4, 3, 3, 3, 4, 5, 3, 4, 4],
    ft: [528, 686, 892, 587, 463, 518, 682, 499, 489, 610, 472, 348, 528, 804, 1129, 394, 846, 650],
    pages: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19],
    totalPar: 66, totalFt: 11125,
  },
  // Fox Run Meadows (Green Mountain Championship rounds 3–4), MPO pages only.
  "fox-run-meadows": {
    par: [4, 3, 3, 4, 3, 3, 5, 4, 3, 3, 4, 5, 3, 3, 3, 4, 3, 4],
    ft: [595, 250, 300, 630, 455, 365, 1295, 745, 480, 315, 595, 1055, 405, 345, 320, 710, 390, 775],
    pages: [8, 9, 10, 12, 14, 16, 18, 19, 21, 22, 24, 26, 27, 29, 30, 31, 32, 34],
    totalPar: 64, totalFt: 10025,
  },
  // Wave 2 (spec addendum disc-golf-arcade-pro-tour-wave2.md).
  // Ivy Hill (Powerball Cup), MPO A layout (6A, 14A).
  "ivy-hill": {
    par: [4, 3, 4, 3, 4, 3, 3, 4, 4, 4, 3, 3, 4, 4, 5, 4, 3, 5],
    ft: [758, 327, 765, 392, 762, 517, 403, 671, 834, 908, 327, 491, 768, 840, 755, 998, 366, 1078],
    pages: [7, 8, 9, 10, 11, 13, 15, 16, 17, 18, 19, 20, 22, 23, 25, 26, 27, 29],
    totalPar: 67, totalFt: 11960,
  },
  // Northwood Black (Ledgestone Open), MPO pages only.
  "northwood-black": {
    par: [3, 4, 4, 4, 4, 5, 3, 3, 4, 3, 3, 5, 4, 5, 4, 3, 3, 4],
    ft: [455, 580, 604, 637, 451, 947, 325, 389, 732, 400, 380, 1050, 653, 893, 650, 330, 320, 703],
    pages: [7, 9, 11, 13, 14, 16, 17, 18, 20, 22, 24, 26, 28, 30, 32, 33, 34, 36],
    totalPar: 68, totalFt: 10499,
  },
  // Harvey Penick (Open at Austin), MPO.
  "harvey-penick": {
    par: [3, 4, 3, 3, 4, 4, 3, 4, 4, 3, 5, 3, 3, 4, 3, 3, 3, 4],
    ft: [410, 740, 360, 460, 650, 535, 305, 580, 755, 310, 1020, 375, 415, 560, 430, 340, 415, 685],
    pages: [12, 13, 14, 16, 18, 19, 20, 22, 24, 25, 27, 28, 30, 31, 33, 34, 36, 38],
    totalPar: 63, totalFt: 9345,
  },
  // Wave 3 (spec addendum disc-golf-arcade-pro-tour-wave3.md).
  // Brighton "Majestic" (US Women's DGC), FPO: the event's only layout.
  "brighton-majestic": {
    par: [4, 3, 3, 3, 4, 3, 5, 3, 4, 3, 3, 3, 4, 3, 3, 4, 3, 4],
    ft: [659, 344, 269, 269, 472, 282, 696, 256, 338, 341, 285, 384, 545, 292, 302, 640, 456, 545],
    pages: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
    totalPar: 62, totalFt: 7375,
  },
  // Black Locust South (Pro Worlds), MPO. The holes add up to 10,859 ft; the
  // card prints 10,860 (metric rounding).
  "black-locust-south": {
    par: [3, 4, 3, 3, 3, 5, 3, 3, 3, 4, 4, 4, 5, 3, 4, 3, 4, 4],
    ft: [463, 774, 400, 390, 427, 1007, 420, 387, 423, 866, 676, 722, 1165, 331, 610, 341, 673, 784],
    pages: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19],
    totalPar: 65, totalFt: 10859,
  },
};
const COURSES = [MAPLE_HILL, BREWSTER_RIDGE, IDLEWILD, WINTHROP_GOLD, KENSINGTON_TOBOGGAN, FOX_RUN_MEADOWS, IVY_HILL, NORTHWOOD_BLACK, HARVEY_PENICK, BRIGHTON_MAJESTIC, BLACK_LOCUST_SOUTH];
const PILOT_IDS = ["maple-hill", "brewster-ridge", "idlewild"];
const lineFt = (h: ProHole) => h.line.reduce((s, p, i) => (i ? s + Math.hypot(p.x - h.line[i - 1].x, p.y - h.line[i - 1].y) : 0), 0);

describe("2026 season list", () => {
  it("lists all 23 stops in schedule order with dates, tier, city, courses and an event link", () => {
    expect(SEASON_2026).toHaveLength(23);
    SEASON_2026.forEach((s, i) => {
      expect(s.stop).toBe(i + 1);
      expect(s.event.length).toBeGreaterThan(3);
      expect(s.dates).toMatch(/^[A-Z][a-z]{2} \d/);
      expect(s.city).toMatch(/, /);
      expect(["Elite", "Elite+", "Playoffs", "Major"]).toContain(s.tier);
      expect(s.pdgaEventUrl).toMatch(/^https:\/\/www\.(pdga|dgpt)\.com\/(tour\/)?event\//);
      expect(s.courses.length).toBeGreaterThan(0);
    });
    expect(SEASON_2026.filter((s) => s.tier === "Major")).toHaveLength(5);
  });

  it("marks exactly the built courses as built (Brighton is held: data kept, shown as later)", () => {
    expect([...BUILT_COURSE_IDS].sort()).toEqual(COURSES.map((c) => c.id).filter((id) => id !== "brighton-majestic").sort());
  });

  it("names the USDGC course Winthrop Gold (Henry's call; the book says 'Winthrop Arena')", () => {
    const usdgc = SEASON_2026.find((s) => s.stop === 22)!;
    expect(usdgc.courses).toEqual([{ id: "winthrop-gold", name: "Winthrop Gold", built: true }]);
  });

  it("never shows a sponsor prefix or a tour mark in an event name", () => {
    for (const s of SEASON_2026) expect(s.event).not.toMatch(/\b(DGPT|PDGA|x OTB|Discraft|Barbasol|Innova|GRIPeq|Play it Again)\b/);
  });
});

describe.each(COURSES.map((c) => [c.id, c] as const))("%s data matches its caddie book", (id, course) => {
  const card = CARDS[id];

  it("has 18 holes with the book's par and length, hole by hole and in total", () => {
    expect(course.holes).toHaveLength(18);
    expect(course.holes.map((h) => h.n)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
    expect(course.holes.map((h) => h.par)).toEqual(card.par);
    expect(course.holes.map((h) => h.lengthFt)).toEqual(card.ft);
    expect(course.holes.reduce((s, h) => s + h.par, 0)).toBe(card.totalPar);
    expect(course.holes.reduce((s, h) => s + h.lengthFt, 0)).toBe(card.totalFt);
  });

  it("keeps every centerline within ±5% of the book length (straight line never longer)", () => {
    for (const h of course.holes) {
      const len = lineFt(h);
      expect(Math.abs(len - h.lengthFt) / h.lengthFt, `hole ${h.n}`).toBeLessThanOrEqual(0.05);
      const b = h.line[h.line.length - 1];
      expect(Math.hypot(b.x, b.y), `hole ${h.n} straight line`).toBeLessThanOrEqual(h.lengthFt);
    }
  });

  it("cites the book page for every hole (where the scorecard maps pages) and keeps slopes in range", () => {
    if (card.pages) expect(course.holes.map((h) => h.ref.page)).toEqual(card.pages);
    for (const h of course.holes) {
      if (h.elev != null) expect(Math.abs(h.elev), `hole ${h.n}`).toBeLessThanOrEqual(2);
      if (h.elevZones) {
        let prev = 0;
        for (const z of h.elevZones) {
          expect(z.to, `hole ${h.n}`).toBeGreaterThan(prev);
          expect(Math.abs(z.elev), `hole ${h.n}`).toBeLessThanOrEqual(2);
          prev = z.to;
        }
        expect(prev, `hole ${h.n}`).toBe(1);
      }
    }
  });

  it("follows the format rules: 2–8 line points from the tee, coarse 10 ft units, short notes, a book page", () => {
    for (const h of course.holes) {
      expect(h.line.length, `hole ${h.n}`).toBeGreaterThanOrEqual(2);
      expect(h.line.length, `hole ${h.n}`).toBeLessThanOrEqual(8);
      expect(h.line[0]).toEqual({ x: 0, y: 0 });
      expect(h.widthFt).toBeGreaterThanOrEqual(150);
      expect(h.widthFt).toBeLessThanOrEqual(230);
      expect((h.water ?? []).length).toBeLessThanOrEqual(6);
      expect(h.note.length, `hole ${h.n} note`).toBeLessThanOrEqual(90);
      expect(h.ref.page, `hole ${h.n}`).toBeGreaterThan(0);
      expect(h.ref.url).toBe(course.book);
      const nums: number[] = [
        ...h.line.flatMap((p) => [p.x, p.y]),
        ...[...(h.water ?? []), ...(h.obZones ?? [])].flatMap((r) => [r.x, r.y, r.w, r.h]),
        ...(h.walls ?? []).flatMap((w) => [w.x, w.y, w.w]),
        ...[...(h.keyTrees ?? []), ...(h.balanceTrees ?? [])].flatMap((t) => [t.x, t.y, t.r]),
        ...(h.dropZone ? [h.dropZone.x, h.dropZone.y] : []),
      ];
      for (const v of nums) expect(Math.abs(v % 10), `hole ${h.n}: ${v} is not rounded to 10 ft`).toBe(0);
    }
  });

  it("keeps every feature inside the hole's world bounds", () => {
    for (const h of course.holes) {
      const b = proHoleBoundsFt(h);
      const inX = (x: number) => x >= b.x0 && x <= b.x1;
      const inY = (y: number) => y >= b.y0 && y <= b.y1;
      for (const r of [...(h.water ?? []), ...(h.obZones ?? [])]) {
        expect(inX(r.x) && inX(r.x + r.w) && inY(r.y) && inY(r.y + r.h), `hole ${h.n} rect ${JSON.stringify(r)}`).toBe(true);
      }
      for (const w of h.walls ?? []) expect(inX(w.x) && inX(w.x + w.w) && inY(w.y), `hole ${h.n} wall`).toBe(true);
      for (const p of [...(h.keyTrees ?? []), ...(h.balanceTrees ?? []), ...(h.dropZone ? [h.dropZone] : [])]) expect(inX(p.x) && inY(p.y), `hole ${h.n} point`).toBe(true);
      // …and once converted, everything sits inside worldW × worldH.
      const g = proHoleToHole(h);
      const inside = (x: number, y: number) => x >= 0 && x <= (g.worldW ?? W) && y >= 0 && y <= g.worldH;
      for (const p of [g.tee, g.basket, ...g.fairway, ...g.trees, ...(g.dropZone ? [g.dropZone] : [])]) expect(inside(p.x, p.y), `hole ${h.n}`).toBe(true);
      for (const r of [...g.water, ...(g.obZones ?? [])]) expect(inside(r.x, r.y) && inside(r.x + r.w, r.y + r.h), `hole ${h.n} world rect`).toBe(true);
    }
  });

  it("puts the drop zone in bounds and never in water or roped OB", () => {
    for (const h of course.holes) {
      if (!h.dropZone) continue;
      const g = proHoleToHole(h);
      const dz = g.dropZone!;
      for (const r of [...g.water, ...(g.obZones ?? [])]) expect(dz.x > r.x && dz.x < r.x + r.w && dz.y > r.y && dz.y < r.y + r.h, `hole ${h.n}`).toBe(false);
    }
  });
});

describe("Henry's Oct 16 rules for Pro Tour holes: tee-shot catch radius and drive-only drop zones", () => {
  const proHoles = PROTOUR_COURSES.flatMap((c) => c.holes.map((h, i) => ({ id: c.course.id, n: i + 1, h, ph: c.course.holes[i] })));
  const handAuthored: Hole[] = [
    ...buildRound(1, "course"), ...buildRound(1, "winthrop"), ...buildRound(1, "olympus"),
    ...TOUR_COURSES.flatMap((t) => buildRound(t.seed, "tour")),
  ];

  it("every one of the 198 Pro Tour holes carries the 0.85 tee catch, and no hand-authored hole does", () => {
    expect(proHoles).toHaveLength(198);
    expect(PROTOUR_TEE_CATCH_MUL).toBe(0.85);
    for (const { id, n, h } of proHoles) expect(h.teeCatchMul, `${id} ${n}`).toBe(0.85);
    for (const h of handAuthored) expect(h.teeCatchMul).toBeUndefined();
    for (const h of handAuthored) expect(h.dzDriveOnly).toBeUndefined();
  });

  it("tightens the catch only for a throw from the tee", () => {
    const h = proHoles[0].h;
    expect(isTeeLie(h, h.tee)).toBe(true);
    expect(catchRFor(h, h.tee, CATCH_R)).toBeCloseTo(CATCH_R * 0.85, 9);
    expect(catchRFor(h, { x: h.tee.x, y: h.tee.y - 40 }, CATCH_R)).toBe(CATCH_R);
    expect(catchRFor(handAuthored[0], handAuthored[0].tee, CATCH_R)).toBe(CATCH_R);
  });

  it("dzAll only where the book sends every OB to the DZ; every other Pro Tour DZ is drive-only", () => {
    expect(proHoles.filter((x) => x.ph.dzAll).map((x) => `${x.id} ${x.n}`)).toEqual([
      "winthrop-gold 6", "winthrop-gold 9", "winthrop-gold 10", "winthrop-gold 12",
      "ivy-hill 1", "ivy-hill 5", "ivy-hill 9", "ivy-hill 12", "ivy-hill 13",
      "northwood-black 8", "northwood-black 17",
      "harvey-penick 13",
      "brighton-majestic 6",
    ]);
    expect(proHoles.filter((x) => x.h.dzDriveOnly).map((x) => `${x.id} ${x.n}`)).toEqual([
      "maple-hill 1", "maple-hill 8", "maple-hill 14",
      "kensington-toboggan 8", "kensington-toboggan 9", "kensington-toboggan 16",
      "fox-run-meadows 1",
      "ivy-hill 4", "ivy-hill 6", "ivy-hill 7", "ivy-hill 14", "ivy-hill 17",
      "harvey-penick 2", "harvey-penick 5", "harvey-penick 9", "harvey-penick 10",
      "brighton-majestic 7", "brighton-majestic 14", "brighton-majestic 18",
      "black-locust-south 7", "black-locust-south 12",
    ]);
    for (const x of proHoles) if (x.h.dropZone) expect(!!x.h.dzDriveOnly, `${x.id} ${x.n}`).toBe(!x.ph.dzAll);
  });

  it("resolvePenalty: drive-only DZ for a tee OB, last in-bounds lie later; dzAll and hand-authored DZs take every OB", () => {
    const tb16 = proTourCourseById("kensington-toboggan")!.holes[15];
    const later = { x: tb16.tee.x, y: tb16.tee.y - 160 }; // a lie up the fairway
    const trail = [later, { x: later.x, y: later.y - 10 }];
    const off = { x: 1, y: later.y - 20 };
    const tee = resolvePenalty("oob", tb16, off, [tb16.tee], tb16.tee, isTeeLie(tb16, tb16.tee));
    expect(tee.lie).toEqual(tb16.dropZone);
    expect(tee.dz).toBe(true);
    const second = resolvePenalty("oob", tb16, off, trail, later, isTeeLie(tb16, later));
    expect(second.lie).not.toEqual(tb16.dropZone);
    expect(second.lie).toEqual({ x: trail[1].x, y: trail[1].y });
    expect(second.dz).toBeUndefined();
    const wg10 = proTourCourseById("winthrop-gold")!.holes[9];
    const wLater = { x: wg10.tee.x, y: wg10.tee.y - 50 };
    expect(resolvePenalty("oob", wg10, { x: 1, y: wLater.y }, [wLater], wLater, false).lie).toEqual(wg10.dropZone);
    expect(resolvePenalty("oob", wg10, { x: 1, y: wLater.y }, [wg10.tee], wg10.tee, true).lie).toEqual(wg10.dropZone);
    // a hand-authored drop zone still takes every OB (default fromTee = true, no flag)
    const hand = handAuthored.find((h) => h.dropZone)!;
    const hLater = { x: hand.tee.x, y: hand.tee.y - 30 };
    expect(resolvePenalty("oob", hand, { x: 1, y: hLater.y }, [hLater], hLater, false).lie).toEqual(hand.dropZone);
    expect(resolvePenalty("oob", hand, { x: 1, y: hLater.y }, [hLater], hLater).lie).toEqual(hand.dropZone);
  });

  it("stepFlight and throwDisc are byte-identical to improvements-round1 (sha256 of their source)", () => {
    const sha = (t: string) => createHash("sha256").update(t).digest("hex");
    const eng = readFileSync(new URL("../lib/discgolf/engine.ts", import.meta.url), "utf8");
    const i = eng.indexOf("\nfunction stepFlight(") + 1;
    const rest = eng.slice(i + 1);
    const m = /\n(function |const [A-Za-z_]+ = |export |\/\/ ═)/.exec(rest)!;
    expect(sha(eng.slice(i, i + 1 + m.index))).toBe("f30074039a30389662c66c4b0a28771a46e9aa4417a792ed8c9cbc594275b1c0");
    const game = readFileSync(new URL("../components/disc-golf-game.tsx", import.meta.url), "utf8");
    const a = game.indexOf("  const throwDisc = useCallback(");
    const b = game.indexOf("\n", game.indexOf("\n  }, [", a) + 1);
    expect(sha(game.slice(a, b))).toBe("c4684f7dd31faec63b61bbc41b7bfbe5c12fb6b0363a4fee4342235995beb868");
  });
});

describe("wave 2 course specifics", () => {
  it("Ivy Hill plays the A layouts on 6 and 14, with island greens on 6, 7, 14 and 17", () => {
    expect(IVY_HILL.holes.filter((h) => h.layout).map((h) => [h.n, h.layout])).toEqual([[6, "A"], [14, "A"]]);
    expect(IVY_HILL.holes.filter((h) => h.islandGreen).map((h) => h.n)).toEqual([6, 7, 14, 17]);
    expect(IVY_HILL.holes.every((h) => h.rough === "ob")).toBe(true);
  });

  it("Northwood Black plays the woods as hazard rough with OB only on the named side", () => {
    expect(NORTHWOOD_BLACK.holes.every((h) => h.rough === "hazard")).toBe(true);
    expect(NORTHWOOD_BLACK.holes.filter((h) => h.obZones?.length).map((h) => h.n)).toEqual([1, 7, 8, 10, 12, 14, 15, 17, 18]);
    for (const h of NORTHWOOD_BLACK.holes) expect(h.elev ?? 0).toBe(0);
  });

  it("Harvey Penick's slopes follow the book's profiles and its island green is 10", () => {
    const slope = (h: ProHole) => h.elev ?? h.elevZones?.at(-1)?.elev ?? 0;
    expect(HARVEY_PENICK.holes.map(slope)).toEqual([0, 0, 1, -2, 0, 0, 0, 0, 1, -1, -1, 0, 0, 0, 0, 0, 0, 0]);
    expect(HARVEY_PENICK.holes.filter((h) => h.islandGreen).map((h) => h.n)).toEqual([10]);
  });
});

describe("wave 3 course specifics", () => {
  const slope = (h: ProHole) => h.elev ?? h.elevZones?.at(-1)?.elev ?? 0;

  it("Brighton is the FPO mountain course: the book's elevation on every hole, strung lanes on 10, 12 and 18, the island on 14", () => {
    expect(BRIGHTON_MAJESTIC.layoutLabel).toBe("FPO");
    expect(BRIGHTON_MAJESTIC.holes.map(slope)).toEqual([-1, 0, 0, 0, 0, 0, 0, -1, 2, -2, 0, -1, -2, 0, -2, -1, -2, 0]);
    expect(BRIGHTON_MAJESTIC.holes.filter((h) => h.rough === "ob").map((h) => h.n)).toEqual([10, 12, 14, 18]);
    expect(BRIGHTON_MAJESTIC.holes.filter((h) => h.islandGreen).map((h) => h.n)).toEqual([14]);
    expect(BRIGHTON_MAJESTIC.holes.filter((h) => !h.obZones?.length && h.rough === "hazard").map((h) => h.n)).toEqual([5, 11, 13, 16]);
    expect(BRIGHTON_MAJESTIC.holes.filter((h) => h.mando).map((h) => h.n)).toEqual([7, 11, 13, 17, 18]);
    expect(BRIGHTON_MAJESTIC.holes[0].water ?? []).toEqual([]); // the creek on 1 is a relief area: hazard, not water
    expect(BRIGHTON_MAJESTIC.holes[0].hazard?.length).toBeGreaterThan(0);
  });

  it("Black Locust South: wooded tunnels 2–11, strung OB on 1, 13, 17, 18, the lake island on 15, flat throughout", () => {
    const bl = BLACK_LOCUST_SOUTH.holes;
    expect(bl.filter((h) => h.rough === "ob").map((h) => h.n)).toEqual([1, 7, 12, 13, 15, 17, 18]);
    expect(bl.filter((h) => h.n >= 2 && h.n <= 11).every((h) => h.trees === "wooded")).toBe(true);
    expect(bl.filter((h) => h.islandGreen).map((h) => h.n)).toEqual([7, 15]);
    expect(bl[14].water?.length).toBeGreaterThan(0);
    expect(bl.filter((h) => h.mando).map((h) => h.n)).toEqual([13, 16]);
    for (const h of bl) expect(slope(h)).toBe(0);
  });
});

describe("season stop cards", () => {
  const gmc = SEASON_2026.find((s) => s.stop === 20)!;
  const usdgc = SEASON_2026.find((s) => s.stop === 22)!;
  const seed = (id: string) => proTourCourseById(id)!.seed;

  it("a one-course stop shows its par and length and its own best", () => {
    expect(stopSummary(usdgc, {}).courseLabel).toBe("par 64 · 9,727 ft");
    const sum = stopSummary(usdgc, { [seed("winthrop-gold")]: 49 });
    expect(sum.best?.best).toBe(49);
    expect(sum.best?.stars).toBe(2);
    expect(sum.bestNamed).toBe(false);
  });

  it("a two-course stop says \"2 courses\" and shows a Fox Run best, not \"Not played\"", () => {
    expect(stopSummary(gmc, {}).courseLabel).toBe("2 courses");
    expect(stopSummary(gmc, {}).best).toBeNull();
    const fr = stopSummary(gmc, { [seed("fox-run-meadows")]: 47 });
    expect(fr.best?.course.course.id).toBe("fox-run-meadows");
    expect(fr.best?.best).toBe(47);
    expect(fr.bestNamed).toBe(true);
  });

  it("takes the course with the most stars, then the lower score vs par", () => {
    // Brewster 60 (−2, 1 star) vs Fox Run 54 (−10, 2 stars) → Fox Run
    expect(stopSummary(gmc, { [seed("brewster-ridge")]: 60, [seed("fox-run-meadows")]: 54 }).best?.course.course.id).toBe("fox-run-meadows");
    // both 2 stars: Brewster 50 (−12) beats Fox Run 54 (−10)
    expect(stopSummary(gmc, { [seed("brewster-ridge")]: 50, [seed("fox-run-meadows")]: 54 }).best?.course.course.id).toBe("brewster-ridge");
  });
});

describe("wave 1 course specifics", () => {
  it("Winthrop Gold plays the A pins where the book has two, with no drop zone on the island 17", () => {
    expect(WINTHROP_GOLD.holes.filter((h) => h.layout).map((h) => [h.n, h.layout])).toEqual([[3, "A"], [5, "A"], [13, "A"], [17, "A"]]);
    const h17 = WINTHROP_GOLD.holes[16];
    expect(h17.islandGreen).toBe(true);
    expect(h17.dropZone).toBeUndefined();
    // the book limits every OB throw to the DZ on these holes
    expect(WINTHROP_GOLD.holes.filter((h) => h.dropZone).map((h) => h.n)).toEqual([6, 9, 10, 12]);
    // flat park; hazard rough only on 16, where the yellow lines are the edge
    for (const h of WINTHROP_GOLD.holes) expect(h.elev ?? 0).toBe(0);
    expect(WINTHROP_GOLD.holes.filter((h) => h.rough === "hazard").map((h) => h.n)).toEqual([16]);
  });

  it("Fox Run Meadows: out 5,115 / in 4,910, island 1 with its DZ (the only one), the river on 7 and 12", () => {
    const ft = FOX_RUN_MEADOWS.holes.map((h) => h.lengthFt);
    expect(ft.slice(0, 9).reduce((a, b) => a + b, 0)).toBe(5115);
    expect(ft.slice(9).reduce((a, b) => a + b, 0)).toBe(4910);
    expect(FOX_RUN_MEADOWS.holes[0].islandGreen).toBe(true);
    expect(FOX_RUN_MEADOWS.holes.filter((h) => h.dropZone).map((h) => h.n)).toEqual([1]);
    expect(FOX_RUN_MEADOWS.holes[3].islands).toHaveLength(1); // 4's safe island landing zone
    for (const n of [7, 12, 16]) expect(FOX_RUN_MEADOWS.holes[n - 1].water?.length, `hole ${n}`).toBeGreaterThan(0);
    for (const h of FOX_RUN_MEADOWS.holes) expect(h.elev ?? 0).toBe(0);
  });

  it("Kensington Toboggan is the hill course: no water, slope on most holes, the book's DZs", () => {
    expect(KENSINGTON_TOBOGGAN.holes.every((h) => !h.water?.length)).toBe(true);
    const peak = (h: ProHole) => Math.max(Math.abs(h.elev ?? 0), ...(h.elevZones ?? []).map((z) => Math.abs(z.elev)));
    expect(KENSINGTON_TOBOGGAN.holes.filter((h) => peak(h) === 2).length).toBeGreaterThanOrEqual(12);
    expect(KENSINGTON_TOBOGGAN.holes.filter((h) => h.dropZone).map((h) => h.n)).toEqual([8, 9, 16]);
    expect(KENSINGTON_TOBOGGAN.holes[15].islandGreen).toBe(true);
    // 15 is OB right only: one-sided strips, the left plays as hazard
    const h15 = KENSINGTON_TOBOGGAN.holes[14];
    expect(h15.rough).toBe("hazard");
    expect((h15.obZones ?? []).every((r) => r.x > 0)).toBe(true);
    // 2, 5 and 12 have OB only long of the basket
    for (const n of [2, 5, 12]) {
      const h = KENSINGTON_TOBOGGAN.holes[n - 1];
      const b = h.line[h.line.length - 1];
      expect(h.rough, `hole ${n}`).toBe("hazard");
      expect((h.obZones ?? []).every((r) => r.y > b.y), `hole ${n}`).toBe(true);
    }
    expect(KENSINGTON_TOBOGGAN.holes.reduce((s, h) => s + h.lengthFt, 0)).toBeGreaterThan(Math.max(...[MAPLE_HILL, BREWSTER_RIDGE, IDLEWILD, WINTHROP_GOLD].map((c) => c.holes.reduce((s, h) => s + h.lengthFt, 0))));
  });
});

describe("proHoleToHole (feet → world)", () => {
  const sample: ProHole = {
    n: 1, par: 4, lengthFt: 500,
    line: [{ x: 0, y: 0 }, { x: -90, y: 120 }, { x: 0, y: 300 }, { x: 180, y: 360 }],
    widthFt: 180, rough: "ob",
    water: [{ x: -40, y: 200, w: 60, h: 40 }],
    obZones: [{ x: 60, y: 300, w: 40, h: 30 }],
    islands: [[{ x: 170, y: 350 }, { x: 190, y: 370 }]],
    hazard: [{ x: 50, y: 100, d: 30 }],
    dropZone: { x: 30, y: 280 },
    walls: [{ x: -100, y: 150, w: 50 }],
    keyTrees: [{ x: 20, y: 150, r: 20 }],
    trees: "wooded",
    elevZones: [{ to: 0.5, elev: -1 }, { to: 1, elev: 2 }],
    note: "test", ref: { url: "x", page: 1 },
  };
  const g = proHoleToHole(sample);

  it("scales x and y by the same feet-per-px factor (no vertical-only stretch)", () => {
    const a = g.fairway[0], b = g.fairway[1], c = g.fairway[3];
    expect((b.x - a.x) * FT).toBeCloseTo(-90, 6);
    expect((a.y - b.y) * FT).toBeCloseTo(120, 6);
    expect((c.x - a.x) * FT).toBeCloseTo(180, 6);
    expect((a.y - c.y) * FT).toBeCloseTo(360, 6);
    // a doglegged centerline keeps its true length
    expect(pathLengthPx(g.fairway) * FT).toBeCloseTo(lineFt(sample), 6);
  });

  it("puts the tee TEE_BEHIND above the bottom and the world at least a viewport wide", () => {
    expect(g.tee.y).toBeCloseTo(g.worldH - TEE_BEHIND, 6);
    expect(g.worldW).toBeGreaterThanOrEqual(W);
    expect(g.basket).toEqual(g.fairway[g.fairway.length - 1]);
  });

  it("carries islands, drop zone, walls, slope zones, rough and book length across", () => {
    expect(g.fairways).toHaveLength(1);
    expect((g.fairways![0][1].x - g.fairways![0][0].x) * FT).toBeCloseTo(20, 6);
    expect(g.dropZone).toBeDefined();
    expect((g.dropZone!.x - g.tee.x) * FT).toBeCloseTo(30, 6);
    expect((g.tee.y - g.dropZone!.y) * FT).toBeCloseTo(280, 6);
    expect(g.elevZones).toEqual(sample.elevZones);
    expect(g.walls![0].w * FT).toBeCloseTo(50, 6);
    expect(g.fwWidth * FT).toBeCloseTo(180, 6);
    expect(g.roughIsHazard).toBeUndefined();
    expect(proHoleToHole({ ...sample, rough: "hazard" }).roughIsHazard).toBe(true);
    expect(g.treeMul).toBe(1.5);
    expect(g.bookFt).toBe(500);
    // a water rect keeps its size and its far edge maps to the smaller world y
    expect(g.water[0].w * FT).toBeCloseTo(60, 6);
    expect((g.tee.y - g.water[0].y) * FT).toBeCloseTo(240, 6);
    // the round bunker stays round
    expect(g.hazard![0].w).toBeCloseTo(g.hazard![0].h, 6);
  });

  it("keeps the key tree among the trees and fills the rest", () => {
    expect(g.trees.some((t) => Math.abs((t.x - g.tee.x) * FT - 20) < 1e-6 && Math.abs((g.tee.y - t.y) * FT - 150) < 1e-6)).toBe(true);
    expect(g.trees.length).toBeGreaterThan(1);
  });

  it("never shows a tee-to-pin distance longer than the book length", () => {
    for (const c of COURSES) {
      for (const h of c.holes) {
        const hh = proHoleToHole(h);
        expect(Math.round(distBetween(hh.tee, hh.basket) * FT), `${c.id} ${h.n}`).toBeLessThanOrEqual(h.lengthFt);
      }
    }
  });
});

describe("pro tour courses plug into the tour seed space", () => {
  it("keeps the pilot courses on their original seeds (saved bests are keyed by seed)", () => {
    expect(PROTOUR_COURSES.slice(0, 3).map((c) => [c.course.id, c.seed])).toEqual([
      ["maple-hill", 0x2026c001],
      ["brewster-ridge", 0x2026c002],
      ["idlewild", 0x2026c003],
    ]);
    // Winthrop Gold kept its slot when it was renamed from Winthrop Arena, so its
    // seed (and any best saved under it) didn't move.
    expect(proTourCourseById("winthrop-gold")!.seed).toBe(0x2026c004);
    // every course in schedule-of-building order, appended: waves 1, 2, then 3
    expect(PROTOUR_COURSES.map((c) => [c.course.id, c.seed])).toEqual([
      ["maple-hill", 0x2026c001], ["brewster-ridge", 0x2026c002], ["idlewild", 0x2026c003],
      ["winthrop-gold", 0x2026c004], ["kensington-toboggan", 0x2026c005], ["fox-run-meadows", 0x2026c006],
      ["ivy-hill", 0x2026c007], ["northwood-black", 0x2026c008], ["harvey-penick", 0x2026c009],
      ["brighton-majestic", 0x2026c00a], ["black-locust-south", 0x2026c00b],
    ]);
    expect(PROTOUR_COURSES.slice(0, 3).map((c) => c.course.id)).toEqual(PILOT_IDS);
    // new courses are appended after the pilot, each on the next seed
    PROTOUR_COURSES.forEach((c, i) => expect(c.seed).toBe((0x2026c000 + i + 1) >>> 0));
  });

  it("each built course has a reserved seed that resolves to its 18 real holes", () => {
    expect(PROTOUR_COURSES.map((c) => c.course.id).sort()).toEqual(COURSES.map((c) => c.id).sort());
    for (const c of PROTOUR_COURSES) {
      expect(isProTourSeed(c.seed)).toBe(true);
      expect(tourVenue(c.seed)).toBe(c.course.name);
      const holes = courseHoles("tour", c.seed);
      expect(holes).toHaveLength(18);
      expect(holes.map((h) => h.par)).toEqual(CARDS[c.course.id].par);
      expect(c.par).toBe(CARDS[c.course.id].totalPar);
      expect(c.lengthFt).toBe(CARDS[c.course.id].totalFt);
      expect(proTourCourseById(c.course.id)).toBe(c);
    }
  });

  it("is deterministic and leaves the procedural tour venues alone", () => {
    const c = PROTOUR_COURSES[0];
    expect(generateTourCourse(c.seed)).toEqual(generateTourCourse(c.seed));
    for (const t of TOUR_COURSES) expect(isProTourSeed(t.seed)).toBe(false);
  });
});

// ── Playability: a headless bot plays every hole with the real flight physics
// (stepFlight + resolvePenalty, wind included) and must hole out. It searches a
// small fan of aims, powers and discs each throw and keeps the one that leaves
// the least distance along the hole, so a hole fails only if no line through it
// exists (a blocked gate, an uncarryable pond, a drop zone in the water…).
const discs: Disc[] = ADV_DISCS;
const reach = (d: Disc) => fullPowerRange(d, 0, STRAIGHT_SPEED_MUL, 0);
const DRIVER = discs.reduce((a, b) => (reach(b) > reach(a) ? b : a));
const PUTTER = discs.reduce((a, b) => (reach(b) < reach(a) ? b : a));
const MID = [...discs].sort((a, b) => reach(a) - reach(b))[Math.floor(discs.length / 2)];

function remainingAlong(hole: Hole, p: Vec): number {
  const pts = hole.fairway;
  let best = Infinity, bestRem = 0, acc = 0;
  const segs: number[] = [];
  for (let i = 0; i < pts.length - 1; i++) segs.push(Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y));
  const total = segs.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
    const d = Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
    if (d < best) { best = d; bestRem = total - acc - t * segs[i]; }
    acc += segs[i];
  }
  return Math.min(bestRem + best * 0.5, distBetween(p, hole.basket) * 1.3);
}

function sim(hole: Hole, lie: Vec, disc: Disc, angle: number, power: number) {
  const speed = disc.power * (1.2 + power * 3.35) * STRAIGHT_SPEED_MUL;
  const f: Flight = { x: lie.x, y: lie.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, h: 0, vh: power * disc.arc, fadeTurn: 0 };
  const ghostTrees = treesAtLie(hole, lie.x, lie.y);
  const trail: Vec[] = [{ x: f.x, y: f.y }];
  for (let i = 0; i < 1200; i++) {
    const r = stepFlight(f, disc, -1, "straight", hole, "flat", { ghostTrees, catchR: catchRFor(hole, lie, CATCH_R) });
    trail.push({ x: f.x, y: f.y });
    if (r.status !== "fly") {
      const pen = resolvePenalty(r.status, hole, { x: f.x, y: f.y }, trail, lie, isTeeLie(hole, lie));
      return { status: r.status, lie: pen.lie ?? { x: f.x, y: f.y }, strokes: 1 + pen.strokes };
    }
  }
  return { status: "stop" as const, lie: { x: f.x, y: f.y }, strokes: 1 };
}

function botPlay(hole: Hole, maxThrows: number, weak = false): { strokes: number; holed: boolean; penalties: number } {
  let lie = { ...hole.tee }, strokes = 0, penalties = 0;
  while (strokes < maxThrows) {
    const toPin = distBetween(lie, hole.basket);
    const putting = toPin < reach(PUTTER) * (weak ? 0.45 : 0.9);
    const base = Math.atan2(hole.basket.y - lie.y, hole.basket.x - lie.x);
    // aim points: the basket, and points further along the centerline
    const aims: number[] = [base];
    if (!putting) {
      for (const frac of [0.25, 0.4, 0.55, 0.7, 0.85]) {
        const total = hole.fairway.length;
        const p = hole.fairway[Math.min(total - 1, Math.max(1, Math.round(frac * (total - 1))))];
        aims.push(Math.atan2(p.y - lie.y, p.x - lie.x));
      }
    }
    let bestScore = Infinity;
    let best: ReturnType<typeof sim> | null = null;
    for (const a0 of aims) {
      for (const da of putting ? [-0.12, -0.06, -0.03, 0, 0.03, 0.06, 0.12] : [-0.3, -0.15, -0.05, 0, 0.05, 0.15, 0.3]) {
        for (const disc of putting ? [PUTTER, MID] : weak ? [MID] : [DRIVER, MID]) {
          for (const pw of putting ? [0.2, 0.3, 0.4, 0.5, 0.6, 0.75, 0.9, 1] : weak ? [0.3, 0.4, 0.5, 0.6] : [0.45, 0.6, 0.75, 0.9, 1]) {
            const r = sim(hole, lie, disc, a0 + da, pw);
            // The weak bot can't hole out from range: a throw-in only counts once putting.
            const holed = r.status === "hole" && (putting || !weak);
            const score = holed ? -1e9 + r.strokes : (r.strokes - 1) * 600 + (r.status === "hole" ? 0 : remainingAlong(hole, r.lie));
            if (score < bestScore) { bestScore = score; best = r; }
          }
        }
      }
    }
    strokes += best!.strokes;
    penalties += best!.strokes - 1;
    if (best!.status === "hole") return { strokes, holed: true, penalties };
    lie = best!.lie;
  }
  return { strokes, holed: false, penalties };
}

// Forced carries a weak arm can't make, exactly as on the real course:
// Idlewild 4's 240 ft tee pond has no drop zone (re-tee), and Maple Hill 1's
// pond fills the corridor, so a miss re-throws the ~180 ft carry from the DZ.
// Winthrop Gold 9 flies an OB field to a shelf green; the book's walk-around
// to the right exists (the bot below holes out), but this greedy weak bot only
// measures progress along the centerline, so it never takes the detour.
// Fox Run 12's tee shot must carry ~310 ft of OB to the dirt road; the book names
// no drop zone that takes every OB throw there, so a miss re-tees (as on ID4).
// Maple Hill 8's DZ is for tee shots only (book p5): a weak bot that lays up off
// the tee and then splashes plays again from the pond's edge, 290 ft of carry.
// Harvey Penick 13: the OB creek splits the fairway and its DZ (the FPO tee) is
// still a ~200 ft carry, so a weak arm can't get over it, as on the real course.
const FORCED_CARRY: Record<string, number[]> = { "maple-hill": [1, 8], idlewild: [4], "winthrop-gold": [9], "fox-run-meadows": [12], "harvey-penick": [13] };

describe.each(PROTOUR_COURSES.map((c) => [c.course.id, c] as const))("%s is playable end to end", (_id, c) => {
  it("a bot holes out on all 18 holes (real physics and wind)", () => {
    const holes = generateTourCourse(c.seed);
    const results = holes.map((h, i) => ({ n: i + 1, par: h.par, ...botPlay(h, h.par + 10) }));
    const stuck = results.filter((r) => !r.holed);
    expect(stuck, `stuck on: ${stuck.map((r) => r.n).join(", ")}`).toEqual([]);
  }, 120_000);

  it("a weak-armed bot (midrange at ≤60% power, no throw-ins) also finishes every hole", () => {
    const holes = generateTourCourse(c.seed);
    const results = holes.map((h, i) => ({ n: i + 1, par: h.par, ...botPlay(h, h.par + 12, true) }));
    const stuck = results.filter((r) => !r.holed).map((r) => r.n);
    for (const n of stuck) expect(FORCED_CARRY[c.course.id] ?? [], `stuck on hole ${n}`).toContain(n);
  }, 120_000);
});
