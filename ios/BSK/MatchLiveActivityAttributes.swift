import ActivityKit
import Foundation

struct BSKMatchLiveActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        let opponent: String
        let ourScore: Int
        let opponentScore: Int
        let period: Int
        let periods: Int
        let clockSeconds: Int
        let clockRunning: Bool
        let clockStartedAt: Date?
        let phase: String
        let matchStartAt: Date?
    }

    let matchID: Int
    let title: String
}
