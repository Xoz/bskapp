import Combine
import Foundation

@MainActor
final class AppModel: ObservableObject {
    enum ObservationSaveStatus: Equatable {
        case saved
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
    @Published private(set) var activities: [ActivitySummary] = []
    @Published private(set) var selectionMatches: [SelectionMatchSummary] = []
    @Published private(set) var queuedObservationCount = 0
    @Published var errorMessage: String?
    @Published var isWorking = false

    private let api: APIClient
    private let auth: NativeAuthService
    private var queuedObservations: [ObservationCommand]
    private let observationQueueURL: URL

    init() {
        let store = KeychainStore()
        let baseURLString = Bundle.main.object(forInfoDictionaryKey: "BSKAPIBaseURL") as? String
        let baseURL = URL(string: baseURLString ?? "https://bsk2014.se/api/mobile/v1")!
        let api = APIClient(baseURL: baseURL, store: store)
        self.api = api
        self.auth = NativeAuthService(api: api, store: store)
        self.observationQueueURL = Self.makeObservationQueueURL()
        self.queuedObservations = Self.loadObservationQueue(from: observationQueueURL)
        self.queuedObservationCount = queuedObservations.count
    }

    func restore() async {
        guard phase == .loading else { return }
        guard await api.hasStoredSession() else {
            phase = .signedOut
            return
        }
        do {
            user = try await api.currentUser()
            await reload()
            phase = .signedIn
        } catch {
            if Self.isCancellation(error) { return }
            await api.clearSession()
            phase = .signedOut
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
        await loadCoreData()
    }

    func playerDetail(id: Int) async throws -> PlayerDetail {
        try await api.player(id: id)
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

    func signOut() async {
        await api.logout()
        user = nil
        players = []
        activities = []
        selectionMatches = []
        queuedObservations = []
        persistObservationQueue()
        errorMessage = nil
        phase = .signedOut
    }

    private func loadCoreData() async {
        do {
            async let loadedPlayers = api.players()
            async let loadedActivities = api.activities()
            players = try await loadedPlayers
            activities = try await loadedActivities
            if user?.permissions.contains("manage_squads") == true {
                selectionMatches = try await api.selectionMatches()
            } else {
                selectionMatches = []
            }
        } catch {
            if Self.isCancellation(error) { return }
            errorMessage = error.localizedDescription
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
        return (error as? URLError)?.code == .cancelled
    }
}
