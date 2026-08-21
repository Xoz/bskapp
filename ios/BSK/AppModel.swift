import Combine
import Foundation
import Network

@MainActor
final class AppModel: ObservableObject {
    enum ObservationSaveStatus: Equatable {
        case saved
        case queued
    }

    enum MatchEvaluationSaveStatus {
        case saved(MatchEvaluationWorkspace)
        case queued
    }

    enum Phase {
        case loading
        case signedOut
        case signedIn
    }

    @Published private(set) var phase: Phase = .loading
    @Published private(set) var user: CurrentUser?
    @Published private(set) var players: [PlayerSummary] = []
    @Published private(set) var playerMatchLoads: [PlayerMatchLoad] = []
    @Published private(set) var activities: [ActivitySummary] = []
    @Published private(set) var selectionMatches: [SelectionMatchSummary] = []
    @Published private(set) var matchEvaluations: [MatchEvaluationSummary] = []
    @Published private(set) var queuedObservationCount = 0
    @Published private(set) var queuedMatchEvaluationCount = 0
    @Published var errorMessage: String? {
        didSet {
            if let errorMessage {
                if Self.isCancellationDescription(errorMessage) {
                    self.errorMessage = nil
                    return
                }
                print("[BSK] \(errorMessage)")
            }
        }
    }
    @Published var isWorking = false

    private let api: APIClient
    private let auth: NativeAuthService
    private var queuedObservations: [ObservationCommand]
    private let observationQueueURL: URL
    private var queuedMatchEvaluations: [QueuedMatchEvaluation]
    private let matchEvaluationQueueURL: URL
    private let networkMonitor = NWPathMonitor()
    private let networkMonitorQueue = DispatchQueue(label: "se.bsk2014.network-monitor")
    private var isRestoringSession = false

    init() {
        #if DEBUG
        let isUIReview = ProcessInfo.processInfo.arguments.contains("-ui-review")
        #else
        let isUIReview = false
        #endif
        let store = KeychainStore()
        let baseURLString = Bundle.main.object(forInfoDictionaryKey: "BSKAPIBaseURL") as? String
        let baseURL = URL(string: baseURLString ?? "https://bsk2014.se/api/mobile/v1")!
        let api = APIClient(baseURL: baseURL, store: store)
        self.api = api
        self.auth = NativeAuthService(api: api, store: store)
        self.observationQueueURL = Self.makeObservationQueueURL()
        self.queuedObservations = Self.loadObservationQueue(from: observationQueueURL)
        self.queuedObservationCount = queuedObservations.count
        self.matchEvaluationQueueURL = Self.makeMatchEvaluationQueueURL()
        self.queuedMatchEvaluations = Self.loadMatchEvaluationQueue(from: matchEvaluationQueueURL)
        self.queuedMatchEvaluationCount = queuedMatchEvaluations.count
        networkMonitor.pathUpdateHandler = { [weak self] path in
            guard path.status == .satisfied else { return }
            Task { @MainActor [weak self] in
                guard let self, self.phase == .signedIn else { return }
                await self.flushMatchEvaluationQueue()
                await self.loadCoreData()
            }
        }
        if isUIReview {
            configureUIReviewFixtures()
        } else {
            networkMonitor.start(queue: networkMonitorQueue)
        }
    }

