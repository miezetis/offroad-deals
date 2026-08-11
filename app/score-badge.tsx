"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type Factor = { label: string; points: number; detail: string };

function scoreColor(score: number) {
  if (score >= 75) return "bg-emerald-600";
  if (score >= 55) return "bg-amber-600";
  return "bg-neutral-700";
}

/** Matches Tailwind's `sm` breakpoint, which drives sheet vs popover. */
const DESKTOP = "(min-width: 640px)";
const PANEL_WIDTH = 320;
const MARGIN = 12;
/** Enough room to render below the badge before flipping above it. */
const MIN_SPACE_BELOW = 280;

type Position = { left: number; top?: number; bottom?: number };

function positionFor(rect: DOMRect): Position {
  const left = Math.min(
    Math.max(MARGIN, rect.left),
    window.innerWidth - PANEL_WIDTH - MARGIN,
  );
  return window.innerHeight - rect.bottom > MIN_SPACE_BELOW
    ? { left, top: rect.bottom + 6 }
    : { left, bottom: window.innerHeight - rect.top + 6 };
}

/**
 * The score, with its full derivation one hover (desktop) or tap (mobile)
 * away.
 *
 * The panel renders in a portal on `document.body` rather than inside the
 * card. A viewed card is dimmed with `opacity`, and any opacity below 1
 * creates a stacking context that traps a descendant's z-index inside it — so
 * an in-place panel rendered from a viewed card was painted underneath the
 * following cards, and inherited their dimming. Portalling sidesteps both,
 * and keeps working whatever styles the card grows later.
 */
export function ScoreBadge({ score, breakdown }: { score: number; breakdown: Factor[] }) {
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);

  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  // Both start false, so the portal never renders on the server or during the
  // first client render — no mounted guard needed to keep hydration honest.
  const open = hovered || pinned;

  /**
   * `null` position means "let the mobile bottom-sheet classes apply".
   * The breakpoint is read live on every call rather than cached in state:
   * a cached value goes stale whenever the viewport changes without a
   * matchMedia `change` event, and then desktop coordinates leak onto the
   * mobile sheet and shove it off the right edge.
   */
  const reposition = useCallback(() => {
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition(window.matchMedia(DESKTOP).matches ? positionFor(rect) : null);
  }, []);

  /**
   * The panel is fixed-position, so it has to follow the trigger whenever the
   * page moves under it. Scroll listeners are not reliable here — the event
   * only reaches a listener bound to whichever element actually scrolls, and
   * that varies with the layout. Sampling the trigger's rect each frame tracks
   * every cause of movement (page scroll, nested scroll containers, resizes,
   * layout shifts) with no assumptions, and the equality guard keeps it to one
   * render per actual change rather than one per frame.
   */
  useEffect(() => {
    if (!open) return;
    let frame = 0;
    let previous = "";

    const track = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (rect) {
        const next = window.matchMedia(DESKTOP).matches ? positionFor(rect) : null;
        const key = next ? `${next.left}:${next.top}:${next.bottom}` : "sheet";
        if (key !== previous) {
          previous = key;
          setPosition(next);
        }
      }
      frame = requestAnimationFrame(track);
    };

    frame = requestAnimationFrame(track);
    return () => cancelAnimationFrame(frame);
  }, [open]);

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

  const overlay = (
    <>
      {/* Tap-anywhere-to-dismiss layer; also dims the list behind the sheet. */}
      {pinned ? (
        <div
          className="fixed inset-0 z-[60] bg-black/50 sm:bg-transparent"
          aria-hidden
          onClick={close}
        />
      ) : null}

      <div
        ref={panel}
        role="dialog"
        aria-label="Score breakdown"
        // Mobile is a bottom sheet; desktop is anchored to the badge via
        // coordinates, since a portal has no positioned ancestor to sit in.
        className="fixed inset-x-3 bottom-3 z-[70] rounded-xl border border-neutral-700 bg-neutral-900 p-3 text-left shadow-2xl shadow-black/60 sm:inset-x-auto sm:bottom-auto sm:w-80"
        style={
          position
            ? { left: position.left, top: position.top, bottom: position.bottom, right: "auto" }
            : // Belt and braces: on desktop a missing position would paint at
              // the document's top-left, so stay invisible for the frame it
              // takes to resolve. On mobile `null` is the intended state — the
              // bottom-sheet classes already place it.
              window.matchMedia(DESKTOP).matches
              ? { visibility: "hidden" }
              : undefined
        }
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
    </>
  );

  return (
    <span className="inline-block">
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-label={`Score ${score} of 100, show breakdown`}
        // Only a real mouse opens on hover. Touch devices emit an emulated
        // mouseenter on tap, which would otherwise leave the panel stuck open
        // with no pointer to move away.
        // Position is computed in the same update that opens the panel. A
        // first render without coordinates would paint a fixed element at its
        // static position — the top of the document, since the portal hangs
        // off <body> — and it would visibly jump into place a frame later.
        onPointerEnter={(e) => {
          if (e.pointerType !== "mouse") return;
          reposition();
          setHovered(true);
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") setHovered(false);
        }}
        onClick={(e) => {
          e.preventDefault();
          reposition();
          setPinned((p) => !p);
        }}
        className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-white transition-transform active:scale-95 ${scoreColor(score)}`}
      >
        {score}
        <span aria-hidden className="opacity-60">ⓘ</span>
      </button>

      {open ? createPortal(overlay, document.body) : null}
    </span>
  );
}
