"use server";

import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { getSession } from "@/lib/auth-server";
import { eq } from "drizzle-orm";

export async function getTimerPreference(): Promise<number> {
  try {
    const session = await getSession();

    // Return default of 30 seconds if user is not logged in
    if (!session?.user?.id) {
      return 30;
    }

    const userRecord = await db
      .select({ timerDuration: user.timerDuration })
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1);

    // Return the user's preference, or default to 30 if not found
    return userRecord[0]?.timerDuration ?? 30;
  } catch (error) {
    console.error("Error getting timer preference:", error);
    return 30; // Return default on error
  }
}

export async function setTimerPreference(timerDuration: 15 | 30): Promise<{ success: boolean }> {
  try {
    const session = await getSession();

    // Only logged-in users can save preferences
    if (!session?.user?.id) {
      throw new Error("User must be logged in to save preferences");
    }

    // Validate the timer duration
    if (timerDuration !== 15 && timerDuration !== 30) {
      throw new Error("Timer duration must be either 15 or 30 seconds");
    }

    await db
      .update(user)
      .set({ timerDuration })
      .where(eq(user.id, session.user.id));

    return { success: true };
  } catch (error) {
    console.error("Error setting timer preference:", error);
    throw new Error("Failed to save timer preference");
  }
}
