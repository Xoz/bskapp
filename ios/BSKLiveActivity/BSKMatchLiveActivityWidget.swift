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
                    Text("BSK").font(.caption.bold()).foregroundStyle(accent)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(context.state.opponent).font(.caption.bold()).lineLimit(1)
                }
                DynamicIslandExpandedRegion(.center) {
                    score(context.state).font(.title2.bold())
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack {
                        Text(phaseLabel(context.state)).font(.caption2.bold()).foregroundStyle(.secondary)
                        Spacer()
                        activityTime(context.state).font(.headline.monospacedDigit())
                    }
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
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 5) {
                Label(phaseLabel(context.state), systemImage: context.state.phase == "countdown" ? "calendar.badge.clock" : "sportscourt.fill")
                    .font(.system(size: 9, weight: .black))
                    .tracking(1.1)
                    .foregroundStyle(accent)
                HStack(spacing: 6) {
                    Text("BSK").font(.system(size: 17, weight: .black, design: .rounded))
                    Text("mot").font(.caption.bold()).foregroundStyle(.secondary)
                    Text(context.state.opponent)
                        .font(.system(size: 17, weight: .bold, design: .rounded))
                        .lineLimit(1)
                        .minimumScaleFactor(0.72)
                }
            }
            Spacer(minLength: 8)
            VStack(alignment: .trailing, spacing: 4) {
                score(context.state)
                    .font(.system(size: 29, weight: .black, design: .rounded))
                    .monospacedDigit()
                HStack(spacing: 6) {
                    Text(context.state.phase == "live" ? "P\(context.state.period)/\(context.state.periods)" : phaseLabel(context.state))
                        .font(.system(size: 10, weight: .black))
                        .foregroundStyle(.secondary)
                    activityTime(context.state)
                        .font(.system(size: 15, weight: .black, design: .rounded))
                        .monospacedDigit()
                        .foregroundStyle(accent)
                }
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
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
            Text(matchStartAt, style: .timer)
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
