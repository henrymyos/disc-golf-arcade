// In-round page layout. The board keeps its 320:448 shape; the question is
// whether a three-column desktop layout (scorecard | board | controls) gives a
// bigger board than the single column (board over a bottom control bar). Three
// columns are used only when they do, so the board is never narrower than the
// single-column layout at the same viewport.
export const BOARD_ASPECT = 320 / 448;
export const CONTROL_BAR_H = 178; // the bottom control bar's height in the single column (px)
const PAD = 16;                   // the board's padding in the three-column layout (8px each side)

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export type RoundLayout = { sides: boolean; left: number; right: number; singleBoardW: number; sidesBoardW: number };

export function roundLayout(vw: number, vh: number): RoundLayout {
  const singleBoardW = Math.max(0, Math.min(vw, (vh - CONTROL_BAR_H) * BOARD_ASPECT));
  const left = Math.round(clamp(vw * 0.2, 180, 300));   // scorecard column
  const right = Math.round(clamp(vw * 0.24, 250, 330)); // controls column
  const sidesBoardW = Math.max(0, Math.min(vw - left - right - PAD, (vh - PAD) * BOARD_ASPECT));
  return { sides: vw >= 1024 && sidesBoardW >= singleBoardW, left, right, singleBoardW, sidesBoardW };
}
