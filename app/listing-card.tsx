"use client";

import { useState, type ReactNode } from "react";
import { clearFlag, hideListing, markOpened, starListing } from "./actions";
import { ScoreBadge, type Factor } from "./score-badge";

export type CategoryScore = { label: string; points: number; max: number; detail: string };

/** Everything precomputed server-side; this component only renders it. */
export type CardData = {
  id: string;
  url: string;
  heading: string;
  subtitle: string;
  year: string | null;
  mileage: string | null;
  fuel: string | null;
  power: string | null;
  meta: string;
  price: string;
  median: string | null;
  medianNegative: boolean;
  score: number | null;
  breakdown: Factor[];
  isNew: boolean;
  priceDrop: string | null;
  imageUrl: string | null;
  verdict: string | null;
  aiScore: number | null;
  bucket: "GREEN" | "YELLOW" | "RED" | null;
  categoryBreakdown: CategoryScore[];
  risks: string[];
  inspect: string[];
  flag: string | null;
  openedAt: string | null;
};

const BUCKET_STYLE: Record<string, string> = {
  GREEN: "bg-emerald-600",
  YELLOW: "bg-amber-600",
  RED: "bg-red-600",
};

const badge = "rounded-md px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide";
const cornerBtn =
  "flex h-7 w-7 items-center justify-center rounded-full border border-neutral-700/80 bg-neutral-950/80 text-sm backdrop-blur transition-colors hover:border-neutral-500";

const iconProps = { viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.3 } as const;

function CalendarIcon() {
  return (
    <svg {...iconProps} className="h-3.5 w-3.5 shrink-0">
      <rect x="2" y="3.5" width="12" height="10.5" rx="1.5" />
      <path d="M2 6.5h12" />
      <path d="M5 2v3M11 2v3" strokeLinecap="round" />
    </svg>
  );
}

