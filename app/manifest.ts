import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Disc Golf Arcade",
    short_name: "Disc Golf",
    description: "A retro pixel-art disc golf game — 18 holes, a daily challenge, real discs, and a leaderboard.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0f1117",
    theme_color: "#0f1117",
    icons: [
      // Real PNGs install cleanly across browsers; the maskable one keeps the
      // disc inside the safe zone so Android's circle/squircle mask doesn't clip
      // it. (iOS uses the apple-touch-icon from app/apple-icon.png.)
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
