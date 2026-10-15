"use client";

import { useState } from "react";
import { DiscMark } from "./ui";

export function AuthPanel(props: {
  onClose: () => void;
  user: { email: string } | null;
  recovering: boolean;
  email: string; setEmail: (v: string) => void;
  password: string; setPassword: (v: string) => void;
  busy: boolean; error: string | null; message: string | null;
  clearFeedback: () => void;
  onSignIn: () => void; onSignUp: () => void; onSignOut: () => void;
  onResetPassword: () => void; onUpdatePassword: () => void;
}) {
  const { onClose, user, recovering, email, setEmail, password, setPassword, busy, error, message, clearFeedback, onSignIn, onSignUp, onSignOut, onResetPassword, onUpdatePassword } = props;
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [showPw, setShowPw] = useState(false);
  const switchTo = (m: "login" | "signup") => { if (m !== mode) { setMode(m); clearFeedback(); } };
  const seg = (active: boolean) =>
    `flex-1 rounded-md py-1.5 text-sm font-bold transition ${active ? "bg-[#36D7B7] text-[#0f1117] shadow" : "text-gray-400 hover:text-white"}`;
  const input = "w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#36D7B7] transition";
  return (
    <div className="absolute inset-0 z-30 overflow-y-auto bg-[#0f1117]/95 backdrop-blur-sm px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)] flex items-start justify-center rounded-lg">
      <div className="w-full max-w-xs my-auto">
        <div className="flex justify-end">
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none -mt-1">×</button>
        </div>

        {recovering ? (
          <div className="space-y-4">
            <div className="flex flex-col items-center text-center gap-1.5">
              <DiscMark />
              <h2 className="text-white font-black text-xl">Set a new password</h2>
              <p className="text-gray-500 text-xs px-2">Choose a new password for your account.</p>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); if (!busy && password) onUpdatePassword(); }} className="space-y-3">
              <div className="relative">
                <input type={showPw ? "text" : "password"} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password (min 6 characters)" className={`${input} pr-14`} />
                <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-[11px] font-bold px-1">{showPw ? "HIDE" : "SHOW"}</button>
              </div>
              {error && <p className="text-red-400 text-xs">{error}</p>}
              {message && <p className="text-[#36D7B7] text-xs">{message}</p>}
              <button type="submit" disabled={busy || !password} className="w-full bg-[#36D7B7] hover:bg-[#2ec2a6] active:scale-[0.99] text-[#0f1117] font-bold py-2.5 rounded-lg transition disabled:opacity-50">
                {busy ? "…" : "Update password"}
              </button>
            </form>
          </div>
        ) : user ? (
          <div className="space-y-4 text-center">
            <div className="flex flex-col items-center gap-2">
              <DiscMark />
              <h2 className="text-white font-black text-xl">Account</h2>
            </div>
            <div className="bg-[#1a1d23] border border-white/10 rounded-xl px-3 py-3">
              <p className="text-gray-500 text-[11px] uppercase tracking-wide font-semibold">Signed in as</p>
              <p className="text-white font-semibold break-all text-sm mt-0.5">{user.email}</p>
            </div>
            <p className="text-[#36D7B7] text-xs font-semibold">✓ Best scores, coins &amp; achievements sync across devices.</p>
            {/* e.g. a dead email link landed here while already signed in */}
            {error && <p className="text-red-400 text-xs">{error}</p>}
            {message && <p className="text-[#36D7B7] text-xs">{message}</p>}
            <button type="button" onClick={onSignOut} className="w-full bg-[#1a1d23] border border-white/15 hover:border-white/35 text-white font-bold py-2.5 rounded-lg transition">Log out</button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col items-center text-center gap-1.5">
              <DiscMark />
              <h2 className="text-white font-black text-xl">{mode === "login" ? "Welcome back" : "Create your account"}</h2>
              <p className="text-gray-500 text-xs px-2">
                {mode === "login" ? "Log in to pick up your progress on any device." : "Sign up to save your progress to the cloud."}
              </p>
            </div>

            {/* Separate Log in / Sign up modes */}
            <div className="flex gap-1 bg-[#1a1d23] border border-white/10 rounded-lg p-1">
              <button type="button" onClick={() => switchTo("login")} className={seg(mode === "login")}>Log in</button>
              <button type="button" onClick={() => switchTo("signup")} className={seg(mode === "signup")}>Sign up</button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); if (!busy && email && password) (mode === "login" ? onSignIn() : onSignUp()); }} className="space-y-3">
              <input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className={input} />
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "login" ? "Password" : "Password (min 6 characters)"}
                  className={`${input} pr-14`}
                />
                <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-[11px] font-bold px-1">
                  {showPw ? "HIDE" : "SHOW"}
                </button>
              </div>

              {error && <p className="text-red-400 text-xs">{error}</p>}
              {message && <p className="text-[#36D7B7] text-xs">{message}</p>}

              <button type="submit" disabled={busy || !email || !password} className="w-full bg-[#36D7B7] hover:bg-[#2ec2a6] active:scale-[0.99] text-[#0f1117] font-bold py-2.5 rounded-lg transition disabled:opacity-50">
                {busy ? "…" : mode === "login" ? "Log in" : "Create account"}
              </button>
            </form>

            {mode === "login" && (
              <button type="button" onClick={onResetPassword} disabled={busy} className="w-full text-center text-gray-500 hover:text-gray-300 text-[11px] transition disabled:opacity-50">
                Forgot password?
              </button>
            )}

            <p className="text-center text-gray-500 text-xs">
              {mode === "login" ? (
                <>New here? <button type="button" onClick={() => switchTo("signup")} className="text-[#36D7B7] font-semibold hover:brightness-110">Create an account</button></>
              ) : (
                <>Already have an account? <button type="button" onClick={() => switchTo("login")} className="text-[#36D7B7] font-semibold hover:brightness-110">Log in</button></>
              )}
            </p>
            <p className="text-gray-600 text-[11px] text-center">Your scores also save on this device without an account.</p>
          </div>
        )}
      </div>
    </div>
  );
}
