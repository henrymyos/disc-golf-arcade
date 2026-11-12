"use client";

import { useEffect, useState } from "react";
import { claimSupportNudge, setSupportPromptsOff, supportPromptsOff, supportUrl } from "@/lib/support";
import { SUPPORTERS } from "@/lib/supporters";

// Small text link under the main-menu utilities. Never above Play.
export function SupportLink() {
  const url = supportUrl();
  if (!url) return null;
  return (
    <div className="w-full text-center mt-4" data-testid="support-link">
      <a href={url} target="_blank" rel="noopener" className="text-[#36D7B7] text-sm font-semibold hover:underline">
        Support the Arcade
      </a>
      <p className="text-gray-500 text-[11px] mt-0.5">Free, no ads, no paywalls. Tips help pay for new courses.</p>
    </div>
  );
}

// One-line, dismissible thank-you on a finished Daily or 18-hole round summary, at most
// once a week per device (lib/support.ts). Mount it only while eligible.
export function SupportNudge() {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads + stamps localStorage once per summary
    if (claimSupportNudge(Date.now())) setUrl(supportUrl());
  }, []);
  if (!url) return null;
  return <SupportNudgeBar url={url} onDismiss={() => setUrl(null)} />;
}

// The nudge's markup, split out so tests can render it without running the effect.
export function SupportNudgeBar({ url, onDismiss }: { url: string; onDismiss: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 bg-[#1a1d23] border border-white/10 rounded-lg pl-3 pr-0 py-0.5 text-xs" data-testid="support-nudge">
      <span className="text-gray-300">
        Enjoying the Arcade? A tip on Ko-fi helps pay for new courses.{" "}
        <a href={url} target="_blank" rel="noopener" className="text-[#36D7B7] font-semibold hover:underline">Tip on Ko-fi</a>
      </span>
      <button type="button" onClick={onDismiss} aria-label="Dismiss" className="shrink-0 min-w-11 min-h-11 flex items-center justify-center text-gray-500 hover:text-white">✕</button>
    </div>
  );
}

// Settings › Support: the tip link, plus the hand-kept supporters list when it isn't empty.
export function SupportSettingsRow({ supporters = SUPPORTERS }: { supporters?: string[] }) {
  const url = supportUrl();
  if (!url) return null;
  return (
    <div className="bg-[#1a1d23] border border-white/10 rounded-lg px-3 py-0.5" data-testid="support-settings">
      {/* The whole row is the link: a 44 px tap target (WCAG 2.5.5). */}
      <a href={url} target="_blank" rel="noopener" className="group flex items-center justify-between min-h-11">
        <span className="text-white text-sm font-semibold">Support</span>
        <span className="text-[#36D7B7] text-xs font-bold group-hover:underline">Support the Arcade</span>
      </a>
      {supporters.length > 0 && (
        <p className="text-gray-400 text-[11px] pb-2" data-testid="supporters">Thanks to our supporters: {supporters.join(", ")}</p>
      )}
    </div>
  );
}

// Settings › Hide support prompts. Hidden entirely when no support URL is set.
export function SupportPromptsToggle() {
  const [off, setOff] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from localStorage after mount
    setOff(supportPromptsOff());
  }, []);
  if (!supportUrl()) return null;
  return (
    <button
      type="button"
      onClick={() => { setSupportPromptsOff(!off); setOff(!off); }}
      className="w-full flex items-center justify-between bg-[#1a1d23] border border-white/10 rounded-lg px-3 py-2.5"
    >
      <span className="text-white text-sm font-semibold">Hide support prompts</span>
      <span className={`text-xs font-bold px-2 py-0.5 rounded ${off ? "bg-[#36D7B7] text-[#0f1117]" : "bg-white/10 text-gray-400"}`}>
        {off ? "ON" : "OFF"}
      </span>
    </button>
  );
}
