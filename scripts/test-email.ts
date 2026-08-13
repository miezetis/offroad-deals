/**
 * Sends one fake deal through the real alert path (Resend, alert_settings
 * recipient override or ALERT_EMAIL_TO) so the email pipeline can be
 * verified without waiting for a genuine new listing to qualify. Not part
 * of the scan; run via the `test-email` workflow, which has the secrets.
 */
import { db } from "../lib/db";
import { sendDealAlert } from "../lib/notify/email";

async function main() {
  const sql = db();
  const rows = (await sql.query(
    "select recipient_email, unsub_token from alert_settings where id = 1",
  )) as { recipient_email: string | null; unsub_token: string | null }[];
  const recipientOverride = rows[0]?.recipient_email ?? null;

  await sendDealAlert(
    [
      {
        title: "TEST EMAIL — Toyota Land Cruiser Prado 120 3.0 D-4D",
        url: "https://offroad.miezetis.com",
        country: "LT",
        price_eur: "9999",
        score: 91,
      },
    ],
    recipientOverride,
    rows[0]?.unsub_token ?? null,
  );

  console.log(`test-email: sent (recipient: ${recipientOverride || "ALERT_EMAIL_TO env var"})`);
}

main().catch((err) => {
  console.error("test-email failed:", err.message);
  process.exit(1);
});
