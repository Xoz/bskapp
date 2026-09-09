import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { all } from "@/lib/db";
export const dynamic = "force-dynamic";
export default async function TrainingPage() {
  const user = await getCurrentUser();
  if (!user?.permissions.includes("manage_evaluations")) redirect("/idag");
  const plans = await all<{ id: string; title: string; date: string }>(
    "SELECT id,document->>'title' AS title,document->>'date' AS date FROM training_plans WHERE created_by=? ORDER BY updated_at DESC",
    [user.id],
  );
  return (
    <div className="core-page">
      <header className="core-header">
        <div>
          <p className="core-kicker">Träning</p>
          <h1 className="core-title">Mina träningspass</h1>
          <p className="core-lead">
            Välj övningar, justera ritningen och sätt ihop passet.
          </p>
        </div>
        <Link className="btn-primary" href="/traning/nytt">
          Nytt träningspass
        </Link>
      </header>
      {plans.length ? (
        <div className="core-list core-list-2">
          {plans.map((p) => (
            <Link
              className="core-panel p-5"
              key={p.id}
              href={`/traning/${p.id}`}
            >
              <h2>{p.title}</h2>
              <p className="caption">{p.date || "Datum ej valt"}</p>
            </Link>
          ))}
        </div>
      ) : (
        <p className="core-panel p-5">
          Börja med ett nytt pass. Där finns 15 färdiga övningar att välja från.
        </p>
      )}
    </div>
  );
}
