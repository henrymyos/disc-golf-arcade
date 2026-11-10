// The game's fixed-timestep scheduler, pulled out of the render loop so it can
// be tested. The sim always advances in identical 60 Hz steps; fast-forward
// only runs MORE of those steps per frame, so a sped-up flight lands exactly
// where a normal-speed one would (same step, same order, same result).
export const STEP_MS = 1000 / 60;
export const FAST_FORWARD = 4; // sim steps per real step while fast-forwarding

// Run one animation frame's worth of sim steps. `dt` is the real time since the
// last frame; `acc` the leftover from earlier frames (returned updated). While
// `fast()` is true each real step runs FAST_FORWARD sim steps instead of one.
export function simFrame(acc: number, dt: number, step: () => void, fast: () => boolean): number {
  acc += Math.min(STEP_MS * 4, dt); // never try to catch up more than 4 steps
  let steps = 0;
  while (acc >= STEP_MS && steps < 4) {
    step();
    for (let k = 1; k < FAST_FORWARD && fast(); k++) step();
    acc -= STEP_MS;
    steps++;
  }
  return acc;
}
