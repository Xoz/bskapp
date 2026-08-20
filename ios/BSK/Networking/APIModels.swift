import Foundation

struct APIEnvelope<Value: Decodable>: Decodable {
    let apiVersion: String
    let data: Value
}

struct APIErrorEnvelope: Decodable {
    struct Payload: Decodable {
        let code: String
        let message: String
    }
    let error: Payload
}

struct TokenPair: Codable {
    let accessToken: String
    let accessTokenExpiresIn: Int
    let refreshToken: String
    let refreshTokenExpiresIn: Int
    let sessionId: String
}

struct CurrentUser: Codable, Identifiable {
    let id: Int
    let email: String
    let name: String
    let roles: [String]
    let primaryRole: String
    let permissions: [String]
    let groupIds: [Int]
}

struct AuthExchange: Decodable {
    let tokens: TokenPair
    let user: CurrentUser
}

struct AuthStart: Decodable {
    let authorizationUrl: URL
}

struct GoalSummary: Codable, Identifiable {
    let id: String
    let slot: Int
    let title: String
    let evidenceHint: String
    let reviewOn: String?
}

struct ObservationSummary: Codable, Identifiable {
    let id: String
    let activityId: String
    let activityDate: String
    let evidence: String
    let note: String
    let createdAt: String
}

struct PlayerSummary: Codable, Identifiable {
    let id: Int
    let name: String
    let jerseyNumber: Int?
    let position: String
    let primaryPosition: String
    let activeGoals: [GoalSummary]
    let lastObservation: ObservationSummary?
}

struct PlayerDetail: Codable, Identifiable {
    struct Team: Codable, Identifiable {
        let id: Int
        let name: String
        let isPrimary: Bool
    }

    struct Preferences: Codable {
        let primaryPosition: String
        let secondaryPosition: String
        let primaryLevel: String
        let secondaryLevel: String
        let selectionEligible: Bool
    }

    struct Stats: Codable {
        let trainingCount: Int
        let matchCount: Int
        let callupCount: Int
    }

    struct MatchHistory: Codable, Identifiable {
        let id: String
        let date: String
        let startTime: String?
        let opponent: String
        let homeAway: String
        let sourceTeam: String
        let level: Int?
    }

    struct Goal: Codable, Identifiable {
        let id: String
        let slot: Int
        let title: String
        let evidenceHint: String
        let status: String
        let startsOn: String
        let reviewOn: String?
        let endedOn: String?
    }

    struct Observation: Codable, Identifiable {
        let id: String
        let activityId: String
        let activityDate: String
        let activityTitle: String
        let activityType: String
        let goalId: String?
        let goalTitle: String?
        let evidence: String
        let note: String
        let coachName: String
        let createdAt: String
    }

    let id: Int
    let name: String
    let jerseyNumber: Int?
    let position: String
    let primaryPosition: String
    let activeGoals: [GoalSummary]
    let lastObservation: ObservationSummary?
    let teams: [Team]
    let preferences: Preferences
    let stats: Stats
    let matchHistory: [MatchHistory]
    let goals: [Goal]
    let observations: [Observation]
}

struct ActivitySummary: Codable, Identifiable {
    let id: String
    let date: String
    let startTime: String?
    let type: String
    let title: String
    let groupId: Int?
    let theme: String
    let challengeContext: String
    let observationCount: Int
    let isPrimaryMatch: Bool
}

struct ObservationCommand: Codable, Identifiable {
    let commandId: String
    let activityId: String
    let playerId: Int
    let goalId: String
    let evidence: String
    let note: String

    var id: String { commandId }
}

struct ObservationSubmission {
    let playerId: Int
    let goalId: String
    let evidence: String
    let note: String
}

struct ObservationCommandResult: Decodable, Identifiable {
    let commandId: String
    let observationId: String
    let status: String

    var id: String { commandId }
}

struct SelectionMatchSummary: Codable, Identifiable {
    let id: String
    let date: String
    let startTime: String?
    let title: String
    let sourceTeam: String
    let competitionLevel: Int?
    let acceptedCallupCount: Int
    let declinedCallupCount: Int
    let pendingCallupCount: Int
    let selectionCount: Int
}

struct SelectionCandidate: Codable, Identifiable {
    let playerId: Int
    let name: String
    let jerseyNumber: Int?
    let position: String
    let primaryPosition: String
    let secondaryPosition: String
    let primaryLevel: String
    let secondaryLevel: String
    let teamNames: [String]
    let decision: String
    let currentCallupStatus: String?
    let selectedLastEight: Int
    let selectedLastThree: Int
    let matchCount: Int
    let callupCount: Int
    let plannedUpcomingCount: Int
    let lastSelectedDate: String?

    var id: Int { playerId }
}

struct SelectionWorkspace: Codable {
    let match: SelectionMatchSummary
    let candidates: [SelectionCandidate]
}

struct SelectionDecision: Encodable {
    let playerId: Int
    let decision: String
    let position: String
}

struct MatchEvaluationSummary: Codable, Identifiable {
    let id: Int
    let opponent: String
    let date: String
    let startTime: String?
    let level: String
    let homeAway: String
    let total: Int
    let handled: Int
}

struct MatchEvaluationWorkspace: Codable {
    struct Match: Codable {
        let id: Int
        let opponent: String
        let date: String
        let startTime: String?
        let level: String
        let homeAway: String
        let activityId: String?
    }

    struct Player: Codable, Identifiable {
        let id: Int
        let name: String
        let jerseyNumber: Int?
        let level: String
        let selfComparison: String?
        let matchImpact: String?
        let reasonTag: String
        let skipped: Bool
    }

    let match: Match
    let players: [Player]
}

struct MatchEvaluationAnswer: Codable {
    let playerId: Int
    var selfComparison: String?
    var matchImpact: String?
    var reasonTag: String
    var skipped: Bool
}
