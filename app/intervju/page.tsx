import { getAllSettings } from "@/lib/db";
import InterviewChat from "@/components/InterviewChat";

export const dynamic = "force-dynamic";
export const metadata = { title: "Spelarintervju" };

export default async function IntervjuPage() {
  const settings = await getAllSettings();
  return (
    <InterviewChat
      teamName={settings.team_name ?? "BSK F2014"}
      clubName={settings.club_name ?? "Bollstanäs SK"}
    />
  );
}
