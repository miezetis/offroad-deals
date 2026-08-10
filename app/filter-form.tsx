"use client";

import type { FocusEvent, FormEvent, ReactNode } from "react";

/**
 * GET form that submits itself so filtering feels instant and the URL stays
 * shareable. Selects submit on change (discrete choice, no reason to wait).
 * Number inputs submit on blur instead, so typing "1990" doesn't fire four
 * requests for "1", "19", "199", "1990".
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
    <form
      method="get"
      onChange={onChange}
      onBlur={onBlur}
      className="grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap sm:items-end sm:gap-2"
    >
      {children}
    </form>
  );
}

/** Labelled wrapper so every control is self-explanatory at a glance. */
export function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 sm:w-36">
      <span className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </span>
      {children}
    </label>
  );
}
