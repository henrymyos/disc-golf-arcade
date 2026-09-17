import { describe, it, expect } from "vitest";
import { buildRacerGhosts, ghostPosAt, CATCH_R, PUTT_RANGE, type Hole } from "../lib/discgolf/engine";

// A straight, open hole: tee at the bottom, basket 420px up. Progress along the
// fairway is just "how much smaller y got", which makes the realism rules easy
// to check: every throw must move the rival closer to the basket.
const straight: Hole = {
  par: 4, worldH: 640, worldW: 320, tee: { x: 160, y: 560 }, basket: { x: 160, y: 140 },
  fairway: [{ x: 160, y: 560 }, { x: 160, y: 140 }], fwWidth: 120, trees: [], water: [], hazard: [], elev: 0,
} as unknown as Hole;

function landings(shots: number, seed: number) {
  const gh = buildRacerGhosts(seed, 3, straight, [{ name: "R", color: "#fff", shots }], 0).ghosts[0];
  return gh.segs.map((sg) => ({ y: sg.to.y, x: sg.to.x, walk: sg.lift === 0 && sg.pause < 1000 }));
}

describe("rival ghosts progress toward the basket", () => {
  const distToBasket = (p: { x: number; y: number }) => Math.hypot(p.x - straight.basket.x, p.y - straight.basket.y);
  it("every throw finishes closer to the basket than it started, for any score", () => {
    for (let seed = 1; seed <= 60; seed++) {
      for (let shots = 1; shots <= 10; shots++) {
        const pts = landings(shots, seed);
        let d = distToBasket(straight.tee);
        pts.forEach((p, i) => {
          // An OB throw (the one followed by the walk back) is the one allowed
          // mistake: the disc sails off the corridor, then it's carried back.
          if (p.walk || pts[i + 1]?.walk) { d = distToBasket(p); return; }
          expect(distToBasket(p), `shots=${shots} seed=${seed}`).toBeLessThanOrEqual(d + 0.001);
          d = distToBasket(p);
        });
        expect(pts[pts.length - 1]).toMatchObject({ x: straight.basket.x, y: straight.basket.y });
      }
    }
  });
  it("shows at most one visible throw per stroke, and fewer when an OB penalty was paid", () => {
    for (let seed = 1; seed <= 40; seed++) {
      for (let shots = 2; shots <= 9; shots++) {
        const pts = landings(shots, seed);
        const throws = pts.filter((p) => !p.walk).length;
        expect(throws).toBeLessThanOrEqual(shots);
        expect(throws).toBeGreaterThanOrEqual(Math.ceil(shots / 2));
      }
    }
  });
  it("keeps every lie near the hole — trouble is off the corridor, not across the map", () => {
    for (let seed = 1; seed <= 40; seed++) {
      for (const p of landings(8, seed)) expect(Math.abs(p.x - 160)).toBeLessThanOrEqual(straight.fwWidth * 1.1);
    }
  });
  it("an ace is one throw into the basket; an eagle on a long hole is a full drive then a hole-out", () => {
    expect(landings(1, 5)).toHaveLength(1);
    const two = landings(2, 5);
    expect(two).toHaveLength(2);
    expect(straight.tee.y - two[0].y).toBeGreaterThan(250); // a full-power drive, not a lay-up
  });
  it("throws full power whenever the basket is out of reach", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const first = landings(4, seed)[0];
      if (first.walk) continue;
      const carried = straight.tee.y - first.y;
      // clean/long drive ≈ 0.9–1.08 of full power; a squib is the only shorter first throw and ends at the tree line
      const squib = Math.abs(first.x - 160) > straight.fwWidth * 0.25;
      if (!squib) expect(carried).toBeGreaterThan(250);
    }
  });
  it("walks back from an OB throw before playing on, and still holes out", () => {
    let sawWalk = false;
    for (let seed = 1; seed <= 40 && !sawWalk; seed++) sawWalk = landings(9, seed).some((p) => p.walk);
    expect(sawWalk).toBe(true);
    const gh = buildRacerGhosts(3, 0, straight, [{ name: "R", color: "#fff", shots: 9 }], 0).ghosts[0];
    expect(ghostPosAt(gh, 1e9).holed).toBe(true);
  });
});

