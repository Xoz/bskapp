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
        <h1 className="text-[1.7rem] font-bold mt-0.5">Samtal</h1>
        <p className="text-sm mt-1" style={{ color: "var(--ink-soft)" }}>
          {intervjuer.length === 0
            ? "Inga samtal än."
            : `${intervjuer.length} samtal · spelarnas egna AI-intervjuer`}
        </p>
      </div>

      {intervjuer.length === 0 ? (
        <div className="rounded-2xl flex flex-col items-center gap-3 py-14 text-center max-w-2xl" style={{ background: "var(--bg2)", border: "1px solid var(--line)" }}>
          <span className="text-4xl">💬</span>
          <p className="text-sm" style={{ color: "var(--ink-faint)" }}>
            Spelarna når intervjun via landningssidan eller direkt på{" "}
            <span style={{ color: "var(--primary-fg)", fontFamily: "var(--font-display)" }}>/intervju</span>
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
