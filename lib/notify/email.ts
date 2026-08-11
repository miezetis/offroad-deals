/**
 * Deal-alert emails via Resend's HTTP API. Plain fetch, no SDK: the only
 * thing needed here is one POST call. Mirrors lib/scrape/brightdata.ts.
 *
 * Sends from onboarding@resend.dev by default, Resend's shared sandbox
 * address that works with no domain setup. Set RESEND_FROM once a custom
 * domain is verified in the Resend dashboard.
 */

const API = "https://api.resend.com/emails";

export function emailAvailable() {
  return Boolean(process.env.RESEND_API_KEY && process.env.ALERT_EMAIL_TO);
}

type Deal = { title: string; url: string; country: string; price_eur: string; score: number };

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export async function sendDealAlert(deals: Deal[]): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.ALERT_EMAIL_TO;
  if (!apiKey || !to || deals.length === 0) return;

  const rows = deals
    .map(
      (d) => `<tr>
        <td style="padding:6px 10px;font-weight:bold">${d.score}</td>
        <td style="padding:6px 10px">${escapeHtml(d.title)}</td>
        <td style="padding:6px 10px">${Math.round(Number(d.price_eur))} EUR</td>
        <td style="padding:6px 10px">${escapeHtml(d.country)}</td>
        <td style="padding:6px 10px"><a href="${escapeHtml(d.url)}">listing</a></td>
      </tr>`,
    )
    .join("");

  const html = `<p>${deals.length} new deal${deals.length > 1 ? "s" : ""} scored 70+:</p>
    <table cellspacing="0" style="border-collapse:collapse">
      <tr><th align="left">Score</th><th align="left">Title</th><th align="left">Price</th><th align="left">Country</th><th></th></tr>
      ${rows}
    </table>
    <p><a href="https://offroad.miezetis.com">offroad.miezetis.com</a></p>`;

  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: process.env.RESEND_FROM ?? "onboarding@resend.dev",
        to,
        subject: `${deals.length} new offroad deal${deals.length > 1 ? "s" : ""}`,
        html,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) console.log(`email: resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
  } catch (err) {
    console.log(`email: send failed: ${(err as Error).message.slice(0, 120)}`);
  }
}
