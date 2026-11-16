"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";

// Replaces Next's bare "Application error" if the game throws.
// retry() re-renders the page without a full reload.
export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
      <p className="text-5xl" aria-hidden>🌳</p>
      <h1 className="mt-4 text-2xl font-black text-white">Hit a tree</h1>
      <p className="mt-2 text-sm text-white/60">Something went wrong. Try again, or reload the page if it keeps happening.</p>
      <button
        type="button"
        onClick={() => retry()}
        className="mt-6 rounded-lg bg-[#36D7B7] px-5 py-2 text-sm font-bold text-[#0f1117] transition hover:bg-[#2ec2a6]"
      >
        Try again
      </button>
    </main>
  );
}