    private func configureUIReviewFixtures() {
        #if DEBUG
        user = CurrentUser(
            id: 1,
            email: "tranare@bsk2014.se",
            name: "Karin Tränare",
            roles: ["admin"],
            primaryRole: "admin",
            permissions: [
                "manage_users", "manage_settings", "manage_groups", "view_players", "manage_players",
                "view_private_player_data", "manage_evaluations", "view_matches", "manage_matches",
                "manage_squads", "report_matches", "view_statistics"
            ],
            groupIds: []
        )
        let focus = GoalSummary(
            id: "00000000-0000-4000-8000-000000000001",
            slot: 1,
            title: "Söka spelbar yta före mottagning",
            evidenceHint: "Titta upp och flytta före passningen",
            reviewOn: "2026-09-01"
        )
        players = [
            PlayerSummary(id: 1, name: "Alma", jerseyNumber: 7, position: "Mittfält", primaryPosition: "Mittfält", activeGoals: [focus], lastObservation: nil),
            PlayerSummary(id: 2, name: "Adele", jerseyNumber: 11, position: "Anfall", primaryPosition: "Anfall", activeGoals: [focus], lastObservation: nil),
            PlayerSummary(id: 3, name: "Kerstin", jerseyNumber: 4, position: "Back", primaryPosition: "Back", activeGoals: [focus], lastObservation: nil),
            PlayerSummary(id: 4, name: "Mira", jerseyNumber: 1, position: "Målvakt", primaryPosition: "Målvakt", activeGoals: [], lastObservation: nil)
        ]
        playerMatchLoads = [
            PlayerMatchLoad(playerId: 1, name: "Alma", jerseyNumber: 7, windowMatchCount: 1, capacity: 100, recentMatches: [], upcomingMatches: [
                .init(id: "sanktan-review-1", date: "2026-08-22", startTime: "10:15", title: "Hemma mot Spånga IS", sourceTeam: "Gul", status: "selected")
            ]),
            PlayerMatchLoad(playerId: 2, name: "Adele", jerseyNumber: 11, windowMatchCount: 1, capacity: 82, recentMatches: [
                .init(id: "recent-1", date: "2026-08-19", startTime: "18:30", title: "Mot AIK", sourceTeam: "Grön")
            ], upcomingMatches: []),
            PlayerMatchLoad(playerId: 3, name: "Kerstin", jerseyNumber: 4, windowMatchCount: 1, capacity: 50, recentMatches: [
                .init(id: "recent-2", date: "2026-08-21", startTime: "09:00", title: "Mot Sollentuna", sourceTeam: "Gul")
            ], upcomingMatches: []),
            PlayerMatchLoad(playerId: 4, name: "Mira", jerseyNumber: 1, windowMatchCount: 2, capacity: 18, recentMatches: [
                .init(id: "recent-3", date: "2026-08-20", startTime: "18:00", title: "Mot Brommapojkarna", sourceTeam: "Gul"),
                .init(id: "recent-4", date: "2026-08-18", startTime: "18:30", title: "Mot Vasalund", sourceTeam: "Grön")
            ], upcomingMatches: [])
        ]
        activities = [
            ActivitySummary(
                id: "sanktan-review-1",
                matchId: nil,
                date: "2026-08-22",
                startTime: "10:15",
                type: "match",
                title: "Hemma mot Spånga IS",
                groupId: 1,
                theme: "Spelbarhet och mod i första passningen",
                challengeContext: "balanced",
                observationCount: 3,
                isPrimaryMatch: true,
                sourceTeam: "Gul",
                matchLevel: "Medel",
                loanedPlayerNames: [],
                finished: false,
                acceptedCallupCount: 7,
                declinedCallupCount: 2,
                pendingCallupCount: 1,
                squadCount: 0,
                hasConfirmedSquad: false,
                squadPlayerNames: [],
                acceptedPlayerNames: ["Alma", "Adele", "Kerstin", "Mira", "Nora", "Saga", "Vera"]
            )
        ]
        phase = .signedIn
        #endif
    }

    func restore() async {
        guard phase == .loading, !isRestoringSession else { return }
        isRestoringSession = true
        defer { isRestoringSession = false }
        var retryDelay = 1.0
        while phase == .loading {
            do {
                guard try await api.hasStoredSession() else {
                    phase = .signedOut
                    return
                }
                user = try await api.currentUser()
                await reload()
                phase = .signedIn
                return
            } catch {
                if Self.isCancellation(error) { return }
                if case APIClientError.unauthorized = error {
                    await api.clearSession()
                    phase = .signedOut
                    return
                }

                // Ett tillfälligt nät-, server- eller Keychain-fel är inte en
                // utloggning. Behåll sessionen och försök igen när appen lever.
                errorMessage = error.localizedDescription
                try? await Task.sleep(for: .seconds(retryDelay))
                retryDelay = min(retryDelay * 2, 10)
            }
        }
    }

