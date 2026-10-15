"use client";

import { useState } from "react";

// Asked the first time a guest finishes a round or minigame that has a
// leaderboard: post under a name of their choosing, or Skip (nothing is posted,
// and the choice is remembered). Signed-in players are never asked.
export function BoardNamePrompt({ initialName, error, canSignIn, onPost, onSkip, onSignIn }: {
  initialName: string;
  error: string | null;
  canSignIn: boolean;
  onPost: (name: string) => void;
  onSkip: () => void;
  onSignIn: () => void;
}) {
  const [name, setName] = useState(initialName);
  const clean = name.trim();
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0f1117]/85 backdrop-blur-sm px-5">
      <form
        className="w-full max-w-[300px] rounded-2xl border border-white/10 bg-[#1a1d23] p-4 space-y-3"
        onSubmit={(e) => { e.preventDefault(); if (clean) onPost(clean); }}
      >
        <div>
          <h2 className="text-white font-black text-lg leading-tight">Post to the leaderboard?</h2>
          <p className="text-gray-400 text-xs mt-1 leading-snug">
            Pick the name your scores show under. Skip keeps your scores on this device only. We&apos;ll remember your choice.
          </p>
        </div>
        <input
          autoFocus
          value={name}
          maxLength={16}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          aria-label="Leaderboard name"
          className="w-full rounded-lg bg-[#0f1117] border border-white/15 focus:border-[#36D7B7] outline-none px-3 py-2.5 text-white text-sm"
        />
        {error && <p className="text-[#e08a3b] text-xs font-semibold">{error}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={onSkip} className="flex-1 rounded-lg border border-white/15 hover:border-white/35 text-gray-200 text-sm font-semibold py-2.5 transition">
            Skip
          </button>
          <button type="submit" disabled={!clean} className="flex-1 rounded-lg bg-[#36D7B7] hover:bg-[#2ec2a6] disabled:opacity-40 text-[#0f1117] text-sm font-bold py-2.5 transition">
            Post
          </button>
        </div>
        {canSignIn && (
          <button type="button" onClick={onSignIn} className="w-full text-[#36D7B7] text-xs font-semibold hover:underline">
            Or sign in to keep your name across devices
          </button>
        )}
      </form>
    </div>
  );
}
