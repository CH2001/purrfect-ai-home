import { createHash } from "node:crypto";
import { database } from "./firebase";
import { accountRef } from "./repository";

export async function dispatchReminders() {
  const now = new Date().toISOString();
  let sent = 0;
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  do {
    let query = database().collection("reviewDueIndex").where("remindersEnabled", "==", true).where("nextReviewDueAt", "<=", now).orderBy("nextReviewDueAt").limit(100);
    if (cursor) query = query.startAfter(cursor);
    const page = await query.get();
    for (const item of page.docs) {
      const delivered = await database().runTransaction(async tx => {
        const root = accountRef(item.id);
        const user = await tx.get(root);
        const data = user.data();
        const review = data?.review;
        if (!data || data.deleting || !review?.remindersEnabled || review.nextReviewDueAt > now || (review.snoozedUntil && review.snoozedUntil > now) || review.dismissedForWindow === review.nextReviewDueAt) return false;
        const id = createHash("sha256").update(review.nextReviewDueAt).digest("hex");
        const notification = root.collection("notifications").doc(id);
        if ((await tx.get(notification)).exists) return false;
        tx.create(notification, { id, title: "Time for your profile check-in", at: now, read: false, link: "/review" });
        return true;
      });
      if (delivered) sent++;
    }
    cursor = page.size === 100 ? page.docs.at(-1) : undefined;
  } while (cursor);
  return { sent };
}