    func signIn() async {
        guard !isWorking else { return }
        isWorking = true
        errorMessage = nil
        defer { isWorking = false }
        do {
            let exchange = try await auth.signIn()
            user = exchange.user
            await reload()
            phase = .signedIn
        } catch {
            if Self.isCancellation(error) { return }
            errorMessage = error.localizedDescription
        }
    }

    func reload() async {
        await flushObservationQueue()
        await flushMatchEvaluationQueue()
        await loadCoreData()
    }

    func playerDetail(id: Int) async throws -> PlayerDetail {
        try await api.player(id: id)
    }

    func activityPlayers(id: String) async throws -> [PlayerSummary] {
        try await api.activityPlayers(id: id)
    }

    func createGoal(playerID: Int, title: String, evidenceHint: String, reviewOn: String?) async throws -> PlayerDetail {
        let detail = try await api.createGoal(playerID: playerID, title: title, evidenceHint: evidenceHint, reviewOn: reviewOn)
        players = try await api.players()
        return detail
    }

    func closeGoal(playerID: Int, goalID: String, status: String) async throws -> PlayerDetail {
        let detail = try await api.closeGoal(playerID: playerID, goalID: goalID, status: status)
        players = try await api.players()
        return detail
    }

    func savePlayerPreferences(playerID: Int, preferences: PlayerDetail.Preferences) async throws -> PlayerDetail {
        let detail = try await api.savePlayerPreferences(playerID: playerID, preferences: preferences)
        players = try await api.players()
        return detail
    }

    func selectionWorkspace(id: String) async throws -> SelectionWorkspace {
        try await api.selectionWorkspace(id: id)
    }

    func saveSelection(id: String, decisions: [SelectionDecision]) async throws -> SelectionWorkspace {
        let workspace = try await api.saveSelection(id: id, decisions: decisions)
        selectionMatches = try await api.selectionMatches()
        return workspace
    }

    func liveMatch(id: Int) async throws -> LiveMatchState {
        try await api.liveMatch(id: id)
    }

    func updateLiveMatch(id: Int, command: LiveMatchCommand) async throws -> LiveMatchState {
        try await api.updateLiveMatch(id: id, command: command)
    }

    func matchEvaluation(id: Int) async throws -> MatchEvaluationWorkspace {
        do {
            return try await api.matchEvaluation(id: id)
        } catch let error as URLError {
            guard Self.isConnectivityError(error),
                  let queued = queuedMatchEvaluations.first(where: { $0.matchID == id }) else { throw error }
            return queued.workspace
        }
    }

    func pendingMatchEvaluation(id: Int) -> (answers: [MatchEvaluationAnswer], activeIndex: Int)? {
        guard let queued = queuedMatchEvaluations.first(where: { $0.matchID == id }) else { return nil }
        return (queued.answers, queued.activeIndex)
    }

    func saveMatchEvaluation(
        id: Int,
        answers: [MatchEvaluationAnswer],
        workspace: MatchEvaluationWorkspace,
        activeIndex: Int
    ) async throws -> MatchEvaluationSaveStatus {
        do {
            let updated = try await api.saveMatchEvaluation(id: id, answers: answers)
            queuedMatchEvaluations.removeAll(where: { $0.matchID == id })
            persistMatchEvaluationQueue()
            matchEvaluations = try await api.matchEvaluations()
            return .saved(updated)
        } catch let error as URLError {
            guard Self.isConnectivityError(error) else { throw error }
            let queued = QueuedMatchEvaluation(
                matchID: id,
                workspace: workspace,
                answers: answers,
                activeIndex: activeIndex
            )
            if let index = queuedMatchEvaluations.firstIndex(where: { $0.matchID == id }) {
                queuedMatchEvaluations[index] = queued
            } else {
                queuedMatchEvaluations.append(queued)
            }
            persistMatchEvaluationQueue()
            return .queued
        }
    }

