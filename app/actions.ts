"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

async function setFlag(listingId: string, flag: "hidden" | "starred" | null) {
  const sql = db();
  if (flag === null) {
    await sql.query("delete from user_flags where listing_id = $1", [listingId]);
  } else {
    await sql.query(
      `insert into user_flags (listing_id, flag) values ($1, $2)
       on conflict (listing_id) do update set flag = excluded.flag, created_at = now()`,
      [listingId, flag],
    );
  }
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
