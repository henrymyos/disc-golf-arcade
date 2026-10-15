"use client";

import { useEffect, useRef, useState } from "react";
import { TRAILS } from "@/lib/discgolf/trails";
import {
  DISC_SKINS, BASKET_SKINS, AIM_STYLES, CELEBRATIONS, COSMETIC_PREFIX, cosmeticOwnKey,
} from "@/lib/discgolf/cosmetics";
import { CATCH_R, discByKey } from "@/lib/discgolf/engine";
import {
  skillMods, seasonSchedule, placeLabel, STAGE_LABEL, SKILL_KEYS, SKILL_LABEL, eventEnergyCost, canEnterEvent, availableSponsors, sponsorBrandLock, trainingPointCost, trainBonusFor, fmtCash, SPONSOR_CAP, SPONSOR_SLOTS, SPONSOR_SLOT_LABEL, careerRating, careerCoins as coinsForFinish, careerDiscShop, CAREER_BAG_MAX, CAREER_CORE_DISCS, DEFAULT_CAREER_LOOK, type CareerLook, careerYear, type Career, type CareerEvent, type EventResult, type CareerSkills,
} from "@/lib/discgolf/career";
import { btn, Coin } from "./ui";


// ── Career mode panel: the multi-decade journey from junior events to the pro
// tour. Skills grow each season (you allocate training); events can be PLAYED as
// real rounds — your skills bend the flight — or SIMULATED from your skills. ──
export function CareerStat({ label, v }: { label: string; v: number | string }) {
  return (
    <div className="bg-[#1a1d23] border border-white/5 rounded-lg py-2">
      <p className="text-white font-black text-lg leading-none">{v}</p>
      <p className="text-gray-500 text-[10px] mt-0.5 uppercase tracking-wide">{label}</p>
    </div>
  );
}
// Career cosmetics catalog — same items as the account shop, priced in career
// CASH (a post-max money sink). Color is pre-resolved per item for the swatch.
export type CareerStyleItem = { key: string; name: string; price: number; color: string };
export const CAREER_COSMETIC_CASH = 12; // coin sticker price → career cash price
// Disc class from its power tier (for the details modal).
export const discTypeLabel = (power: number): string => (power < 0.9 ? "Putter" : power < 1.1 ? "Midrange" : power < 1.3 ? "Fairway driver" : "Distance driver");
export const CAREER_STYLE_CATS: { slot: keyof CareerLook; prefix: string; label: string; items: CareerStyleItem[] }[] = [
  { slot: "discSkin", prefix: COSMETIC_PREFIX.discSkin, label: "Disc", items: DISC_SKINS.map((i) => ({ key: i.key, name: i.name, price: i.price, color: i.body })) },
  { slot: "basketSkin", prefix: COSMETIC_PREFIX.basket, label: "Basket", items: BASKET_SKINS.map((i) => ({ key: i.key, name: i.name, price: i.price, color: i.band })) },
  { slot: "aimStyle", prefix: COSMETIC_PREFIX.aim, label: "Aim line", items: AIM_STYLES.map((i) => ({ key: i.key, name: i.name, price: i.price, color: i.color })) },
  { slot: "celebration", prefix: COSMETIC_PREFIX.celebration, label: "Win pop", items: CELEBRATIONS.map((i) => ({ key: i.key, name: i.name, price: i.price, color: i.colors[0] ?? "#888" })) },
  { slot: "trail", prefix: "trail", label: "Trail", items: TRAILS.filter((i) => i.key !== "none").map((i) => ({ key: i.key, name: i.name, price: i.price, color: i.colors[0] ?? "#888" })) },
];
// The career save-slot picker: up to CAREER_SLOTS independent careers. Pick a slot
// to open it (an empty slot starts a new career there), delete one to free its slot,
// or go back to Single Player.
export function CareerSlots({ careers, onPick, onDelete, onBack }: {
  careers: (Career | null)[];
  onPick: (slot: number) => void;
  onDelete: (slot: number) => void;
  onBack: () => void;
}) {
  const [confirmDel, setConfirmDel] = useState<number | null>(null);
  const wrap = "absolute inset-0 z-30 overflow-y-auto bg-[#0f1117]/95 backdrop-blur-sm px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)] flex items-start justify-center rounded-lg";
  return (
    <div className={wrap}><div className="w-full max-w-sm space-y-3 my-auto text-left">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-black text-xl">Career</h2>
        <button type="button" onClick={onBack} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
      </div>
      <p className="text-gray-400 text-sm">Pick a save slot. Each career is its own journey — keep up to {careers.length} going at once and switch between them anytime.</p>
      {careers.map((c, slot) => (
        <div key={slot} className={`bg-[#1a1d23] hover:bg-[#252932] active:bg-[#2d323c] rounded-xl p-3 transition-colors ${c ? "border-2 border-[#36D7B7]/60 hover:border-[#36D7B7]" : "border border-dashed border-white/10 hover:border-white/25"}`}>
          {c ? (
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => onPick(slot)} className="flex-1 min-w-0 text-left">
                <p className="text-white font-bold truncate">{c.name}{c.retired ? <span className="text-gray-500 font-normal"> · Retired</span> : null}</p>
                <p className="text-gray-400 text-[11px]">{STAGE_LABEL[c.stage]} · Age {c.age} · Overall {Math.round(careerRating(c.skills))}{c.stage === "pro" && c.worldRank ? ` · World #${c.worldRank}` : ` · PDGA ${c.pdgaRating}`}</p>
              </button>
              {confirmDel === slot ? (
                <span className="shrink-0 text-[11px] text-gray-400">Delete? <button type="button" onClick={() => { onDelete(slot); setConfirmDel(null); }} className="text-[#e2453b] font-bold">Yes</button> · <button type="button" onClick={() => setConfirmDel(null)} className="text-gray-300">No</button></span>
              ) : (
                <button type="button" onClick={() => setConfirmDel(slot)} title="Delete this career" className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md border border-[#e2453b]/60 bg-[#e2453b]/15 hover:bg-[#e2453b]/30 text-sm leading-none transition-colors">🗑</button>
              )}
            </div>
          ) : (
            <button type="button" onClick={() => onPick(slot)} className="w-full text-left flex items-center gap-2 text-gray-400 hover:text-white transition">
              <span className="text-xl leading-none text-[#36D7B7]">＋</span>
              <span className="text-sm font-semibold">Empty slot — start a career</span>
            </button>
          )}
        </div>
      ))}
      <button type="button" onClick={onBack} className="w-full text-gray-500 hover:text-gray-300 text-xs py-1.5 transition">‹ Back to Single Player</button>
    </div></div>
  );
}
export function CareerPanel({ career, lastResult, lastCoins, notes, onClose, onStart, onPlay, onSim, onAllocateSkill, onAdvance, onRetire, onAbandon, onSign, onUnsign, onBuyTrain, onBuyDisc, onToggleBag, onBuyCosmetic, onEquipLook, dismissNotes }: {
  career: Career | null;
  lastResult: EventResult | null;
  lastCoins: number;
  notes: string[];
  onClose: () => void;
  onStart: (name: string) => void;
  onPlay: (ev: CareerEvent) => void;
  onSim: (ev: CareerEvent) => void;
  onAllocateSkill: (skill: keyof CareerSkills, delta: number) => void;
  onAdvance: () => void;
  onRetire: () => void;
  onAbandon: () => void;
  onSign: (id: string) => void;
  onUnsign: (id: string) => void;
  onBuyTrain: () => void;
  onBuyDisc: (key: string) => void;
  onToggleBag: (key: string) => void;
  onBuyCosmetic: (ownKey: string, cost: number) => void;
  onEquipLook: (slot: keyof CareerLook, key: string) => void;
  dismissNotes: () => void;
}) {
  const [name, setName] = useState("");
  // Training is applied immediately now (each +/- spends a point on the spot). We
  // remember the skills at the start of this view so the − button can only undo
  // points you've added this session, not re-spec ones earned in past seasons.
  const [sessionBase, setSessionBase] = useState<CareerSkills>(() => career?.skills ?? { power: 0, control: 0, putt: 0, stamina: 0 });
  const [confirm, setConfirm] = useState<"retire" | "abandon" | null>(null);
  const [dropId, setDropId] = useState<string | null>(null); // sponsor pending a drop confirmation
  const [tab, setTab] = useState<"skills" | "bag" | "schedule" | "sponsors">("skills"); // career hub tab
  const scrollRef = useRef<HTMLDivElement>(null); // the tab panel's scroll region
  // Each tab shares one scroll container, so switching would otherwise keep the
  // previous tab's scroll offset — jump back to the top whenever the tab changes.
  useEffect(() => { scrollRef.current?.scrollTo(0, 0); }, [tab]);
  const [showStyle, setShowStyle] = useState(false);
  const [styleTab, setStyleTab] = useState(0); // which cosmetic category tab is open in the Style shop
  const [showShop, setShowShop] = useState(false); // Pro Shop disc list, collapsed by default
  const [discInfo, setDiscInfo] = useState<string | null>(null); // disc key for the details modal
  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  // Re-baseline only when the season rolls over (NOT on every skill spend), so the
  // − button keeps undoing this season's additions without resetting mid-edit.
  useEffect(() => { if (career) setSessionBase(career.skills); setConfirm(null); }, [career?.season, career?.retired]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  const wrap = "absolute inset-0 z-30 overflow-y-auto bg-[#0f1117]/95 backdrop-blur-sm px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)] flex items-start justify-center rounded-lg";
  const card = "w-full max-w-sm space-y-3 my-auto text-left";
  const toPar = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);

  // Season wrap-up (promotions, world #1, retirement) shown after advancing.
  if (notes.length > 0) {
    return (
      <div className={wrap}><div className={card}>
        <h2 className="text-white font-black text-xl">Season wrap-up</h2>
        <div className="space-y-2">
          {notes.map((n, i) => (
            <p key={i} className="text-gray-200 text-sm bg-white/5 border border-white/10 rounded-lg px-3 py-2">{n}</p>
          ))}
        </div>
        <button type="button" onClick={dismissNotes} className={`${btn} w-full`}>Continue ▶</button>
      </div></div>
    );
  }

  // New career.
  if (!career) {
    return (
      <div className={wrap}><div className={card}>
        <div className="flex items-center justify-between">
          <h2 className="text-white font-black text-xl">Career</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>
        <ul className="text-gray-300 text-sm space-y-2">
          <li className="flex gap-2"><span className="text-[#36D7B7]">▸</span><span>Start as a <span className="text-white">14-year-old</span> with two discs and $1,000 — separate from your main account.</span></li>
          <li className="flex gap-2"><span className="text-[#36D7B7]">▸</span><span>Finish events well to earn <span className="text-white">training points</span> — spend them on Power, Control, Putting and <span className="text-[#f5d24a]">Stamina</span>.</span></li>
          <li className="flex gap-2"><span className="text-[#36D7B7]">▸</span><span>Each season, spend <span className="text-[#f5d24a]">energy</span> to pick your events — bigger ones cost more and pay more.</span></li>
          <li className="flex gap-2"><span className="text-[#36D7B7]">▸</span><span>Climb from high school to the pro tour and chase <span className="text-[#f5d24a]">World #1</span> — coins you earn go to your account.</span></li>
        </ul>
        <input type="text" value={name} maxLength={16} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="w-full bg-[#1a1d23] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#e0923b]" />
        <button type="button" onClick={() => onStart(name)} className={`${btn} w-full`}>Begin career</button>
      </div></div>
    );
  }
  const sched = seasonSchedule(career);
  const resultFor = (id: string) => career.results.find((r) => r.eventId === id);
  const added = SKILL_KEYS.reduce((s, k) => s + Math.max(0, career.skills[k] - sessionBase[k]), 0); // points spent this view
  const undone = sched.filter((e) => !career.done.includes(e.id)); // events you haven't entered yet
  const enterable = undone.filter((e) => canEnterEvent(career, e)).length; // …of those, how many you can still afford
  const sponsorOffers = availableSponsors(career);
  const brandLock = sponsorBrandLock(career); // the disc brand a manufacturer deal locks your bag to (or null)
  const trainCost = trainingPointCost(career);
  const overall = Math.round(careerRating(career.skills)); // the single headline number — rises as you train
  const shop = careerDiscShop(career); // every disc you don't own, cheapest first (career cash)
  // Current in-play effect of each skill, so the benefit of training is concrete.
  const mods = skillMods(career.skills);
  const effectFor = (k: keyof CareerSkills): string => {
    // One decimal place so every training point visibly moves the readout — a point
    // only nudges these by ~0.1–0.3, which a whole-number display hid for ~6 points.
    if (k === "power") return `${(mods.speedMul * 100).toFixed(1)}% dist`; // 100% at 99
    if (k === "control") return `cone ±${((mods.aimSpread * 180) / Math.PI).toFixed(1)}°`; // 0° at 99
    if (k === "putt") return `catch ${((mods.catchR / CATCH_R) * 100).toFixed(1)}%`; // 110% at 99
    return `${(8 + (Math.min(99, career.skills.stamina) / 99) * 16).toFixed(1)} ⚡/yr`; // stamina → season energy pool
  };

  // Retired legacy screen.
  if (career.retired) {
    const big = career.titles.filter((t) => t.importance !== "minor");
    return (
      <div className={wrap}><div className={card}>
        <div className="flex items-center justify-between">
          <h2 className="text-white font-black text-xl">{career.name}</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>
        <p className="text-gray-400 text-xs -mt-2">Retired at age {career.age} · {career.season} seasons · PDGA {career.pdgaRating} · earned {fmtCash(career.cash)}</p>
        <div className="grid grid-cols-2 gap-2 text-center">
          <CareerStat label="Titles" v={career.titles.length} />
          <CareerStat label="Majors" v={career.majors} />
          <CareerStat label="Best world rank" v={career.bestWorldRank ? `#${career.bestWorldRank}` : "—"} />
          <CareerStat label="Seasons at #1" v={career.seasonsAtNo1} />
        </div>
        {big.length > 0 && (
          <div className="bg-[#1a1d23] border border-white/5 rounded-xl p-3 max-h-44 overflow-y-auto">
            <p className="text-[#f5d24a] text-xs font-bold mb-1.5">Career titles</p>
            {big.map((t, i) => <p key={i} className="text-gray-300 text-xs">🏆 {t.name} <span className="text-gray-500">· age {t.age}</span></p>)}
          </div>
        )}
        <button type="button" onClick={onAbandon} className={`${btn} w-full`}>Start a new career</button>
        <button type="button" onClick={onClose} className="w-full text-gray-500 hover:text-gray-300 text-xs py-1 transition">Close</button>
      </div></div>
    );
  }

  // Season hub.
  return (
    <div className="absolute inset-0 z-30 bg-[#0f1117]/95 backdrop-blur-sm px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)] flex justify-center">
      <div className="w-full max-w-sm h-full flex flex-col gap-3 text-left">
      <div className="shrink-0 flex items-center justify-between">
        <div className="min-w-0">
          <h2 className="text-white font-black text-lg leading-tight truncate">{career.name}</h2>
          <p className="text-gray-400 text-[11px]">{STAGE_LABEL[career.stage]}{career.stage === "pro" ? ` · ${careerYear(career)} season` : ""} · Age {career.age} · Season {career.season + 1}</p>
          <p className="text-[11px] mt-0.5">
            {career.stage === "pro" && career.worldRank
              ? <span className="text-[#f5d24a] font-bold">World #{career.worldRank}</span>
              : <span className="text-gray-500">PDGA {career.pdgaRating}</span>}
            <span className="text-[#36D7B7] font-bold font-mono ml-2">{fmtCash(career.cash)}</span>
            <span className="text-[#f5d24a] font-bold font-mono ml-2" title="Season energy — spend it to enter events">⚡{career.energy}</span>
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <span className="text-right leading-tight">
            <span className="block text-[#36D7B7] font-black text-2xl font-mono leading-none">{overall}</span>
            <span className="block text-gray-500 text-[8px] uppercase tracking-wide">Overall</span>
          </span>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>
      </div>

      {/* Tabs — pinned near the top so they never move as you switch; only the
          panel BELOW scrolls. The header's Overall/cash/energy stay on every tab. */}
      <div className="shrink-0 flex gap-1 bg-[#1a1d23] border border-white/10 rounded-lg p-1 text-[11px] font-bold">
        {([["skills", "Skills"], ["bag", "Bag"], ["schedule", "Events"], ["sponsors", "Sponsors"]] as const).map(([key, label]) => (
          <button key={key} type="button" onClick={() => setTab(key)} className={`flex-1 rounded-md py-1.5 transition ${tab === key ? "bg-[#36D7B7] text-[#0f1117]" : "text-gray-400 hover:text-white"}`}>{label}</button>
        ))}
      </div>

      {/* Scrolling content — the ONLY part that scrolls, so the header + tabs stay put */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto space-y-3 -mx-0.5 px-0.5">
      {lastResult && (
        <div className={`rounded-lg px-3 py-2 text-sm border ${lastResult.win ? "border-[#f5d24a]/50 bg-[#f5d24a]/10 text-[#f5d24a]" : "border-white/10 bg-white/5 text-gray-200"}`}>
          <div>{lastResult.name}: <span className="font-bold">{placeLabel(lastResult.placed)}</span> of {lastResult.field} · {toPar(lastResult.toPar)} ({lastResult.score}){lastResult.prize > 0 && <span className="text-[#36D7B7]"> · +{fmtCash(lastResult.prize)}</span>}{lastCoins > 0 && <span className="text-[#f5d24a]"> · +{lastCoins} <Coin className="!w-3 !h-3 align-[-1px]" /></span>}</div>
          <div className="text-[10px] text-gray-400 mt-0.5">
            {lastResult.win ? <span className="text-[#f5d24a]">🏆 You took the title!</span> : lastResult.winnerName ? `${lastResult.winnerName} won the event` : null}
            {lastResult.trainBonus > 0 && <span className="text-[#36D7B7]">{lastResult.win || lastResult.winnerName ? " · " : ""}+{lastResult.trainBonus} training pt{lastResult.trainBonus > 1 ? "s" : ""}</span>}
          </div>
        </div>
      )}

      {/* Skills + training */}
      {tab === "skills" && (
      <div className="bg-[#1a1d23] border border-white/5 rounded-xl p-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-gray-400 text-xs font-bold uppercase tracking-wide">Skills · Overall {overall}</p>
          <p className="text-[11px] text-gray-400">Points to spend <span className={career.trainPts > 0 ? "text-[#36D7B7] font-bold" : "text-gray-500"}>{career.trainPts}</span>{added > 0 ? <span className="text-gray-500"> · +{added}</span> : null}</p>
        </div>
        {SKILL_KEYS.map((k) => {
          const val = career.skills[k];
          const canAdd = career.trainPts > 0 && val < 99;
          const canRemove = val > sessionBase[k]; // only undo points added this session
          return (
            <div key={k} className="flex items-center gap-2">
              <span className="w-12 text-[11px] text-gray-300">{SKILL_LABEL[k]}</span>
              <div className="flex-1 h-2.5 bg-white/5 rounded relative overflow-hidden">
                <div className="absolute inset-y-0 left-0 bg-[#36D7B7] rounded transition-all" style={{ width: `${Math.min(100, val)}%` }} />
              </div>
              <span className="w-7 text-right text-[11px] font-mono text-white">{val}</span>
              <span className="w-20 text-right text-[10px] font-mono text-[#36D7B7] shrink-0">{effectFor(k)}</span>
              <div className="flex gap-0.5 shrink-0">
                <button type="button" onClick={() => onAllocateSkill(k, -1)} disabled={!canRemove} className="w-5 h-5 rounded bg-white/10 text-white text-xs leading-none disabled:opacity-30">−</button>
                <button type="button" onClick={() => onAllocateSkill(k, 1)} disabled={!canAdd} className="w-5 h-5 rounded bg-white/10 text-white text-xs leading-none disabled:opacity-30">+</button>
              </div>
            </div>
          );
        })}
        <div className="flex justify-end pt-1.5 border-t border-white/5">
          <button type="button" onClick={onBuyTrain} disabled={career.cash < trainCost}
            className="rounded bg-[#36D7B7]/15 border border-[#36D7B7]/40 text-[#36D7B7] text-[11px] font-bold px-2 py-1 disabled:opacity-30 disabled:border-white/10 disabled:text-gray-500">
            +1 pt · {fmtCash(trainCost)}
          </button>
        </div>
      </div>
      )}

      {tab === "bag" && (<>
      {/* Career bag + Pro Shop — a disc collection entirely separate from your account */}
      <div className="bg-[#1a1d23] border border-white/5 rounded-xl p-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-gray-400 text-xs font-bold uppercase tracking-wide">Bag · {career.bag.length}/{CAREER_BAG_MAX}</p>
          <p className="text-[10px] text-gray-500">tap a disc for details</p>
        </div>
        {brandLock && <p className="text-[#f5d24a] text-[10px] -mt-1">🥏 {brandLock} deal — your bag &amp; shop are {brandLock} discs only.</p>}
        <div className="flex flex-wrap gap-1.5">
          {career.discs.map((key) => {
            const d = discByKey(key);
            if (!d) return null;
            const inBag = career.bag.includes(key);
            return (
              <button key={key} type="button" onClick={() => setDiscInfo(key)}
                className={`rounded-lg border px-2 py-1 text-[11px] font-semibold transition ${inBag ? "border-[#36D7B7]/70 bg-[#36D7B7]/10 text-white" : "border-white/10 bg-white/[0.02] text-gray-500"}`}>
                <span className="w-2 h-2 rounded-full inline-block mr-1 align-[-1px]" style={{ background: d.color }} />{d.name}
              </button>
            );
          })}
        </div>
        {shop.length > 0 ? (
          <div className="pt-1.5 border-t border-white/5">
            <button type="button" onClick={() => setShowShop((s) => !s)} className="w-full flex items-center justify-between">
              <p className="text-gray-500 text-[10px] font-bold uppercase tracking-wide">Pro Shop · {shop.length} disc{shop.length > 1 ? "s" : ""} · career cash</p>
              <span className="text-gray-500 text-[11px]">{showShop ? "Hide ▲" : "Shop ▼"}</span>
            </button>
            {showShop && (
              <div className="space-y-1 mt-1.5">
                {/* The starters every career begins with — owned, listed so the
                    shop shows the full catalog (tap for flight details) */}
                {CAREER_CORE_DISCS.map((key) => {
                  const d = discByKey(key);
                  if (!d) return null;
                  return (
                    <div key={key} className="flex items-center justify-between gap-2 text-[11px]">
                      <button type="button" onClick={() => setDiscInfo(key)} className="flex items-center gap-1.5 min-w-0 text-left hover:opacity-80">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                        <span className="text-white font-semibold truncate">{d.name}</span>
                        <span className="text-gray-500 truncate hidden xs:inline">{d.brand}</span>
                        <span className="text-gray-600 shrink-0">ⓘ</span>
                      </button>
                      <span className="shrink-0 text-[10px] font-bold text-[#36D7B7] px-2 py-0.5">Starter ✓</span>
                    </div>
                  );
                })}
                {shop.map(({ key, cost }) => {
                  const d = discByKey(key);
                  if (!d) return null;
                  return (
                    <div key={key} className="flex items-center justify-between gap-2 text-[11px]">
                      <button type="button" onClick={() => setDiscInfo(key)} className="flex items-center gap-1.5 min-w-0 text-left hover:opacity-80">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                        <span className="text-white font-semibold truncate">{d.name}</span>
                        <span className="text-gray-500 truncate hidden xs:inline">{d.brand}</span>
                        <span className="text-gray-600 shrink-0">ⓘ</span>
                      </button>
                      <button type="button" onClick={() => onBuyDisc(key)} disabled={career.cash < cost}
                        className="shrink-0 rounded bg-[#e0923b] hover:brightness-110 text-[#0f1117] font-bold px-2 py-0.5 disabled:bg-white/10 disabled:text-gray-500">
                        {fmtCash(cost)}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <p className="text-gray-500 text-[10px] pt-1.5 border-t border-white/5">You own every disc in the shop. 🎒</p>
        )}
      </div>

      {/* Career cosmetics — a post-max cash sink, worn during Career rounds only */}
      <div className="bg-[#1a1d23] border border-white/5 rounded-xl p-3 space-y-2">
        <button type="button" onClick={() => setShowStyle((s) => !s)} className="w-full flex items-center justify-between">
          <p className="text-gray-400 text-xs font-bold uppercase tracking-wide">🎨 Style · career cash</p>
          <span className="text-gray-500 text-[11px]">{showStyle ? "Hide ▲" : "Shop ▼"}</span>
        </button>
        {showStyle && (
          <div className="space-y-2">
            {/* Category tabs — Disc / Basket / Aim line / Win pop / Trail. Pick a tab and
                its items wrap below, replacing the old sideways-scrolling rows. */}
            <div className="flex flex-wrap gap-1">
              {CAREER_STYLE_CATS.map((cat, i) => (
                <button key={cat.slot} type="button" onClick={() => setStyleTab(i)}
                  className={`rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wide transition ${styleTab === i ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"}`}>
                  {cat.label}
                </button>
              ))}
            </div>
            {(() => {
              const cat = CAREER_STYLE_CATS[styleTab] ?? CAREER_STYLE_CATS[0];
              return (
                <div className="flex flex-wrap gap-1.5">
                  {cat.items.map((it) => {
                    const ownKey = cosmeticOwnKey(cat.prefix, it.key);
                    const owned = it.price === 0 || career.cosmetics.includes(ownKey);
                    const equipped = (career.look[cat.slot] || DEFAULT_CAREER_LOOK[cat.slot]) === it.key;
                    const cost = it.price * CAREER_COSMETIC_CASH;
                    return (
                      <button key={it.key} type="button"
                        onClick={() => (owned ? onEquipLook(cat.slot, it.key) : career.cash >= cost ? onBuyCosmetic(ownKey, cost) : undefined)}
                        disabled={!owned && career.cash < cost}
                        className={`rounded-lg border px-2 py-1 flex items-center gap-1 transition ${equipped ? "border-[#36D7B7]/70 bg-[#36D7B7]/10" : owned ? "border-white/15 bg-white/[0.02] hover:border-white/30" : "border-white/10 bg-white/[0.02] disabled:opacity-40"}`}>
                        <span className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/30" style={{ background: it.color }} />
                        <span className="text-[10px] text-white font-semibold whitespace-nowrap">{it.name}</span>
                        {equipped ? <span className="text-[9px] text-[#36D7B7]">✓</span> : !owned && <span className="text-[9px] text-[#e0923b] font-mono whitespace-nowrap">{fmtCash(cost)}</span>}
                      </button>
                    );
                  })}
                </div>
              );
            })()}
            <p className="text-gray-600 text-[10px]">Worn during Career rounds — a flex for your prize money, separate from your account cosmetics.</p>
          </div>
        )}
      </div>
      </>)}

      {/* Sponsors — three category slots. Each holds one deal; signing a better offer
          in a slot swaps out the current one. You start with no offer and earn them
          as your rating climbs. */}
      {tab === "sponsors" && (
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <p className="text-gray-400 text-xs font-bold uppercase tracking-wide">Sponsors ({career.sponsors.length}/{SPONSOR_CAP})</p>
          <p className="text-[10px] text-gray-500">Fill a slot · sign a better offer to swap</p>
        </div>
        {SPONSOR_SLOTS.map((slot) => {
          const held = career.sponsors.find((s) => s.slot === slot);
          const offers = sponsorOffers.filter((o) => o.slot === slot);
          return (
            <div key={slot} className="bg-[#1a1d23] border border-white/5 rounded-xl p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{SPONSOR_SLOT_LABEL[slot]} slot</p>
                {!held && <p className="text-[10px] text-gray-600">Open</p>}
              </div>
              {held && (
                <div className={`flex items-center justify-between gap-2 text-[11px] ${held.brand ? "text-[#f5d24a]" : ""}`}>
                  <span className={`min-w-0 truncate ${held.brand ? "font-bold" : "text-white"}`}>{held.brand ? "🥏 " : ""}{held.name}{held.coach ? " 🎓" : ""}{held.brand ? <span className="text-gray-500 font-normal"> · {held.brand} discs only</span> : ""}</span>
                  <span className="shrink-0 flex items-center gap-2">
                    <span className={held.brand ? "font-mono" : "text-gray-400 font-mono"}>{fmtCash(held.stipend)}/yr</span>
                    {dropId === held.id ? (
                      <span className="text-[10px] text-gray-400">Drop? <button type="button" onClick={() => { onUnsign(held.id); setDropId(null); }} className="text-[#e2453b] font-bold">Yes</button> · <button type="button" onClick={() => setDropId(null)} className="text-gray-300">No</button></span>
                    ) : (
                      <button type="button" onClick={() => setDropId(held.id)} title="Drop this sponsor" className="text-gray-500 hover:text-[#e2453b] text-sm leading-none">×</button>
                    )}
                  </span>
                </div>
              )}
              {offers.map((s) => {
                const isSwap = !!held; // slot occupied → signing swaps the current deal out
                const paid = (career.sponsorBonusClaimed ?? []).includes(s.id); // re-signing a dropped deal pays no second bonus
                return (
                  <div key={s.id} className={`flex items-center justify-between gap-2 rounded px-2 py-1.5 ${s.brand ? "bg-[#f5d24a]/[0.07] border border-[#f5d24a]/25" : "bg-white/[0.03]"}`}>
                    <div className="min-w-0">
                      <p className={`text-xs font-semibold truncate ${s.brand ? "text-[#f5d24a]" : "text-white"}`}>{s.brand ? "🥏 " : ""}{s.name}{s.coach ? " 🎓" : ""}</p>
                      <p className="text-gray-500 text-[10px]">{!paid && `${fmtCash(s.signing)} signing · `}{fmtCash(s.stipend)}/yr{s.coach ? " · +1 training" : ""}</p>
                      {s.brand && <p className="text-[#e0923b] text-[10px] font-semibold">Exclusive — you’ll carry only {s.brand} discs.</p>}
                      {isSwap && <p className="text-gray-500 text-[10px]">Swaps out {held!.name}.</p>}
                    </div>
                    <button type="button" onClick={() => onSign(s.id)} className="shrink-0 rounded bg-[#e0923b] hover:brightness-110 text-[#0f1117] text-[11px] font-bold px-2.5 py-1">{isSwap ? "Swap" : "Sign"}</button>
                  </div>
                );
              })}
              {!held && offers.length === 0 && (
                <p className="text-gray-600 text-[11px]">No offers yet — raise your rating to attract a {SPONSOR_SLOT_LABEL[slot].toLowerCase()} sponsor.</p>
              )}
            </div>
          );
        })}
      </div>
      )}

      {/* Schedule — a slate too big for your season energy, so you choose which to
          enter. Each event costs energy (bigger = more, and pays more). */}
      {tab === "schedule" && (
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <p className="text-gray-400 text-xs font-bold uppercase tracking-wide">Schedule · pick your events</p>
          <p className="text-[10px] text-gray-500"><span className="text-[#f5d24a] font-mono font-bold">⚡{career.energy}</span> energy left</p>
        </div>
        {sched.map((ev) => {
          const r = resultFor(ev.id);
          const impColor = ev.importance === "championship" ? "text-[#f5d24a]" : ev.importance === "major" ? "text-[#5fb0e8]" : "text-gray-500";
          const impWord = ev.importance === "championship" ? "Championship" : ev.importance === "major" ? "Major" : "Tour";
          const courseLabel = ev.venue ?? (ev.mode === "winthrop" ? "Winthrop Lake" : ev.mode === "olympus" ? "Olympus" : ev.mode === "course" ? "Glendoveer" : "9-hole");
          const cost = eventEnergyCost(ev);
          const broke = !canEnterEvent(career, ev); // can't afford the energy to enter
          return (
            <div key={ev.id} className={`bg-[#1a1d23] border border-white/5 rounded-lg px-3 py-2 ${!r && broke ? "opacity-60" : ""}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-white text-sm font-semibold truncate">{ev.name}</p>
                  <p className="text-[10px] text-gray-500"><span className={impColor}>{impWord}</span> · {courseLabel} · {ev.fieldSize + 1} players · <span className="text-[#f5d24a] font-mono">{cost}⚡</span></p>
                  {ev.character && <p className="text-[10px] text-gray-500 truncate">{ev.emoji} {ev.character}</p>}
                  {!r && (() => {
                    const fieldN = ev.fieldSize + 1;
                    return (
                      <div className="text-[9px] text-gray-500 mt-0.5 leading-tight space-y-0.5">
                        <p><span className="text-[#36D7B7] font-semibold">▲ skill pts</span> win +{trainBonusFor(ev.importance, 1, fieldN)} · top-5 +{trainBonusFor(ev.importance, 5, fieldN)} · top-½ +{trainBonusFor(ev.importance, Math.ceil(fieldN / 2), fieldN)} · any +{trainBonusFor(ev.importance, fieldN, fieldN)}</p>
                        <p><span className="text-[#f5d24a] font-semibold">◆ coins</span> win {coinsForFinish(ev.importance, 1, fieldN)} · top-3 {coinsForFinish(ev.importance, 3, fieldN)} · top-½ {coinsForFinish(ev.importance, Math.ceil(fieldN / 2), fieldN)} <Coin className="!w-2.5 !h-2.5 align-[-1px]" /> <span className="text-gray-600">if played</span></p>
                      </div>
                    );
                  })()}
                </div>
                {r ? (
                  <span className={`shrink-0 text-xs font-bold ${r.win ? "text-[#f5d24a]" : "text-gray-300"}`} title={r.played ? "played" : "simmed"}>{placeLabel(r.placed)} <span className="text-gray-500 font-normal">{r.played ? "▶" : "⚡"}</span></span>
                ) : broke ? (
                  <span className="shrink-0 text-[10px] text-gray-500 text-right leading-tight">out of<br />energy</span>
                ) : (
                  <div className="shrink-0 flex gap-1">
                    <button type="button" onClick={() => onPlay(ev)} className="rounded bg-[#36D7B7] hover:bg-[#2ec2a6] text-[#0f1117] text-xs font-bold px-2.5 py-1">Play</button>
                    <button type="button" onClick={() => onSim(ev)} className="rounded bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-2.5 py-1">⚡ Sim</button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}

      </div>

      {/* Advance + retire/abandon stay pinned below every tab so the season-flow
          controls are always reachable. Leftover energy is lost at season's end. */}
      <div className="shrink-0 space-y-2 pt-0.5">
      {enterable > 0 && (
        <p className="text-[10px] text-gray-500 text-center -mb-0.5">You can still enter <span className="text-[#f5d24a] font-semibold">{enterable}</span> more event{enterable === 1 ? "" : "s"} with your <span className="text-[#f5d24a] font-mono">⚡{career.energy}</span> — unspent energy is lost when the season ends.</p>
      )}
      <button type="button" onClick={onAdvance} className={`${btn} w-full`}>Advance to next season ▶</button>
      <div className="flex items-center justify-between pt-0.5">
        {career.stage === "pro" ? (
          confirm === "retire" ? (
            <span className="text-xs text-gray-400">Retire? <button type="button" onClick={onRetire} className="text-[#e2453b] font-bold">Yes</button> · <button type="button" onClick={() => setConfirm(null)} className="text-gray-300">No</button></span>
          ) : (
            <button type="button" onClick={() => setConfirm("retire")} className="text-gray-500 hover:text-gray-300 text-xs">Retire</button>
          )
        ) : <span />}
        {confirm === "abandon" ? (
          <span className="text-xs text-gray-400">Delete? <button type="button" onClick={onAbandon} className="text-[#e2453b] font-bold">Yes</button> · <button type="button" onClick={() => setConfirm(null)} className="text-gray-300">No</button></span>
        ) : (
          <button type="button" onClick={() => setConfirm("abandon")} className="text-gray-600 hover:text-gray-400 text-xs">Abandon</button>
        )}
      </div>
      </div>

      {/* Disc details modal — flight numbers + type, with the contextual action */}
      {discInfo && (() => {
        const d = discByKey(discInfo);
        if (!d) return null;
        const owned = career.discs.includes(d.key);
        const inBag = career.bag.includes(d.key);
        const cost = shop.find((s) => s.key === d.key)?.cost ?? null;
        const nums = (d.blurb.split("· ")[1] ?? d.blurb).trim();
        return (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-5" onClick={() => setDiscInfo(null)}>
            <div className="w-full max-w-[270px] rounded-2xl bg-gradient-to-b from-[#1c2233] to-[#12151c] border border-white/15 p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full shrink-0 border border-black/40" style={{ background: d.color }} />
                <div className="min-w-0">
                  <p className="text-white font-black text-lg leading-none truncate">{d.name}</p>
                  <p className="text-gray-500 text-[11px]">{d.brand}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <div className="bg-white/5 rounded-lg py-1.5 text-center"><p className="text-gray-500 text-[9px] uppercase tracking-wide">Type</p><p className="text-white text-xs font-bold">{discTypeLabel(d.power)}</p></div>
                <div className="bg-white/5 rounded-lg py-1.5 text-center"><p className="text-gray-500 text-[9px] uppercase tracking-wide">Glide</p><p className="text-white text-xs font-bold">{d.flightNums?.glide ?? "—"}</p></div>
              </div>
              <div className="mt-2 bg-white/5 rounded-lg p-2 text-center">
                <p className="text-gray-500 text-[9px] uppercase tracking-wide mb-0.5">Speed · Glide · Turn · Fade</p>
                <p className="text-[#36D7B7] font-mono font-black text-base tracking-wide">{nums}</p>
              </div>
              {owned ? (
                <button type="button" onClick={() => { onToggleBag(d.key); setDiscInfo(null); }} className={`${btn} w-full !mt-3`}>{inBag ? "Remove from bag" : "Add to bag"}</button>
              ) : cost != null ? (
                <button type="button" disabled={career.cash < cost} onClick={() => { onBuyDisc(d.key); setDiscInfo(null); }} className="w-full mt-3 rounded-lg bg-[#e0923b] hover:brightness-110 text-[#0f1117] font-bold py-2.5 disabled:bg-white/10 disabled:text-gray-500">Buy · {fmtCash(cost)}</button>
              ) : null}
              <button type="button" onClick={() => setDiscInfo(null)} className="w-full text-gray-500 hover:text-gray-300 text-xs py-1.5 mt-1 transition">Close</button>
            </div>
          </div>
        );
      })()}
    </div></div>
  );
}