    func saveObservation(
        activityID: String,
        playerID: Int,
        goalID: String,
        evidence: String,
        note: String
    ) async throws -> ObservationSaveStatus {
        let command = ObservationCommand(
            commandId: UUID().uuidString.lowercased(),
            activityId: activityID,
            playerId: playerID,
            goalId: goalID,
            evidence: evidence,
            note: note.trimmingCharacters(in: .whitespacesAndNewlines)
        )
        do {
            _ = try await api.saveObservations([command], activityID: activityID)
            await loadCoreData()
            return .saved
        } catch let error as URLError {
            guard Self.isConnectivityError(error) else { throw error }
            queuedObservations.append(command)
            persistObservationQueue()
            return .queued
        }
    }

    func saveObservations(
        activityID: String,
        submissions: [ObservationSubmission]
    ) async throws -> ObservationSaveStatus {
        let commands = submissions.map { submission in
            ObservationCommand(
                commandId: UUID().uuidString.lowercased(),
                activityId: activityID,
                playerId: submission.playerId,
                goalId: submission.goalId,
                evidence: submission.evidence,
                note: submission.note.trimmingCharacters(in: .whitespacesAndNewlines)
            )
        }
        guard !commands.isEmpty else { return .saved }
        do {
            _ = try await api.saveObservations(commands, activityID: activityID)
            await loadCoreData()
            return .saved
        } catch let error as URLError {
            guard Self.isConnectivityError(error) else { throw error }
            queuedObservations.append(contentsOf: commands)
            persistObservationQueue()
            return .queued
        }
    }

    func signOut() async {
        await api.logout()
        user = nil
        players = []
        playerMatchLoads = []
        activities = []
        selectionMatches = []
        matchEvaluations = []
        queuedObservations = []
        persistObservationQueue()
        queuedMatchEvaluations = []
        persistMatchEvaluationQueue()
        errorMessage = nil
        phase = .signedOut
    }

    private func loadCoreData() async {
        do {
            async let loadedPlayers = api.players()
            async let loadedPlayerMatchLoads = api.playerMatchLoads()
            async let loadedActivities = api.activities()
            players = try await loadedPlayers
            playerMatchLoads = try await loadedPlayerMatchLoads
            activities = try await loadedActivities
            if user?.permissions.contains("manage_squads") == true {
                selectionMatches = try await api.selectionMatches()
            } else {
                selectionMatches = []
            }
            if user?.permissions.contains("manage_evaluations") == true {
                matchEvaluations = try await api.matchEvaluations()
            } else {
                matchEvaluations = []
            }
            await syncLiveActivitiesNearKickoff()
        } catch {
            if Self.isCancellation(error) { return }
            errorMessage = error.localizedDescription
        }
    }

    private func syncLiveActivitiesNearKickoff() async {
        guard user?.permissions.contains("report_matches") == true else { return }
        let candidates = activities.filter { activity in
            activity.type == "match"
                && activity.matchId != nil
                && MatchLiveActivityManager.shouldSync(date: activity.date, time: activity.startTime)
        }
        for activity in candidates.prefix(3) {
            guard let matchID = activity.matchId else { continue }
            do {
                let state = try await api.liveMatch(id: matchID)
                await MatchLiveActivityManager.sync(matchID: matchID, title: activity.title, state: state)
            } catch {
                print("[BSK] Kunde inte synka Live Activity för match \(matchID): \(error.localizedDescription)")
            }
        }
    }

