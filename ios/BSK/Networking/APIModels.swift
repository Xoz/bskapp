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
}
