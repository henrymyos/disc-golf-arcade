// Keyboard aiming: arrow keys nudge the throw like a drag would.
// Left/Right turn the aim, Up/Down change power. Hold a key to repeat (OS key repeat).
export const KEY_AIM_TURN = Math.PI / 90; // 2° per press
export const KEY_AIM_POWER = 0.05;
export const KEY_AIM_START_POWER = 0.5;

export function keyAim(angle: number, power: number, key: string): { angle: number; power: number } | null {
  switch (key) {
    case "ArrowLeft": return { angle: angle - KEY_AIM_TURN, power };
    case "ArrowRight": return { angle: angle + KEY_AIM_TURN, power };
    case "ArrowUp": return { angle, power: Math.min(1, power + KEY_AIM_POWER) };
    case "ArrowDown": return { angle, power: Math.max(0, power - KEY_AIM_POWER) };
    default: return null;
  }
}

// The pull-back vector (opposite the throw) that the aim renderer draws for an angle + power.
export function pullFor(angle: number, power: number, maxDrag: number): { x: number; y: number } {
  return { x: -Math.cos(angle) * power * maxDrag, y: -Math.sin(angle) * power * maxDrag };
}
