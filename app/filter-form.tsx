"use client";

import type { FocusEvent, FormEvent, ReactNode } from "react";

/**
 * GET form that submits itself so filtering feels instant and the URL stays
 * shareable. Selects submit on change (discrete choice, no reason to wait).
 * Number inputs submit on blur instead, so typing "1990" doesn't fire four
 * requests for "1", "19", "199", "1990".
 *
 * Rendered as a vertical sidebar (AutoScout24-style filter rail) rather than
 * a wrapping top bar.
 */
export function FilterForm({ children }: { children: ReactNode }) {
  const onChange = (e: FormEvent<HTMLFormElement>) => {
    if ((e.target as HTMLElement).tagName === "SELECT") {
      e.currentTarget.requestSubmit();
    }
  };
  const onBlur = (e: FocusEvent<HTMLFormElement>) => {
    if ((e.target as HTMLElement).tagName === "INPUT") {
      e.currentTarget.requestSubmit();
    }
  };

  return (
    <form method="get" onChange={onChange} onBlur={onBlur} className="flex flex-col gap-4">
      {children}
    </form>
  );
}

/** Labelled wrapper so every control is self-explanatory at a glance. */
export function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 border-b border-neutral-800/70 pb-3.5 last:border-0 last:pb-0">
      <span className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </span>
      {children}
    </label>
  );
}

/** A single removable "Model: X ✕" pill shown above the results list. */
export function FilterChip({ label, href }: { label: string; href: string }) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-1.5 rounded-full border border-neutral-700 bg-neutral-900 px-3 py-1 text-xs font-medium text-neutral-200 transition-colors hover:border-neutral-500"
    >
      {label}
      <span aria-hidden className="text-neutral-500">✕</span>
    </a>
  );
}
