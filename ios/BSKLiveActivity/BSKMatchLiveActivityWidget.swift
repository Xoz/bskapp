import ActivityKit
import SwiftUI
import WidgetKit

struct BSKMatchLiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: BSKMatchLiveActivityAttributes.self) { context in
            lockScreenView(context)
                .activityBackgroundTint(Color(red: 0.05, green: 0.08, blue: 0.10))
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Text("BSK")
                        .font(.headline.bold())
                        .foregroundStyle(accent)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(context.state.opponent)
                        .font(.headline.bold())
                        .lineLimit(1)
                }
                DynamicIslandExpandedRegion(.center) {
                    score(context.state)
                        .font(.system(size: 34, weight: .black, design: .rounded))
                        .monospacedDigit()
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack {
                        Text(phaseLabel(context.state))
                            .font(.caption.bold())
                            .foregroundStyle(.secondary)
                        Spacer()
                        activityTime(context.state)
                            .font(.title3.bold().monospacedDigit())
                    }
                    .padding(.top, 4)
                }
            } compactLeading: {
                Text("BSK").font(.caption2.bold()).foregroundStyle(accent)
            } compactTrailing: {
                score(context.state).font(.caption.bold())
            } minimal: {
                Text("\(context.state.ourScore)-\(context.state.opponentScore)").font(.caption2.bold())
            }
        }
    }

    private let accent = Color(red: 23 / 255, green: 201 / 255, blue: 100 / 255)

    private func lockScreenView(_ context: ActivityViewContext<BSKMatchLiveActivityAttributes>) -> some View {
        VStack(spacing: 13) {
            HStack(alignment: .center) {
                Label(phaseLabel(context.state), systemImage: context.state.phase == "countdown" ? "calendar.badge.clock" : "sportscourt.fill")
                    .font(.system(size: 11, weight: .black))
                    .tracking(1.3)
                    .foregroundStyle(accent)
                Spacer()
                Text(context.state.phase == "live" ? "PERIOD \(context.state.period) AV \(context.state.periods)" : "MATCHDAG")
                    .font(.system(size: 10, weight: .black))
                    .tracking(0.8)
                    .foregroundStyle(.secondary)
            }

            HStack(alignment: .center, spacing: 14) {
                VStack(alignment: .leading, spacing: 3) {
                    Text("BSK")
                        .font(.system(size: 24, weight: .black, design: .rounded))
                        .foregroundStyle(.white)
                    Text(context.state.opponent)
                        .font(.system(size: 19, weight: .bold, design: .rounded))
                        .foregroundStyle(.white.opacity(0.82))
                        .lineLimit(1)
                        .minimumScaleFactor(0.68)
                }
                Spacer(minLength: 8)
                score(context.state)
                    .font(.system(size: 43, weight: .black, design: .rounded))
                    .monospacedDigit()
            }

            HStack {
                Text(context.state.phase == "countdown" ? "NÄSTA MATCH" : phaseLabel(context.state))
                    .font(.system(size: 10, weight: .black))
                    .tracking(1)
                    .foregroundStyle(.secondary)
                Spacer()
                activityTime(context.state)
                    .font(.system(size: 19, weight: .black, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(accent)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
    }

    private func score(_ state: BSKMatchLiveActivityAttributes.ContentState) -> some View {
        HStack(spacing: 2) {
            Text("\(state.ourScore)").foregroundStyle(accent)
            Text("-").foregroundStyle(.secondary)
            Text("\(state.opponentScore)")
        }
    }

    private func phaseLabel(_ state: BSKMatchLiveActivityAttributes.ContentState) -> String {
        switch state.phase {
        case "countdown": return "SAMLING"
        case "ready": return "AVSPARK NU"
        case "finished": return "MATCH SLUT"
        default: return "MATCH LIVE"
        }
    }

    @ViewBuilder
    private func activityTime(_ state: BSKMatchLiveActivityAttributes.ContentState) -> some View {
        if state.phase == "countdown", let matchStartAt = state.matchStartAt {
            TimelineView(.periodic(from: .now, by: 60)) { timeline in
                let minutes = max(0, Int(ceil(matchStartAt.timeIntervalSince(timeline.date) / 60)))
                Text("Avspark om \(minutes) \(minutes == 1 ? "minut" : "minuter")")
            }
        } else if state.phase == "ready" {
            Text("STARTA KLOCKAN")
        } else {
            clock(state)
        }
    }

    @ViewBuilder
    private func clock(_ state: BSKMatchLiveActivityAttributes.ContentState) -> some View {
        if state.clockRunning, let startedAt = state.clockStartedAt {
            Text(startedAt, style: .timer)
        } else {
            Text(String(format: "%02d:%02d", state.clockSeconds / 60, state.clockSeconds % 60))
        }
    }
}
