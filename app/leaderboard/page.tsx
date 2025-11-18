import { Navigation } from "@/components/navigation";
import { BottomNav } from "@/components/bottom-nav";
import { Trophy, Medal } from "lucide-react";
import { db } from "@/lib/db";
import { gameResults, user } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

// Disable caching to always fetch fresh leaderboard data
export const revalidate = 0;

async function getTopPlayers() {
  try {
    const results = await db
      .select({
        wpm: gameResults.wpm,
        accuracy: gameResults.accuracy,
        duration: gameResults.duration,
        playerName: user.name,
        createdAt: gameResults.createdAt,
      })
      .from(gameResults)
      .leftJoin(user, eq(gameResults.userId, user.id))
      .orderBy(desc(gameResults.wpm))
      .limit(10);

    return results;
  } catch (error) {
    console.error("Error fetching top players:", error);
    return [];
  }
}

export default async function LeaderboardPage() {
  const topPlayers = await getTopPlayers();

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <Navigation />
      <BottomNav />
      <div className="pt-24 pb-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-large md:text-xlarge font-normal leading-none tracking-tighter mb-12">
            <span className="text-orange-500">LEADERBOARD</span>
          </h1>

          {topPlayers.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <p className="text-medium">No results yet. Be the first to set a record!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {topPlayers.map((player, index) => (
                <div
                  key={index}
                  className={`flex items-center gap-4 py-4 ${index < topPlayers.length - 1 ? 'border-b border-border' : ''}`}
                >
                  <div className="flex items-center justify-center w-12 h-12">
                    {index === 0 ? (
                      <Trophy className="w-8 h-8 text-yellow-500" />
                    ) : index === 1 ? (
                      <Medal className="w-8 h-8 text-gray-400" />
                    ) : index === 2 ? (
                      <Medal className="w-8 h-8 text-amber-600" />
                    ) : (
                      <span className="text-large font-bold text-muted-foreground tabular-nums">
                        {index + 1}
                      </span>
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="font-medium text-foreground">
                      {player.playerName || "Anonymous"}
                    </div>
                    <div className="text-small text-muted-foreground">
                      {player.accuracy}% accuracy • {player.duration}s
                    </div>
                  </div>

                  <div className="text-right flex items-center">
                    <div className="text-large font-bold tabular-nums">{player.wpm}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

