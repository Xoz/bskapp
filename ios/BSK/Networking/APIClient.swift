import Foundation

enum APIClientError: LocalizedError {
    case invalidResponse
    case unauthorized
    case server(String)

    var errorDescription: String? {
        switch self {
        case .invalidResponse: return "Servern skickade ett oväntat svar."
        case .unauthorized: return "Sessionen har gått ut. Logga in igen."
        case .server(let message): return message
        }
    }
}

actor APIClient {
    private let baseURL: URL
    private let store: KeychainStore
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    init(baseURL: URL, store: KeychainStore) {
        self.baseURL = baseURL
        self.store = store
    }

    func hasStoredSession() -> Bool {
        (try? store.loadTokens()) != nil
    }

    func clearSession() {
        try? store.deleteTokens()
    }

    func postPublic<Response: Decodable, Body: Encodable>(path: String, body: Body) async throws -> Response {
        try await perform(path: path, method: "POST", body: encoder.encode(body), authorized: false)
    }

    func saveExchange(_ exchange: AuthExchange) throws {
        try store.saveTokens(exchange.tokens)
    }

    func currentUser() async throws -> CurrentUser {
        try await perform(path: "/auth/me", method: "GET", body: nil, authorized: true)
    }

    func players() async throws -> [PlayerSummary] {
        try await perform(path: "/players", method: "GET", body: nil, authorized: true)
    }

    func playerMatchLoads() async throws -> [PlayerMatchLoad] {
        try await perform(path: "/player-match-loads", method: "GET", body: nil, authorized: true)
    }

    func player(id: Int) async throws -> PlayerDetail {
        try await perform(path: "/players/\(id)", method: "GET", body: nil, authorized: true)
    }

    func createGoal(playerID: Int, title: String, evidenceHint: String, reviewOn: String?) async throws -> PlayerDetail {
        struct Body: Encodable { let title: String; let evidenceHint: String; let reviewOn: String? }
        return try await perform(
            path: "/players/\(playerID)/goals",
            method: "POST",
            body: encoder.encode(Body(title: title, evidenceHint: evidenceHint, reviewOn: reviewOn)),
            authorized: true
        )
    }

    func closeGoal(playerID: Int, goalID: String, status: String) async throws -> PlayerDetail {
        struct Body: Encodable { let status: String }
        return try await perform(
            path: "/players/\(playerID)/goals/\(goalID)",
            method: "PATCH",
            body: encoder.encode(Body(status: status)),
            authorized: true
        )
    }

    func savePlayerPreferences(playerID: Int, preferences: PlayerDetail.Preferences) async throws -> PlayerDetail {
        try await perform(
            path: "/players/\(playerID)/preferences",
            method: "PUT",
            body: encoder.encode(preferences),
            authorized: true
        )
    }

    func activities() async throws -> [ActivitySummary] {
        try await perform(path: "/activities", method: "GET", body: nil, authorized: true)
    }

    func activityPlayers(id: String) async throws -> [PlayerSummary] {
        try await perform(path: "/activities/\(id)/players", method: "GET", body: nil, authorized: true)
    }

    func saveObservations(_ commands: [ObservationCommand], activityID: String) async throws -> [ObservationCommandResult] {
        struct Body: Encodable { let commands: [ObservationCommand] }
        return try await perform(
            path: "/activities/\(activityID)/observations",
            method: "POST",
            body: encoder.encode(Body(commands: commands)),
            authorized: true
        )
    }

    func selectionMatches() async throws -> [SelectionMatchSummary] {
        try await perform(path: "/selection", method: "GET", body: nil, authorized: true)
    }

    func selectionWorkspace(id: String) async throws -> SelectionWorkspace {
        try await perform(path: "/selection/\(id)", method: "GET", body: nil, authorized: true)
    }

    func saveSelection(id: String, decisions: [SelectionDecision]) async throws -> SelectionWorkspace {
        struct Body: Encodable { let decisions: [SelectionDecision] }
        return try await perform(
            path: "/selection/\(id)",
            method: "PUT",
            body: encoder.encode(Body(decisions: decisions)),
            authorized: true
        )
    }

    func liveMatch(id: Int) async throws -> LiveMatchState {
        try await perform(path: "/matches/\(id)/live", method: "GET", body: nil, authorized: true)
    }

    func updateLiveMatch(id: Int, command: LiveMatchCommand) async throws -> LiveMatchState {
        try await perform(
            path: "/matches/\(id)/live",
            method: "POST",
            body: encoder.encode(command),
            authorized: true
        )
    }

    func matchEvaluations() async throws -> [MatchEvaluationSummary] {
        try await perform(path: "/match-evaluations", method: "GET", body: nil, authorized: true)
    }

    func matchEvaluation(id: Int) async throws -> MatchEvaluationWorkspace {
        try await perform(path: "/match-evaluations/\(id)", method: "GET", body: nil, authorized: true)
    }

    func saveMatchEvaluation(id: Int, answers: [MatchEvaluationAnswer]) async throws -> MatchEvaluationWorkspace {
        struct Body: Encodable { let answers: [MatchEvaluationAnswer] }
        return try await perform(
            path: "/match-evaluations/\(id)",
            method: "PUT",
            body: encoder.encode(Body(answers: answers)),
            authorized: true
        )
    }

    func logout() async {
        _ = try? await perform(path: "/auth/logout", method: "POST", body: nil, authorized: true) as EmptyResponse
        clearSession()
    }

    private func refresh() async throws -> TokenPair {
        guard let current = try? store.loadTokens() else { throw APIClientError.unauthorized }
        struct Body: Encodable { let refreshToken: String }
        let tokens: TokenPair = try await perform(
            path: "/auth/refresh",
            method: "POST",
            body: encoder.encode(Body(refreshToken: current.refreshToken)),
            authorized: false,
            canRefresh: false
        )
        try store.saveTokens(tokens)
        return tokens
    }

    private func perform<Response: Decodable>(
        path: String,
        method: String,
        body: Data?,
        authorized: Bool,
        canRefresh: Bool = true
    ) async throws -> Response {
        let accessToken = authorized ? (try? store.loadTokens())?.accessToken : nil
        let (data, response) = try await send(path: path, method: method, body: body, accessToken: accessToken)
        if response.statusCode == 401, authorized, canRefresh {
            let tokens = try await refresh()
            let retried = try await send(path: path, method: method, body: body, accessToken: tokens.accessToken)
            return try decode(data: retried.0, response: retried.1)
        }
        return try decode(data: data, response: response)
    }

    private func send(path: String, method: String, body: Data?, accessToken: String?) async throws -> (Data, HTTPURLResponse) {
        var request = URLRequest(url: baseURL.appending(path: path))
        request.httpMethod = method
        request.httpBody = body
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if body != nil { request.setValue("application/json", forHTTPHeaderField: "Content-Type") }
        if let accessToken { request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization") }
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw APIClientError.invalidResponse }
        return (data, http)
    }

    private func decode<Response: Decodable>(data: Data, response: HTTPURLResponse) throws -> Response {
        guard (200..<300).contains(response.statusCode) else {
            if response.statusCode == 401 { throw APIClientError.unauthorized }
            let message = (try? decoder.decode(APIErrorEnvelope.self, from: data))?.error.message
            throw APIClientError.server(message ?? "Serverfel (\(response.statusCode)).")
        }
        if Response.self == EmptyResponse.self, data.isEmpty {
            return EmptyResponse() as! Response
        }
        return try decoder.decode(APIEnvelope<Response>.self, from: data).data
    }
}

private struct EmptyResponse: Decodable {}
