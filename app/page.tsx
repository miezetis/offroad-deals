export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 p-6">
      <header className="border-b border-neutral-800 pb-4">
        <h1 className="text-xl font-semibold tracking-tight">Offroad Deals</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Body-on-frame 4x4s, 5-10k EUR, across EE / LV / LT / FI / PL / SK / DE.
        </p>
      </header>

      <div className="mt-10 rounded-lg border border-dashed border-neutral-800 p-10 text-center">
        <p className="text-sm text-neutral-400">No listings yet.</p>
        <p className="mt-1 text-xs text-neutral-600">
          Scrapers come online in the next phase.
        </p>
      </div>
    </main>
  );
}
