import { notFound } from "next/navigation";
import { getPublicEvaluationWorkspace } from "@/lib/matchEvaluation";
import { savePublicMatchEvaluations } from "@/lib/actions";
import MatchEvaluationForm from "@/components/MatchEvaluationForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Matchutvärdering" };
export default async function PublicMatchEvaluationPage({ params, searchParams }: {
  params: Promise<{ token: string }>; searchParams: Promise<{ sparad?: string }>;
}) {
  const token = (await params).token;
  const workspace = await getPublicEvaluationWorkspace(token);
  if (!workspace) notFound();
  const save = savePublicMatchEvaluations.bind(null, token);
  const { sparad } = await searchParams;
  return <main className="flex-1 p-4 sm:p-6 max-w-3xl w-full mx-auto" style={{ paddingTop: "max(1.5rem, env(safe-area-inset-top))" }}>
    <header className="core-header"><div className="core-header-copy"><p className="core-kicker">Matchutvärdering · {workspace.invite.label}</p>
      <h1 className="core-title">{workspace.match.opponent}</h1>
      <p className="core-lead">{workspace.match.date} · Bedöm en spelare i taget eller hoppa över om hon inte går att bedöma.</p></div></header>
    {sparad && <div className="core-panel p-4 mb-4"><p className="body-small">Tack, utvärderingen är sparad. Länken kan användas igen för att justera svar.</p></div>}
    {workspace.players.length ? <MatchEvaluationForm players={workspace.players} saveAction={save} /> :
      <div className="core-panel p-6"><p>Det finns ingen registrerad matchtrupp att utvärdera.</p></div>}
  </main>;
}
