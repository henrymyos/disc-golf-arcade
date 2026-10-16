"use client";

import { useEffect, useState } from "react";
import { claimSupportNudge, setSupportPromptsOff, supportPromptsOff, supportUrl } from "@/lib/support";

// Small text link under the main-menu utilities. Never above Play.
export function SupportLink() {
  const url = supportUrl();
  if (!url) return null;
  return (
    <div className="w-full text-center mt-4" data-testid="support-link">
      <a href={url} target="_blank" rel="noopener" className="text-[#36D7B7] text-sm font-semibold hover:underline">
        Support the Arcade
      </a>
      <p className="text-gray-500 text-[11px] mt-0.5">Free and ad-free. Tips keep it running.</p>
    </div>
  );
}

// One-line, dismissible thank-you on a finished 18-hole round summary, at most
// once a week per device (lib/support.ts). Mount it only while eligible.
export function SupportNudge() {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads + stamps localStorage once per summary
    if (claimSupportNudge(Date.now())) setUrl(supportUrl());
  }, []);
  if (!url) return null;
  return (
    <div className="flex items-center justify-between gap-2 bg-[#1a1d23] border border-white/10 rounded-lg px-3 py-2 text-xs" data-testid="support-nudge">
      <span className="text-gray-300">
        Enjoying the Arcade?{" "}
        <a href={url} target="_blank" rel="noopener" className="text-[#36D7B7] font-semibold hover:underline">Leave a tip</a>
        {" "}to keep it free.
      </span>
      <button type="button" onClick={() => setUrl(null)} aria-label="Dismiss" className="text-gray-500 hover:text-white px-1">✕</button>
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
