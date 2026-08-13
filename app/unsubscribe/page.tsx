import { db } from "@/lib/db";

export default async function UnsubscribePage({ searchParams }: PageProps<"/unsubscribe">) {
  const { token } = await searchParams;
  let unsubscribed = false;

  if (typeof token === "string" && token) {
    const sql = db();
    const rows = (await sql.query(
      "update alert_settings set enabled = false where id = 1 and unsub_token = $1 returning id",
      [token],
    )) as { id: number }[];
    unsubscribed = rows.length > 0;
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-xs space-y-2 text-center">
        <h1 className="text-lg font-semibold tracking-tight">Offroad Deals</h1>
        <p className="text-sm text-neutral-400">
          {unsubscribed
            ? "You've been unsubscribed. No more deal alert emails will be sent."
            : "That unsubscribe link is invalid or already used."}
        </p>
      </div>
    </main>
  );
}
