// Gamepad play: turn a pad (standard mapping) into the keys the keyboard handler
// already understands. D-pad / left stick = arrows (aim + power), A = Space
// (throw, fast-forward, next hole), B = Escape (cancel the aim).
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
