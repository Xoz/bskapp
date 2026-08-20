import Combine
import Foundation

@MainActor
final class AppModel: ObservableObject {
    enum Phase {
        case loading
        case signedOut
        case signedIn
    }

    @Published private(set) var phase: Phase = .loading
    @Published private(set) var user: CurrentUser?
    @Published private(set) var players: [PlayerSummary] = []
    @Published private(set) var activities: [ActivitySummary] = []
    @Published var errorMessage: String?
    @Published var isWorking = false

    private let api: APIClient
    private let auth: NativeAuthService

    init() {
        let store = KeychainStore()
        let baseURLString = Bundle.main.object(forInfoDictionaryKey: "BSKAPIBaseURL") as? String
        let baseURL = URL(string: baseURLString ?? "https://bsk2014.se/api/mobile/v1")!
        let api = APIClient(baseURL: baseURL, store: store)
        self.api = api
        self.auth = NativeAuthService(api: api, store: store)
    }

    func restore() async {
        guard phase == .loading else { return }
        guard await api.hasStoredSession() else {
            phase = .signedOut
            return
        }
        do {
            user = try await api.currentUser()
            phase = .signedIn
            await reload()
        } catch {
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
            phase = .signedIn
            await reload()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func reload() async {
        do {
            async let loadedPlayers = api.players()
            async let loadedActivities = api.activities()
            players = try await loadedPlayers
            activities = try await loadedActivities
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func playerDetail(id: Int) async throws -> PlayerDetail {
        try await api.player(id: id)
    }

    func signOut() async {
        await api.logout()
        user = nil
        players = []
        activities = []
        errorMessage = nil
        phase = .signedOut
    }
}
