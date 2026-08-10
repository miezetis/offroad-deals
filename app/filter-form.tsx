"use client";

import type { ReactNode } from "react";

/**
 * GET form that submits itself whenever any control changes, so filtering
 * feels instant and the URL stays shareable. Server-rendered selects pass
 * through as children.
 */
export function FilterForm({ children }: { children: ReactNode }) {
  return (
    <form
      method="get"
      onChange={(e) => e.currentTarget.requestSubmit()}
      className="flex gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] sm:flex-wrap sm:overflow-visible"
    >
      {children}
    </form>
  );
}
