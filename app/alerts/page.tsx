import { db } from "@/lib/db";
import { updateAlertSettings } from "../actions";

export const dynamic = "force-dynamic";

type Settings = {
  enabled: boolean;
  min_score: number;
  frequency_hours: number;
  recipient_email: string | null;
  last_sent_at: string | null;
};

const FREQUENCIES = [
  { value: 0, label: "Every scan — no limit" },
  { value: 1, label: "At most every 1 hour" },
  { value: 6, label: "At most every 6 hours" },
  { value: 12, label: "At most every 12 hours" },
  { value: 24, label: "At most every 24 hours" },
  { value: 168, label: "At most every 7 days" },
];

function ago(date: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(date).getTime()) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  return hours < 48 ? `${hours} h ago` : `${Math.round(hours / 24)} d ago`;
}

const field =
  "w-full rounded-lg border border-neutral-800 bg-neutral-900/80 px-3 py-2 text-sm outline-none focus:border-neutral-500";

export default async function AlertsPage() {
  const sql = db();
  const rows = (await sql.query(
    "select enabled, min_score, frequency_hours, recipient_email, last_sent_at from alert_settings where id = 1",
  )) as Settings[];
  const s: Settings = rows[0] ?? {
    enabled: true, min_score: 70, frequency_hours: 0, recipient_email: null, last_sent_at: null,
  };

  return (
    <div className="min-h-screen bg-black">
      <header className="sticky top-0 z-10 border-b border-neutral-800 bg-neutral-950">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-4 py-3">
          <a href="/" className="text-lg font-semibold tracking-tight text-neutral-100 hover:text-neutral-300">
            ← Offroad<span className="text-emerald-500">Deals</span>
          </a>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 py-6">
        <h1 className="text-xl font-semibold text-neutral-100">Deal alerts</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Email when a new listing scores at or above the threshold below. Checked at the end of
          every scan run (every 30 minutes) — this only limits how often you're emailed, not how
          often the site scans.
        </p>

        <form action={updateAlertSettings} className="mt-6 space-y-5 rounded-xl border border-neutral-800 bg-neutral-950 p-5">
          <label className="flex items-center gap-2 text-sm text-neutral-200">
            <input
              type="checkbox" name="enabled" defaultChecked={s.enabled}
              className="h-4 w-4 rounded border-neutral-700 bg-neutral-900 accent-emerald-600"
            />
            Alerts enabled
          </label>

          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Minimum score</span>
            <input
              type="number" name="minScore" min={0} max={100} defaultValue={s.min_score}
              className={`${field} mt-1`}
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Frequency</span>
            <select name="frequencyHours" defaultValue={s.frequency_hours} className={`${field} mt-1`}>
              {FREQUENCIES.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              Send to (optional override)
            </span>
            <input
              type="email" name="recipientEmail" placeholder="uses ALERT_EMAIL_TO if left blank"
              defaultValue={s.recipient_email ?? ""} className={`${field} mt-1`}
            />
          </label>

          <button
            type="submit"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
          >
            Save
          </button>
        </form>

        <p className="mt-4 text-xs text-neutral-500">
          {s.last_sent_at ? `Last alert email sent ${ago(s.last_sent_at)}.` : "No alert email sent yet."}
        </p>
      </main>
    </div>
  );
}
