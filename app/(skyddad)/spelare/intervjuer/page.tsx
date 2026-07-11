import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/auth";
import { getIntervjuer } from "@/lib/queries";
import IntervjuCard from "@/components/IntervjuCard";
import SpelareTabs from "@/components/SpelareTabs";

export const dynamic = "force-dynamic";
export const metadata = { title: "Spelarsamtal" };

export default async function IntervjuerPage() {
  if (!(await hasPermission("view_interviews"))) redirect("/oversikt?behorighet=saknas");
  const intervjuer = await getIntervjuer();

  return (
    <div className="space-y-6">
      <SpelareTabs canViewInterviews />
      <div>
        <p className="eyebrow">Truppen</p>
        <h1 className="text-[32px] font-bold mt-0.5">Samtal</h1>
        <p className="body-small mt-1" style={{ color: "var(--ink-secondary)" }}>
          {intervjuer.length === 0
            ? "Inga samtal än."
            : `${intervjuer.length} samtal · spelarnas egna AI-intervjuer`}
        </p>
      </div>

      {intervjuer.length === 0 ? (
        <div className="rounded-2xl flex flex-col items-center gap-3 py-14 text-center max-w-2xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <span className="text-4xl">💬</span>
          <p className="body-small" style={{ color: "var(--ink-muted)" }}>
            Spelarna når intervjun via landningssidan eller direkt på{" "}
            <span style={{ color: "var(--primary)", fontFamily: "var(--font-display)" }}>/intervju</span>
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-w-2xl">
          {await Promise.all(intervjuer.map(async (iv) => <IntervjuCard key={iv.id} intervju={iv} />))}
        </div>
      )}
    </div>
  );
}
