import ActivityKit
import Foundation

@available(iOS 16.1, *)
enum MatchLiveActivityManager {
    static let gatheringLeadTime: TimeInterval = 45 * 60
    private static let matchWindowLength: TimeInterval = 6 * 60 * 60

    static func shouldSync(date: String, time: String?, now: Date = Date()) -> Bool {
        guard let matchStartAt = matchStartDate(date: date, time: time) else { return false }
        return now >= matchStartAt.addingTimeInterval(-gatheringLeadTime)
            && now <= matchStartAt.addingTimeInterval(matchWindowLength)
    }

    static func sync(matchID: Int, title: String, state: LiveMatchState, isEnabled: Bool = true) async {
        guard isEnabled else {
            await end(matchID: matchID)
            return
        }
        let existing = Activity<BSKMatchLiveActivityAttributes>.activities.first {
            $0.attributes.matchID == matchID
        }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }

        let now = Date()
        let matchStartAt = matchStartDate(date: state.date, time: state.startTime)
        if state.finished {
            guard let existing else { return }
            let content = content(for: state, phase: "finished", matchStartAt: matchStartAt)
            await existing.end(content, dismissalPolicy: .after(now.addingTimeInterval(5 * 60)))
            return
        }

        let phase: String
        let hasStarted = state.clockRunning
            || state.clockSeconds > 0
            || state.period > 1
            || state.ourScore > 0
            || state.oppScore > 0
            || !state.events.isEmpty
        if hasStarted {
            phase = "live"
        } else if let matchStartAt,
                  now >= matchStartAt.addingTimeInterval(-gatheringLeadTime),
                  now < matchStartAt {
            phase = "countdown"
        } else if let matchStartAt,
                  now >= matchStartAt,
                  now <= matchStartAt.addingTimeInterval(matchWindowLength) {
            phase = "ready"
        } else {
            if let existing { await existing.end(nil, dismissalPolicy: .immediate) }
            return
        }

        let attributes = BSKMatchLiveActivityAttributes(matchID: matchID, title: title)
        let content = content(for: state, phase: phase, matchStartAt: matchStartAt)

        if let existing {
            await existing.update(content)
        } else {
            do {
                _ = try Activity.request(attributes: attributes, content: content, pushType: nil)
            } catch {
                print("[BSK] Kunde inte starta Live Activity för match \(matchID): \(error.localizedDescription)")
            }
        }
    }

    static func end(matchID: Int) async {
        guard let existing = Activity<BSKMatchLiveActivityAttributes>.activities.first(where: {
            $0.attributes.matchID == matchID
        }) else { return }
        await existing.end(nil, dismissalPolicy: .immediate)
    }

    private static func content(for state: LiveMatchState, phase: String, matchStartAt: Date?) -> ActivityContent<BSKMatchLiveActivityAttributes.ContentState> {
        ActivityContent(
            state: BSKMatchLiveActivityAttributes.ContentState(
                opponent: state.opponent,
                ourScore: state.ourScore,
                opponentScore: state.oppScore,
                period: state.period,
                periods: state.periods,
                clockSeconds: state.clockSeconds,
                clockRunning: state.clockRunning,
                clockStartedAt: state.clockRunning ? Date().addingTimeInterval(-Double(state.clockSeconds)) : nil,
                phase: phase,
                matchStartAt: matchStartAt
            ),
            staleDate: staleDate(for: state, phase: phase, matchStartAt: matchStartAt)
        )
    }

    private static func staleDate(for state: LiveMatchState, phase: String, matchStartAt: Date?) -> Date? {
        if phase == "countdown" { return matchStartAt }
        if state.clockRunning { return Date().addingTimeInterval(2 * 60) }
        if phase == "live" || phase == "ready" { return Date().addingTimeInterval(15 * 60) }
        return nil
    }

    private static func matchStartDate(date: String, time: String?) -> Date? {
        guard let time, time.count >= 5 else { return nil }
        let dateParts = date.split(separator: "-").compactMap { Int($0) }
        let timeParts = time.prefix(5).split(separator: ":").compactMap { Int($0) }
        guard dateParts.count == 3, timeParts.count == 2 else { return nil }
        var components = DateComponents()
        components.calendar = Calendar(identifier: .gregorian)
        components.timeZone = .current
        components.year = dateParts[0]
        components.month = dateParts[1]
        components.day = dateParts[2]
        components.hour = timeParts[0]
        components.minute = timeParts[1]
        return components.date
    }
}