describe("rival putting scales with skill", () => {
  // shots = 6 on this par 4: a blow-up hole with strokes to lose somewhere.
  const SHOTS = 6;
  function greenStats(skill: number, seeds = 1500) {
    let missed = 0, threePutt = 0, firstMissRun = 0, runs = 0;
    for (let seed = 1; seed <= seeds; seed++) {
      const gh = buildRacerGhosts(seed, 1, straight, [{ name: "R", color: "#fff", shots: SHOTS, skill }], 0).ghosts[0];
      const pts = gh.segs.map((sg) => sg.to);
      const first = pts.findIndex((p) => Math.hypot(p.x - straight.basket.x, p.y - straight.basket.y) <= PUTT_RANGE);
      const lies = first >= 0 ? pts.slice(first, -1) : []; // lies inside putting range before the hole-out
      if (lies.length >= 2) { missed++; firstMissRun += Math.hypot(lies[1].x - straight.basket.x, lies[1].y - straight.basket.y); runs++; }
      if (lies.length >= 3) threePutt++;
    }
    return { miss: missed / seeds, three: threePutt / seeds, run: runs ? firstMissRun / runs : 0 };
  }
  it("a miss only runs a tap-in past the basket, closer for better players", () => {
    const weak = greenStats(0), elite = greenStats(1);
    expect(weak.run).toBeLessThanOrEqual(CATCH_R + 10);   // a few feet past the cage
    expect(elite.run).toBeLessThanOrEqual(CATCH_R + 7);   // barely out
    expect(elite.run).toBeLessThan(weak.run);
  });
  it("on a blow-up hole a weak rival loses strokes on the green, an elite one on the fairway", () => {
    const weak = greenStats(0), elite = greenStats(1);
    expect(weak.miss).toBeLessThan(0.6);
    expect(elite.miss).toBeLessThan(weak.miss * 0.6);
    expect(weak.three).toBeLessThan(0.08);
    expect(elite.three).toBeLessThan(0.02);
    // given a miss, the comeback putt drops the vast majority of the time
    expect(weak.three / Math.max(weak.miss, 1e-9)).toBeLessThan(0.15);
  });
});

describe("a putt is any throw from inside putting range", () => {
  it("putting range is the auto-caddie's putter switch point (~117 ft)", () => {
    expect(PUTT_RANGE).toBeGreaterThan(50);
    expect(PUTT_RANGE).toBeLessThan(90);
  });
  it("once a throw lands inside putting range, the rival is putting until it drops", () => {
    for (let seed = 1; seed <= 60; seed++) {
      for (const shots of [3, 5, 8]) {
        const pts = landings(shots, seed).filter((p) => !p.walk);
        const d = pts.map((p) => Math.hypot(p.x - 160, p.y - 140));
        const firstInside = d.findIndex((x) => x <= PUTT_RANGE);
        expect(firstInside, `shots=${shots} seed=${seed}`).toBeGreaterThan(0); // the tee is outside range
        for (let i = firstInside; i < d.length; i++) expect(d[i]).toBeLessThanOrEqual(PUTT_RANGE);
      }
    }
  });
  it("a drive can land inside putting range when the hole is short enough", () => {
    // 330px hole: a full-power drive (~300px) parks inside the 65px range.
    const short: Hole = { ...straight, tee: { x: 160, y: 470 }, fairway: [{ x: 160, y: 470 }, { x: 160, y: 140 }] } as unknown as Hole;
    let inside = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const gh = buildRacerGhosts(seed, 0, short, [{ name: "R", color: "#fff", shots: 3, skill: 0.7 }], 0).ghosts[0];
      const first = gh.segs[0].to;
      if (Math.hypot(first.x - 160, first.y - 140) <= PUTT_RANGE) inside++;
    }
    expect(inside).toBeGreaterThan(20);
  });
  it("on a hole shorter than putting range every throw is a putt", () => {
    const tiny: Hole = { ...straight, tee: { x: 160, y: 190 }, fairway: [{ x: 160, y: 190 }, { x: 160, y: 140 }] } as unknown as Hole;
    const gh = buildRacerGhosts(4, 0, tiny, [{ name: "R", color: "#fff", shots: 3, skill: 0.5 }], 0).ghosts[0];
    expect(gh.segs).toHaveLength(3); // putt, miss, tap-in — no walks, no fairway throws
    let d = Infinity;
    for (const sg of gh.segs) { const x = Math.hypot(sg.to.x - 160, sg.to.y - 140); expect(x).toBeLessThanOrEqual(d); d = x; }
    expect(d).toBe(0);
  });
});

