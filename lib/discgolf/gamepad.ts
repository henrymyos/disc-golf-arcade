// Gamepad play: turn a pad (standard mapping) into the keys the keyboard handler
// already understands. D-pad / left stick = arrows (aim + power), A = Space
// (throw, fast-forward, next hole), B = Escape (cancel the aim), X / Y = b / f
// (backhand / forehand), LB / RB = [ / ] (previous / next disc in the bag),
// Start = p (open / close the in-round menu).
export const PAD_REPEAT_DELAY = 300; // ms before a held direction repeats (like OS key repeat)
export const PAD_REPEAT_EVERY = 60;
const STICK_DEAD = 0.5;

type Pad = { buttons: readonly { pressed: boolean }[]; axes: readonly number[] };

export function padKeys(p: Pad): Set<string> {
  const b = (i: number) => !!p.buttons[i]?.pressed;
  const x = p.axes[0] ?? 0, y = p.axes[1] ?? 0;
  const keys = new Set<string>();
  if (b(14) || x < -STICK_DEAD) keys.add("ArrowLeft");
  if (b(15) || x > STICK_DEAD) keys.add("ArrowRight");
  if (b(12) || y < -STICK_DEAD) keys.add("ArrowUp");
  if (b(13) || y > STICK_DEAD) keys.add("ArrowDown");
  if (b(0)) keys.add(" ");
  if (b(1)) keys.add("Escape");
  if (b(2)) keys.add("b");
  if (b(3)) keys.add("f");
  if (b(4)) keys.add("[");
  if (b(5)) keys.add("]");
  if (b(9)) keys.add("p");
  return keys;
}

// Keys to fire this frame: new presses fire at once; held arrows repeat after a delay,
// buttons don't. `held` (key -> next repeat time) is updated in place.
export function padPresses(keys: Set<string>, held: Map<string, number>, now: number): string[] {
  for (const k of held.keys()) if (!keys.has(k)) held.delete(k);
  const out: string[] = [];
  for (const k of keys) {
    const next = held.get(k);
    if (next === undefined) {
      out.push(k);
      held.set(k, now + PAD_REPEAT_DELAY);
    } else if (k.startsWith("Arrow") && now >= next) {
      out.push(k);
      held.set(k, now + PAD_REPEAT_EVERY);
    }
  }
  return out;
}

// [ / ]: the bag slot before / after the current disc, wrapping (first slot if the disc isn't bagged).
export function cycleBag(bag: readonly string[], current: string | undefined, key: string): string | null {
  if (!bag.length || (key !== "[" && key !== "]")) return null;
  const i = current === undefined ? -1 : bag.indexOf(current);
  if (i < 0) return bag[0];
  return bag[(i + (key === "]" ? 1 : -1) + bag.length) % bag.length];
}

// Menu navigation (title hub, panels, results): arrows / the pad move focus to the
// nearest button in that direction; off-axis distance counts double so a 2-column
// grid steps straight down before it slides across. -1: nothing that way.
type Box = { left: number; top: number; width: number; height: number };
export function spatialNext(boxes: readonly Box[], from: number, key: string): number {
  const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[key];
  if (!dir) return -1;
  const c = (b: Box) => [b.left + b.width / 2, b.top + b.height / 2];
  const [fx, fy] = c(boxes[from]);
  let best = -1, bestScore = Infinity;
  boxes.forEach((b, i) => {
    if (i === from) return;
    const [x, y] = c(b);
    const along = (x - fx) * dir[0] + (y - fy) * dir[1];
    if (along <= 1) return;
    const score = along + 2 * Math.abs(dir[0] ? y - fy : x - fx);
    if (score < bestScore) { bestScore = score; best = i; }
  });
  return best;
}

// The menu layer on top: the last-drawn open overlay with buttons in it (panels are
// "absolute inset-0 z-*" boxes, dialogs have role=dialog), else the whole page.
export const MENU_FOCUSABLE = 'button:not([disabled]), a[href], [role="button"], input[type="checkbox"]';
export function menuLayer(doc: Document): HTMLElement {
  const z = (el: Element) => parseInt(getComputedStyle(el).zIndex) || 0;
  const layers = [...doc.querySelectorAll<HTMLElement>('[role="dialog"], [class*="absolute inset-0 z-"]')]
    .filter((el) => el.getClientRects().length && el.querySelector(MENU_FOCUSABLE));
  return layers.sort((a, b) => z(a) - z(b)).at(-1) ?? doc.body; // stable sort: DOM order breaks ties
}
