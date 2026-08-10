"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

async function setFlag(listingId: string, flag: "hidden" | "starred" | null) {
  const sql = db();
  // Update rather than delete on clear: the row may also be carrying
  // opened_at, which must survive un-starring or un-hiding.
  await sql.query(
    `insert into user_flags (listing_id, flag) values ($1, $2)
     on conflict (listing_id) do update set flag = excluded.flag`,
    [listingId, flag],
  );
  revalidatePath("/");
}

export async function hideListing(formData: FormData) {
  await setFlag(String(formData.get("id")), "hidden");
}

export async function starListing(formData: FormData) {
  await setFlag(String(formData.get("id")), "starred");
}

export async function clearFlag(formData: FormData) {
  await setFlag(String(formData.get("id")), null);
}

/**
 * Records that the ad was opened. Deliberately does not revalidate: the click
 * opens a new tab, and re-sorting the list under the user at that moment
 * would be disorienting. The card updates optimistically on the client and
 * the server state shows up on the next load.
 */
export async function markOpened(listingId: string) {
  const sql = db();
  await sql.query(
    `insert into user_flags (listing_id, opened_at) values ($1, now())
     on conflict (listing_id) do update set opened_at = now()`,
    [listingId],
  );
}
