"use client";

// Home menu utilities as one row of small square icon buttons (Henry, 2026-11-18:
// so the whole home screen fits a 390x844 phone without scrolling). The whole
// column (square + tiny label) is the tap target; the accessible name is the full word.
export function UtilityRow({ goalsReady, onBag, onShop, onGoals, onBoards }: {
  goalsReady: number; // claimable Goals rewards, shown as a badge
  onBag: () => void;
  onShop: () => void;
  onGoals: () => void;
  onBoards: () => void;
}) {
  const items = [
    { icon: "🎒", label: "Bag", onClick: onBag, badge: 0 },
    { icon: "🛒", label: "Shop", onClick: onShop, badge: 0 },
    { icon: "🎯", label: "Goals", onClick: onGoals, badge: goalsReady },
    { icon: "🏆", label: "Leaderboards", onClick: onBoards, badge: 0 },
  ];
  return (
    <div className="w-full grid grid-cols-4 gap-2 mt-3" data-testid="utility-row">
      {items.map(({ icon, label, onClick, badge }) => (
        <button
          key={label}
          type="button"
          onClick={onClick}
          aria-label={badge > 0 ? `${label}, ${badge} to claim` : label}
          className="group flex flex-col items-center gap-1 min-h-11 text-gray-300 hover:text-white transition"
        >
          <span className="relative w-12 h-12 flex items-center justify-center rounded-xl border border-[#36D7B7]/45 bg-[#1a1d23] group-hover:border-[#36D7B7] group-active:scale-95 text-[22px] leading-none transition" aria-hidden="true">
            {icon}
            {badge > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-[#f5d24a] text-[#1a1d23] text-[11px] font-black leading-5" data-testid="utility-badge">
                {badge}
              </span>
            )}
          </span>
          <span className="text-[10px] lg:text-xs font-semibold leading-none" aria-hidden="true">{label}</span>
        </button>
      ))}
    </div>
  );
}