function GaugeIcon() {
  return (
    <svg {...iconProps} className="h-3.5 w-3.5 shrink-0">
      <path d="M2.5 12a5.5 5.5 0 1 1 11 0" strokeLinecap="round" />
      <path d="M8 12L10.5 8" strokeLinecap="round" />
      <circle cx="8" cy="12" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

function FuelIcon() {
  return (
    <svg {...iconProps} className="h-3.5 w-3.5 shrink-0">
      <rect x="2.5" y="3" width="6" height="11" rx="1" />
      <path d="M4.5 6.5h2" strokeLinecap="round" />
      <path d="M8.5 6.5h1.5a1.5 1.5 0 0 1 1.5 1.5v4.5a1 1 0 0 0 2 0V7.5L12 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg {...iconProps} className="h-3.5 w-3.5 shrink-0" strokeLinejoin="round">
      <path d="M8.5 2 3.5 9h3.2L7 14l5-7.5H8.8z" />
    </svg>
  );
}

function Spec({ icon, value }: { icon: ReactNode; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-neutral-800/70 px-1.5 py-0.5 text-[11px] text-neutral-300">
      {icon}
      {value}
    </span>
  );
}

export function ListingCard({ card }: { card: CardData }) {
  // Optimistic: the click opens a new tab, the fade happens immediately,
  // and the server remembers for next load.
  const [opened, setOpened] = useState(Boolean(card.openedAt));

  const open = () => {
    if (!opened) {
      setOpened(true);
      void markOpened(card.id);
    }
  };

  return (
    <li
      className={`group relative flex gap-3 rounded-xl border bg-neutral-900/40 p-3 transition-all sm:gap-4 sm:p-4 ${
        opened
          ? "border-neutral-800/50 opacity-55 hover:opacity-100"
          : "border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900/70"
      }`}
    >
      <a
        href={card.url}
        target="_blank"
        rel="noreferrer"
        onClick={open}
        className="relative h-28 w-32 shrink-0 self-start overflow-hidden rounded-lg bg-neutral-900 ring-1 ring-neutral-800 sm:h-32 sm:w-44"
      >
        {card.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.imageUrl}
            alt=""
            className={`h-full w-full object-cover transition duration-300 group-hover:scale-[1.03] ${opened ? "grayscale" : ""}`}
            loading="lazy"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-xs text-neutral-700">
            no photo
          </span>
        )}
        {opened ? (
          <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-neutral-300">
            seen
          </span>
        ) : null}
      </a>

      <div className="min-w-0 flex-1 pr-9 sm:pr-10">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {card.score != null ? <ScoreBadge score={card.score} breakdown={card.breakdown} /> : null}
            {card.bucket ? (
              <span className={`${badge} text-white ${BUCKET_STYLE[card.bucket]}`} title="Blueprint scoring bucket">
                {card.bucket}
              </span>
            ) : null}
            {card.isNew && !opened ? <span className={`${badge} bg-sky-600 text-white`}>new</span> : null}
            {card.priceDrop ? (
              <span className={`${badge} bg-purple-600 text-white`}>↓ {card.priceDrop}</span>
            ) : null}
          </div>

          <div className="text-right">
            <div className="text-lg font-semibold tracking-tight text-neutral-100">{card.price}</div>
            {card.median ? (
              <div className={`text-xs ${card.medianNegative ? "text-emerald-500" : "text-neutral-500"}`}>
                {card.median}
              </div>
            ) : null}
          </div>
        </div>

        <a
          href={card.url}
          target="_blank"
          rel="noreferrer"
          onClick={open}
          className={`mt-1.5 block font-semibold leading-snug hover:underline ${
            opened ? "text-neutral-400" : "text-neutral-100"
          }`}
        >
          {card.heading}
        </a>
        <a
          href={card.url}
          target="_blank"
          rel="noreferrer"
          onClick={open}
          className="line-clamp-1 text-sm text-neutral-500 hover:underline"
        >
          {card.subtitle}
        </a>

        <div className="mt-2 flex flex-wrap gap-1">
          {card.year ? <Spec icon={<CalendarIcon />} value={card.year} /> : null}
          {card.mileage ? <Spec icon={<GaugeIcon />} value={card.mileage} /> : null}
          {card.fuel ? <Spec icon={<FuelIcon />} value={card.fuel} /> : null}
          {card.power ? <Spec icon={<BoltIcon />} value={card.power} /> : null}
        </div>

        <p className="mt-2 text-xs text-neutral-500">{card.meta}</p>

        {card.verdict ? (
          <details className="mt-2 text-sm">
            <summary className="cursor-pointer select-none text-neutral-400 hover:text-neutral-200">
              AI verdict{card.aiScore != null ? ` · ${card.aiScore}/100` : ""}
            </summary>
            <div className="mt-2 space-y-2 rounded-lg border border-neutral-800 bg-neutral-900/70 p-3 text-neutral-300">
              <p>{card.verdict}</p>
              {card.risks.length ? <p className="text-red-400">Risks: {card.risks.join(" · ")}</p> : null}
              {card.inspect.length ? (
                <p className="text-amber-400">Inspect: {card.inspect.join(" · ")}</p>
              ) : null}
              {card.categoryBreakdown.length ? (
                <ul className="space-y-1 border-t border-neutral-800 pt-2">
                  {card.categoryBreakdown.map((f, i) => (
                    <li key={i} className="flex gap-2 text-xs">
                      <span className="w-12 shrink-0 text-right font-mono font-semibold text-neutral-400">
                        {f.points}/{f.max}
                      </span>
                      <span className="min-w-0">
                        <span className="font-medium text-neutral-200">{f.label}</span>
                        <span className="block leading-snug text-neutral-500">{f.detail}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </details>
        ) : null}
      </div>

      <div className="absolute right-3 top-3 flex flex-col gap-1.5 sm:right-4 sm:top-4">
        {card.flag ? (
          <form action={clearFlag}>
            <input type="hidden" name="id" value={card.id} />
            <button className={`${cornerBtn} text-neutral-400`} title="Restore">↺</button>
          </form>
        ) : (
          <>
            <form action={starListing}>
              <input type="hidden" name="id" value={card.id} />
              <button className={`${cornerBtn} text-amber-400`} title="Star">★</button>
            </form>
            <form action={hideListing}>
              <input type="hidden" name="id" value={card.id} />
              <button className={`${cornerBtn} text-neutral-500`} title="Hide">✕</button>
            </form>
          </>
        )}
      </div>
    </li>
  );
}
