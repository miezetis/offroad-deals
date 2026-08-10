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
  // The panel and trigger are tracked separately from the backdrop: the
  // backdrop is a sibling in the DOM but visually "outside" the sheet, so a
  // wrapper-wide containment check would treat every dismissing tap as a tap
  // inside and the sheet could never be closed on touch.
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const open = hovered || pinned;

  useEffect(() => {
    if (!pinned) return;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (panel.current?.contains(target) || trigger.current?.contains(target)) return;
      setPinned(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPinned(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [pinned]);

  if (!breakdown?.length) {
    return (
      <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-white ${scoreColor(score)}`}>
        {score}
      </span>
    );
  }

  const close = () => {
    setPinned(false);
    setHovered(false);
  };

  return (
    <div className="relative inline-block">
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-label={`Score ${score} of 100, show breakdown`}
        // Only a real mouse opens on hover. Touch devices emit an emulated
        // mouseenter on tap, which would otherwise leave the panel stuck open
        // with no pointer to move away.
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse") setHovered(true);
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") setHovered(false);
        }}
        onClick={(e) => {
          e.preventDefault();
          setPinned((p) => !p);
        }}
        className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-white transition-transform active:scale-95 ${scoreColor(score)}`}
      >
        {score}
        <span aria-hidden className="opacity-60">ⓘ</span>
      </button>

      {/* Tap-anywhere-to-dismiss layer, and it dims the list behind the sheet. */}
      {pinned ? (
        <div
          className="fixed inset-0 z-20 bg-black/50 sm:bg-transparent"
          aria-hidden
          onClick={close}
        />
      ) : null}

      {open ? (
        <div
          ref={panel}
          role="dialog"
          // Anchoring to the badge overflows a narrow screen, so on mobile
          // this becomes a bottom sheet and only goes back to an anchored
          // popover once there is room for one.
          className="fixed inset-x-3 bottom-3 z-30 rounded-xl border border-neutral-700 bg-neutral-900 p-3 text-left shadow-2xl shadow-black/60 sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-0 sm:top-full sm:mt-1.5 sm:w-80"
        >
          <div className="mb-2 flex items-center justify-between gap-2 border-b border-neutral-800 pb-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Score breakdown
            </span>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold">
                {score}<span className="text-xs text-neutral-500">/100</span>
              </span>
              <button
                type="button"
                onClick={close}
                aria-label="Close score breakdown"
                className="-mr-1 rounded-md px-2 py-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
              >
                ✕
              </button>
            </div>
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
