"use client";

import { useEffect, useRef, useState } from "react";

export type Factor = { label: string; points: number; detail: string };

function scoreColor(score: number) {
  if (score >= 75) return "bg-emerald-600";
  if (score >= 55) return "bg-amber-600";
  return "bg-neutral-700";
}

/**
 * The score, with its full derivation one hover (desktop) or tap (mobile)
 * away. Hover and tap are tracked separately so that moving the mouse away
 * does not dismiss a panel the user deliberately tapped open.
 */
export function ScoreBadge({ score, breakdown }: { score: number; breakdown: Factor[] }) {
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const open = hovered || pinned;

  // A tapped-open panel should close when tapping anywhere else.
  useEffect(() => {
    if (!pinned) return;
    const onDocPointerDown = (e: PointerEvent) => {
      if (!wrapper.current?.contains(e.target as Node)) setPinned(false);
    };
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, [pinned]);

  if (!breakdown?.length) {
    return (
      <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-white ${scoreColor(score)}`}>
        {score}
      </span>
    );
  }

  return (
    <div
      ref={wrapper}
      className="relative inline-block"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-label={`Score ${score} of 100, show breakdown`}
        onClick={(e) => {
          e.preventDefault();
          setPinned((p) => !p);
        }}
        className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-white transition-transform active:scale-95 ${scoreColor(score)}`}
      >
        {score}
        <span aria-hidden className="opacity-60">ⓘ</span>
      </button>

      {/* Dims the list behind the mobile sheet so it reads as a layer. */}
      {pinned ? (
        <div className="fixed inset-0 z-20 bg-black/50 sm:hidden" aria-hidden />
      ) : null}

      {open ? (
        <div
          role="dialog"
          // Anchoring to the badge overflows a narrow screen, so on mobile
          // this becomes a bottom sheet and only goes back to an anchored
          // popover once there is room for one.
          className="fixed inset-x-3 bottom-3 z-30 rounded-xl border border-neutral-700 bg-neutral-900 p-3 text-left shadow-2xl shadow-black/60 sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-0 sm:top-full sm:mt-1.5 sm:w-80"
        >
          <div className="mb-2 flex items-baseline justify-between border-b border-neutral-800 pb-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Score breakdown
            </span>
            <span className="text-lg font-bold">{score}<span className="text-xs text-neutral-500">/100</span></span>
          </div>

          <ul className="space-y-1.5">
            {breakdown.map((f, i) => (
              <li key={i} className="flex gap-2 text-xs">
                <span
                  className={`w-9 shrink-0 text-right font-mono font-semibold ${
                    f.points > 0 ? "text-emerald-400" : f.points < 0 ? "text-red-400" : "text-neutral-500"
                  }`}
                >
                  {f.points > 0 ? `+${f.points}` : f.points}
                </span>
                <span className="min-w-0">
                  <span className="font-medium text-neutral-200">{f.label}</span>
                  <span className="block leading-snug text-neutral-500">{f.detail}</span>
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-2 border-t border-neutral-800 pt-2 text-[11px] leading-snug text-neutral-500">
            Market value compares this ad against real prices for the same model
            in our own scraped corpus, not a book value.
          </p>
        </div>
      ) : null}
    </div>
  );
}