describe("rivals respect the course's hazards", () => {
  it("a throw that comes down in the water is OB: penalty, then a walk back", () => {
    // A pond across the middle of the straight hole, the width of the fairway.
    const pond: Hole = { ...straight, water: [{ x: 90, y: 300, w: 140, h: 70 }] } as unknown as Hole;
    let splashes = 0;
    for (let seed = 1; seed <= 80; seed++) {
      for (const shots of [4, 5, 6]) {
        const gh = buildRacerGhosts(seed, 0, pond, [{ name: "R", color: "#fff", shots, skill: 0.5 }], 0).ghosts[0];
        const pts = gh.segs.map((sg) => ({ ...sg.to, walk: sg.lift === 0 && sg.pause < 1000 }));
        pts.forEach((p, i) => {
          const wet = p.x > 90 && p.x < 230 && p.y > 300 && p.y < 370;
          if (!wet || p.walk) return;
          splashes++;
          expect(pts[i + 1]?.walk, `seed=${seed} shots=${shots}`).toBe(true); // never plays on from the pond
        });
      }
    }
    expect(splashes).toBeGreaterThan(0);
  });
});

describe("rivals feel the slope and the wind like the player does", () => {
  // First-throw stats over many seeds on the straight par 4 (throwing toward −y).
  // `shots` is a score the hole naturally gives up in those conditions — forcing a
  // big number onto an easy hole makes the fit-to-card fill it with mishaps.
  function firstDrive(hole: Hole, skill = 0.6, shots = 4, seeds = 300) {
    const carries: number[] = [];
    let x = 0, n = 0;
    for (let seed = 1; seed <= seeds; seed++) {
      const gh = buildRacerGhosts(seed, 0, hole, [{ name: "R", color: "#fff", shots, skill }], 0).ghosts[0];
      const first = gh.segs[0], second = gh.segs[1];
      const ob = second && second.lift === 0 && second.pause < 1000;
      const squib = hole.tee.y - first.to.y < 200; // a kicked/squibbed drive (the p85 carry ignores the rest)
      if (ob || squib) continue; // skip the mishaps
      carries.push(hole.tee.y - first.to.y); x += first.to.x - 160; n++;
    }
    carries.sort((a, b) => a - b);
    // A clean full-power drive: the upper end of what the rival carried off the
    // tee (the fit-to-card adds squibs on easy holes, which drag a mean down).
    return { carry: carries[Math.floor(carries.length * 0.85)], x: x / n, n };
  }
  const flat = firstDrive(straight);
  it("uphill into a headwind a full-power drive comes up shorter; downhill downwind it goes longer", () => {
    const hard = firstDrive({ ...straight, elev: 1.5, wind: { x: 0, y: 0.014 }, windMag: 0.014 } as unknown as Hole, 0.6, 5);
    const easy = firstDrive({ ...straight, elev: -1.5, wind: { x: 0, y: -0.014 }, windMag: 0.014 } as unknown as Hole, 0.6, 3);
    expect(hard.carry).toBeLessThan(flat.carry * 0.93);
    expect(easy.carry).toBeGreaterThan(flat.carry * 1.05);
  });
  it("a crosswind pushes drives downwind, and a better player holds the line better", () => {
    const blowRight = { ...straight, wind: { x: 0.016, y: 0 }, windMag: 0.016 } as unknown as Hole;
    const weak = firstDrive(blowRight, 0.1), elite = firstDrive(blowRight, 1);
    expect(Math.abs(flat.x)).toBeLessThan(6);       // no wind: scatter averages out
    expect(weak.x).toBeGreaterThan(8);              // shoved right
    expect(elite.x).toBeLessThan(weak.x * 0.7);     // allows for it
    expect(elite.x).toBeGreaterThan(0);
  });
  it("still holes out in the right number of strokes whatever the conditions", () => {
    const gale = { ...straight, elev: 2, wind: { x: 0.012, y: 0.012 }, windMag: 0.017 } as unknown as Hole;
    for (let seed = 1; seed <= 40; seed++) {
      for (const shots of [3, 4, 6]) {
        const gh = buildRacerGhosts(seed, 0, gale, [{ name: "R", color: "#fff", shots, skill: 0.5 }], 0).ghosts[0];
        const last = gh.segs[gh.segs.length - 1].to;
        expect(last).toMatchObject({ x: gale.basket.x, y: gale.basket.y });
        expect(gh.segs.filter((sg) => !(sg.lift === 0 && sg.pause < 1000)).length).toBeLessThanOrEqual(shots);
      }
    }
  });
});
