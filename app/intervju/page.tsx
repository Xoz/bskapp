import { getAllSettings } from "@/lib/db";
import { getPlayerSession } from "@/lib/auth";
import { getPlayer } from "@/lib/queries";
import InterviewChat from "@/components/InterviewChat";

export const dynamic = "force-dynamic";
export const metadata = { title: "Spelarintervju" };

export default async function IntervjuPage() {
  const [settings, playerId] = await Promise.all([getAllSettings(), getPlayerSession()]);

  let prefilledName: string | undefined;
  let prefilledPosition: string | undefined;

  if (playerId) {
    const player = await getPlayer(playerId);
    if (player?.active) {
      prefilledName = player.name.split(" ")[0]; // förnamn
      prefilledPosition = player.position || undefined;
    }
  }

  return (
    <InterviewChat
      teamName={settings.team_name ?? "BSK F2014"}
      clubName={settings.club_name ?? "Bollstanäs SK"}
      prefilledName={prefilledName}
      prefilledPosition={prefilledPosition}
    />
  );
}