    private func flushObservationQueue() async {
        guard !queuedObservations.isEmpty else { return }
        var remaining: [ObservationCommand] = []
        for command in queuedObservations {
            do {
                _ = try await api.saveObservations([command], activityID: command.activityId)
            } catch {
                remaining.append(command)
            }
        }
        queuedObservations = remaining
        persistObservationQueue()
    }

    private func flushMatchEvaluationQueue() async {
        guard !queuedMatchEvaluations.isEmpty else { return }
        var remaining: [QueuedMatchEvaluation] = []
        for queued in queuedMatchEvaluations {
            do {
                _ = try await api.saveMatchEvaluation(id: queued.matchID, answers: queued.answers)
            } catch {
                remaining.append(queued)
            }
        }
        queuedMatchEvaluations = remaining
        persistMatchEvaluationQueue()
    }

    private func persistObservationQueue() {
        queuedObservationCount = queuedObservations.count
        do {
            let directory = observationQueueURL.deletingLastPathComponent()
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            let data = try JSONEncoder().encode(queuedObservations)
            try data.write(to: observationQueueURL, options: .atomic)
            try FileManager.default.setAttributes(
                [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication],
                ofItemAtPath: observationQueueURL.path
            )
        } catch {
            errorMessage = "Offlinekön kunde inte sparas: \(error.localizedDescription)"
        }
    }

    private static func makeObservationQueueURL() -> URL {
        let root = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        return root.appending(path: "BSK/offline-observations.json")
    }

    private static func loadObservationQueue(from url: URL) -> [ObservationCommand] {
        guard let data = try? Data(contentsOf: url) else { return [] }
        return (try? JSONDecoder().decode([ObservationCommand].self, from: data)) ?? []
    }

    private func persistMatchEvaluationQueue() {
        queuedMatchEvaluationCount = queuedMatchEvaluations.count
        do {
            let directory = matchEvaluationQueueURL.deletingLastPathComponent()
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            let data = try JSONEncoder().encode(queuedMatchEvaluations)
            try data.write(to: matchEvaluationQueueURL, options: .atomic)
            try FileManager.default.setAttributes(
                [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication],
                ofItemAtPath: matchEvaluationQueueURL.path
            )
        } catch {
            errorMessage = "Utvärderingskön kunde inte sparas: \(error.localizedDescription)"
        }
    }

    private static func makeMatchEvaluationQueueURL() -> URL {
        let root = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        return root.appending(path: "BSK/offline-match-evaluations.json")
    }

    private static func loadMatchEvaluationQueue(from url: URL) -> [QueuedMatchEvaluation] {
        guard let data = try? Data(contentsOf: url) else { return [] }
        return (try? JSONDecoder().decode([QueuedMatchEvaluation].self, from: data)) ?? []
    }

    private static func isConnectivityError(_ error: URLError) -> Bool {
        switch error.code {
        case .notConnectedToInternet, .networkConnectionLost, .timedOut, .cannotFindHost, .cannotConnectToHost, .dnsLookupFailed:
            return true
        default:
            return false
        }
    }

    private static func isCancellation(_ error: Error) -> Bool {
        if error is CancellationError { return true }
        if (error as? URLError)?.code == .cancelled { return true }
        let nsError = error as NSError
        if nsError.domain == NSURLErrorDomain, nsError.code == NSURLErrorCancelled { return true }
        return isCancellationDescription(error.localizedDescription)
    }

    private static func isCancellationDescription(_ message: String) -> Bool {
        let normalized = message.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return normalized == "avbruten"
            || normalized == "cancelled"
            || normalized == "canceled"
            || normalized == "the operation was cancelled."
            || normalized == "the operation was canceled."
    }
}

private struct QueuedMatchEvaluation: Codable {
    let matchID: Int
    let workspace: MatchEvaluationWorkspace
    let answers: [MatchEvaluationAnswer]
    let activeIndex: Int
}
