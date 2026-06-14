import type { Metadata } from "next";
import { parseChallenge } from "@/lib/discgolf/challenge";
import { DiscGolfGame } from "@/components/disc-golf-game";

// When opened via a challenge link (?ch=…), give it a rich preview so the
// shared link unfurls as "<friend> challenged you" with a generated OG image.
export async function generateMetadata({ searchParams }: { searchParams: Promise<{ ch?: string | string[] }> }): Promise<Metadata> {
  const sp = await searchParams;
  const raw = typeof sp.ch === "string" ? sp.ch : Array.isArray(sp.ch) ? sp.ch[0] : undefined;
  const c = parseChallenge(raw);
  if (!c) return {};
  const title = `${c.name} challenged you on Disc Golf Arcade`;
  const description = `${c.name} shot ${c.score} (${c.overStr}) on ${c.courseLabel}. Tee off and beat it!`;
  const image = `/og?ch=${encodeURIComponent(raw!)}`;
  return {
    title,
    description,
    openGraph: { title, description, type: "website", images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default function Home() {
  return <DiscGolfGame />;
}
