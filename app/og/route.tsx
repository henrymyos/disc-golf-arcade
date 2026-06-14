import { ImageResponse } from "next/og";
import { parseChallenge } from "@/lib/discgolf/challenge";

// Dynamic Open Graph image for shared challenge links (and a default card).
// 1200×630 is the standard OG/Twitter large-image size.
export const dynamic = "force-dynamic";

const BG = "#0f1117";
const TEAL = "#36D7B7";
const GOLD = "#f5d24a";
const MUTED = "#9aa4b2";

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: "1200px",
        height: "630px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: `linear-gradient(135deg, #1c2233 0%, ${BG} 70%)`,
        padding: "72px 80px",
        fontFamily: "monospace",
      }}
    >
      {children}
    </div>
  );
}

export function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const c = parseChallenge(searchParams.get("ch"));

  const header = (
    <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
      <div style={{ width: "44px", height: "26px", borderRadius: "13px", background: TEAL }} />
      <div style={{ display: "flex", fontSize: "40px", fontWeight: 800, color: "#fff", letterSpacing: "-1px" }}>
        Disc Golf <span style={{ color: TEAL, marginLeft: "12px" }}>Arcade</span>
      </div>
    </div>
  );

  if (!c) {
    return new ImageResponse(
      (
        <Frame>
          {header}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", fontSize: "72px", fontWeight: 800, color: "#fff" }}>Pixel disc golf</div>
            <div style={{ display: "flex", fontSize: "32px", color: MUTED }}>
              18 holes · a daily challenge · real discs · leaderboards
            </div>
          </div>
          <div style={{ display: "flex", fontSize: "26px", color: MUTED }}>disc-golf-arcade.vercel.app</div>
        </Frame>
      ),
      { width: 1200, height: 630 },
    );
  }

  const overColor = c.over <= 0 ? TEAL : "#e08a3b";
  return new ImageResponse(
    (
      <Frame>
        {header}
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <div style={{ display: "flex", fontSize: "34px", color: GOLD, fontWeight: 700 }}>
            ⚔ {c.name} challenged you
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: "28px" }}>
            <div style={{ display: "flex", fontSize: "150px", fontWeight: 800, color: "#fff", lineHeight: 1 }}>{c.score}</div>
            <div style={{ display: "flex", fontSize: "56px", fontWeight: 800, color: overColor, paddingBottom: "20px" }}>
              {c.over === 0 ? "Even par" : c.overStr}
            </div>
          </div>
          <div style={{ display: "flex", fontSize: "34px", color: MUTED }}>
            on {c.courseLabel} · par {c.par}
          </div>
        </div>
        <div style={{ display: "flex", fontSize: "30px", color: "#fff", fontWeight: 700 }}>
          Tee off and beat it →
        </div>
      </Frame>
    ),
    { width: 1200, height: 630 },
  );
}
