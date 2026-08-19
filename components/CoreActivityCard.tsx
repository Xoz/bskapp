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
  const [year, month, day] = activity.activity_date.split("-").map(Number);
  const monthLabel = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"][month - 1] ?? "";
  const teamTone = activity.source_team === "Gul" ? "yellow" : activity.source_team === "Grön" ? "green" : "blue";
  const isSanktan = activity.external_source === "svenskalag_sanktan";
  return (
    <Link href={href} className="core-activity">
      <time className="core-date" dateTime={activity.activity_date}>
        <strong>{String(day).padStart(2, "0")}</strong>
        <span>{monthLabel} {String(year).slice(-2)}</span>
      </time>
      <div className="min-w-0 flex-1">
        <div className="core-tags">
          <span className={`core-tag core-tag-${activity.activity_type}`}>{TYPE_LABEL[activity.activity_type]}</span>
          {activity.is_upcoming && <span className="badge badge-primary">Kommande</span>}
          {activity.source_team && (
            <span className="core-team-tag" data-team-tone={teamTone}>{activity.source_team}</span>
          )}
          {isSanktan && activity.competition_level && (
            <span className="badge">Sanktan nivå {activity.competition_level}</span>
          )}
          {activity.start_time && <span>{activity.start_time}</span>}
        </div>
        <h3 className="core-activity-title">{activity.title}</h3>
        {activity.is_upcoming ? (
          activity.called_player_names.length > 0 ? (
            <>
              <p className="core-activity-players">
                <strong>Kallade ({activity.called_player_names.length}):</strong> {activity.called_player_names.join(", ")}
              </p>
              {activity.declined_player_names.length > 0 && (
                <p className="core-activity-declined">
                  <strong>Tackat nej ({activity.declined_player_names.length}):</strong> {activity.declined_player_names.join(", ")}
                </p>
              )}
            </>
          ) : <p className="core-activity-sub">Ingen kallelse registrerad ännu</p>
        ) : activity.activity_type === "match" && activity.participant_names.length > 0 ? (
          <p className="core-activity-players">
            <strong>Spelade ({activity.participant_names.length}):</strong> {activity.participant_names.join(", ")}
          </p>
        ) : (
          <p className="core-activity-sub">{activity.theme ? `Fokus: ${activity.theme}` : "Fokus inte satt"}</p>
        )}
      </div>
      <div className="core-count" title="Sparade observationer">
        <strong>{activity.observation_count}</strong>
        <span>obs.</span>
      </div>
      <span className="core-chevron" aria-hidden>›</span>
    </Link>
  );
}
