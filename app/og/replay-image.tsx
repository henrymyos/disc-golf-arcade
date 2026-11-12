import { ImageResponse } from "next/og";
import type { Replay } from "@/lib/discgolf/replay";
import { replayCard, mapHoleIndex, replayHoleSvg, svgDataUri, resultColor } from "@/lib/discgolf/replayCard";

const BG = "#0f1117";
const TEAL = "#36D7B7";
const GOLD = "#f5d24a";
const MUTED = "#9aa4b2";

function Logo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
      <div style={{ width: "34px", height: "20px", borderRadius: "10px", background: TEAL }} />
      <div style={{ display: "flex", fontSize: "30px", fontWeight: 800, color: "#fff", letterSpacing: "-1px" }}>
        Disc Golf <span style={{ color: TEAL, marginLeft: "10px" }}>Arcade</span>
      </div>
    </div>
  );
}

// The card a shared replay unfurls as: what happened (headline + score), where
// (course, Pro Tour stop), the hole-by-hole card, and the best hole's flights.
export function replayImage(r: Replay) {
  const card = replayCard(r);
  const mi = mapHoleIndex(r, card);
  const svg = mi == null ? null : replayHoleSvg(r, mi);
  const mapHole = mi == null ? null : card.holes[mi];
  const d = card.total - card.par;
  const scoreColor = d < 0 ? TEAL : d === 0 ? "#fff" : "#e08a3b";
  const hiColor = card.highlight ? (card.highlight.diff <= -2 || card.highlight.score === 1 ? GOLD : TEAL) : "#fff";
  const n = card.holes.length;
  const cell = Math.min(36, Math.floor((svg ? 700 : 1040) / n) - 4);
  const kicker = ["Replay", card.stop].filter(Boolean).join(" · ");

  return new ImageResponse(
    (
      <div style={{ width: "1200px", height: "630px", display: "flex", background: `linear-gradient(135deg, #1c2233 0%, ${BG} 70%)`, padding: "56px 64px", fontFamily: "monospace", gap: "48px" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1, minWidth: 0 }}>
          <Logo />
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", fontSize: "24px", color: TEAL, fontWeight: 700, textTransform: "uppercase", letterSpacing: "3px" }}>{kicker}</div>
            <div style={{ display: "flex", fontSize: "68px", fontWeight: 800, color: hiColor, lineHeight: 1.05 }}>{card.headline}</div>
            <div style={{ display: "flex", fontSize: "32px", color: "#fff", fontWeight: 700 }}>{card.name} at {card.course}</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: "20px", marginTop: "6px" }}>
              <div style={{ display: "flex", fontSize: "96px", fontWeight: 800, color: "#fff", lineHeight: 1 }}>{card.total}</div>
              <div style={{ display: "flex", fontSize: "48px", fontWeight: 800, color: scoreColor, paddingBottom: "8px" }}>{card.toPar}</div>
              <div style={{ display: "flex", fontSize: "26px", color: MUTED, paddingBottom: "14px" }}>par {card.par} · {n} holes</div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "10px" }}>
              {card.holes.map((h) => (
                <div key={h.hole} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: `${cell}px`, height: `${cell}px`, borderRadius: "6px", background: resultColor(h), color: h.diff === 0 ? "#cfd6e0" : "#0f1117", fontSize: `${Math.round(cell * 0.5)}px`, fontWeight: 800 }}>{h.score}</div>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "22px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "14px", background: TEAL, color: BG, fontSize: "28px", fontWeight: 800, padding: "14px 28px", borderRadius: "14px" }}>
              <svg width="20" height="22" viewBox="0 0 20 22"><path d="M0 0 L20 11 L0 22 Z" fill={BG} /></svg>
              Watch the replay
            </div>
            <div style={{ display: "flex", fontSize: "24px", color: MUTED }}>{card.play ? "then play this course" : "discgolfarcade.com"}</div>
          </div>
        </div>
        {svg && mapHole && (
          <div style={{ display: "flex", flexDirection: "column", width: "330px", height: "518px", borderRadius: "18px", overflow: "hidden", border: "2px solid rgba(255,255,255,0.14)", background: "#14251a" }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- Satori renders plain <img> only */}
            <img src={svgDataUri(svg)} width={330} height={470} alt="" style={{ width: "330px", height: "470px" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: "48px", padding: "0 16px", background: "#13161b", fontSize: "20px", color: "#fff", fontWeight: 700 }}>
              <span>Hole {mapHole.hole} · par {mapHole.par}</span>
              <span style={{ color: resultColor(mapHole) === "#3a4150" ? MUTED : resultColor(mapHole) }}>{mapHole.label}</span>
            </div>
          </div>
        )}
      </div>
    ),
    { width: 1200, height: 630, headers: { "cache-control": "public, max-age=86400, s-maxage=31536000, immutable" } },
  );
}
