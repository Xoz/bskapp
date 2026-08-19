import Link from "next/link";
import type { CoreActivity } from "@/lib/developmentCore";
import { sanktanLevelLabel } from "@/lib/sanktanLevel";

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
  const [year, month, day] = activity.activity_date.split("-").map(Number);
  const monthLabel = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"][month - 1] ?? "";
  const teamTone = activity.source_team === "Gul" ? "yellow" : activity.source_team === "Grön" ? "green" : "blue";
  const isSanktan = activity.external_source === "svenskalag_sanktan";
  const needsMoreAccepted = activity.is_upcoming
    && isSanktan
    && activity.called_player_names.length > 0
    && activity.accepted_callup_count < 9;
  const playersMissing = Math.max(0, 9 - activity.accepted_callup_count);
  return (
    <Link href={href} className="core-activity">
      <time className="core-date" dateTime={activity.activity_date}>
        <strong>{String(day).padStart(2, "0")}</strong>
        <span>{monthLabel} {String(year).slice(-2)}</span>
      </time>
      <div className="min-w-0 flex-1">
        {isSanktan ? (
          <div className={`core-match-meta${needsMoreAccepted ? " core-match-meta-has-warning" : ""}`}>
            {activity.source_team && (
              <span className="core-team-tag" data-team-tone={teamTone}>{activity.source_team}</span>
            )}
            {activity.competition_level && <span>{sanktanLevelLabel(activity.competition_level)}</span>}
            {needsMoreAccepted && <span className="core-understaffed-badge">Saknar {playersMissing}</span>}
            {activity.start_time && <span className="core-match-time">{activity.start_time}</span>}
          </div>
        ) : (
          <div className="core-tags">
            <span className={`core-tag core-tag-${activity.activity_type}`}>{TYPE_LABEL[activity.activity_type]}</span>
            {activity.is_upcoming && <span className="badge badge-primary">Kommande</span>}
            {activity.start_time && <span>{activity.start_time}</span>}
          </div>
        )}
        <h3 className="core-activity-title">{activity.title}</h3>
        {activity.is_upcoming ? (
          activity.called_player_names.length > 0 ? (
            <div className="core-callup-summary" aria-label="Kallelsesvar">
              <span><strong>{activity.called_player_names.length}</strong> kallade</span>
              <span className={needsMoreAccepted ? "core-callup-accepted core-callup-accepted-warning" : "core-callup-accepted"}>{activity.accepted_callup_count} ja</span>
              <span className="core-callup-declined">{activity.declined_callup_count} nej</span>
              <span>{activity.pending_callup_count} inväntar svar</span>
            </div>
          ) : <p className="core-activity-sub">Ingen kallelse registrerad ännu</p>
        ) : activity.activity_type === "match" && activity.participant_names.length > 0 ? (
          <p className="core-activity-players">
            <strong>{activity.participant_names.length} spelade</strong><span> · Trupp i matchdetaljen</span>
          </p>
        ) : (
          <p className="core-activity-sub">{activity.theme ? `Fokus: ${activity.theme}` : "Fokus inte satt"}</p>
        )}
      </div>
      <span className="core-chevron" aria-hidden>›</span>
    </Link>
  );
}
