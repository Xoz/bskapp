import Link from "next/link";
import type { CoreActivity } from "@/lib/developmentCore";

const TYPE_LABEL: Record<CoreActivity["activity_type"], string> = {
  training: "Träning",
  match: "Match",
  other: "Aktivitet",
};

export default function CoreActivityCard({
  activity,
  href,
}: {
  activity: CoreActivity;
  href: string;
}) {
  return (
    <Link href={href} className="card block p-4 transition-transform hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="badge">{TYPE_LABEL[activity.activity_type]}</span>
            {activity.external_source.startsWith("svenskalag") && (
              <span className="caption" style={{ color: "var(--ink-muted)" }}>Svenska Lag</span>
            )}
          </div>
          <h3 className="mt-2 text-lg font-semibold">{activity.title}</h3>
          <p className="body-small mt-1" style={{ color: "var(--ink-secondary)" }}>
            {activity.activity_date}{activity.start_time ? ` · ${activity.start_time}` : ""}
          </p>
          {activity.theme && (
            <p className="body-small mt-2" style={{ color: "var(--ink-secondary)" }}>
              Fokus: {activity.theme}
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          <strong className="block text-xl">{activity.observation_count}</strong>
          <span className="caption" style={{ color: "var(--ink-muted)" }}>observationer</span>
        </div>
      </div>
    </Link>
  );
}
