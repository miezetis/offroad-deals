"use client";

import { useState } from "react";
import { clearFlag, hideListing, markOpened, starListing } from "./actions";

/** Everything precomputed server-side; this component only renders it. */
export type CardData = {
  id: string;
  url: string;
  title: string;
  chips: string[];
  price: string;
  landed: string | null;
  median: string | null;
  medianNegative: boolean;
  score: number | null;
  isNew: boolean;
  priceDrop: string | null;
  imageUrl: string | null;
  verdict: string | null;
  aiScore: number | null;
  risks: string[];
  inspect: string[];
  flag: string | null;
  openedAt: string | null;
};

function scoreColor(score: number) {
  if (score >= 75) return "bg-emerald-600";
  if (score >= 55) return "bg-amber-600";
  return "bg-neutral-700";
}

const badge = "rounded-md px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide";
const iconBtn =
  "rounded-lg border border-neutral-800 px-2.5 py-1.5 text-xs transition-colors hover:border-neutral-600 hover:bg-neutral-800";

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
        className="relative h-24 w-28 shrink-0 self-start overflow-hidden rounded-lg bg-neutral-900 ring-1 ring-neutral-800 sm:h-28 sm:w-40"
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

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {card.score != null ? (
            <span className={`${badge} text-white ${scoreColor(card.score)}`}>{card.score}</span>
          ) : null}
          {card.isNew && !opened ? (
            <span className={`${badge} bg-sky-600 text-white`}>new</span>
          ) : null}
          {card.priceDrop ? (
            <span className={`${badge} bg-purple-600 text-white`}>↓ {card.priceDrop}</span>
          ) : null}
        </div>

        <a
          href={card.url}
          target="_blank"
          rel="noreferrer"
          onClick={open}
          className={`mt-1 line-clamp-2 font-medium leading-snug hover:underline ${
            opened ? "text-neutral-400" : "text-neutral-100"
          }`}
        >
          {card.title}
        </a>

        <div className="mt-1.5 flex flex-wrap gap-1">
          {card.chips.map((chip, i) => (
            <span
              key={i}
              className="rounded-md bg-neutral-800/70 px-1.5 py-0.5 text-[11px] text-neutral-400"
            >
              {chip}
            </span>
          ))}
        </div>

        <p className="mt-2 text-sm">
          <span className="text-lg font-semibold tracking-tight">{card.price}</span>
          {card.landed ? <span className="text-neutral-500"> · ~{card.landed} landed</span> : null}
          {card.median ? (
            <span className={card.medianNegative ? "text-emerald-500" : "text-neutral-500"}>
              {" "}· {card.median}
            </span>
          ) : null}
        </p>

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
            </div>
          </details>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-col gap-1.5">
        {card.flag ? (
          <form action={clearFlag}>
            <input type="hidden" name="id" value={card.id} />
            <button className={`${iconBtn} text-neutral-400`} title="Restore">undo</button>
          </form>
        ) : (
          <>
            <form action={starListing}>
              <input type="hidden" name="id" value={card.id} />
              <button className={`${iconBtn} text-amber-400`} title="Star">★</button>
            </form>
            <form action={hideListing}>
              <input type="hidden" name="id" value={card.id} />
              <button className={`${iconBtn} text-neutral-500`} title="Hide">✕</button>
            </form>
          </>
        )}
      </div>
    </li>
  );
}
