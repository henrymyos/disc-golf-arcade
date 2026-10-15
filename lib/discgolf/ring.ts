// Power-ring colour while dragging a throw: teal → yellow → orange as the pull
// grows. Red is never used here; it's the game's cancel signal.
export function powerRingColor(power: number): string {
  return power < 0.5 ? "#36D7B7" : power < 0.85 ? "#f5d24a" : "#e08a3b";
}
