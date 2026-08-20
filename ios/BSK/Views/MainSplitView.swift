import SwiftUI

private enum AppSection: String, CaseIterable, Identifiable {
    case today
    case observe
    case players
    case selection
    case settings

    var id: String { rawValue }
    var title: String {
        switch self {
        case .today: return "Idag"
        case .observe: return "Observera"
        case .players: return "Spelare"
        case .selection: return "Uttagning"
        case .settings: return "Inställningar"
        }
    }
    var icon: String {
        switch self {
        case .today: return "sun.max"
        case .observe: return "chart.xyaxis.line"
        case .players: return "person.3"
        case .selection: return "sportscourt"
        case .settings: return "gearshape"
        }
    }

    func isAvailable(to user: CurrentUser?) -> Bool {
        guard let user else { return false }
        switch self {
        case .today:
            return ["admin", "head_coach", "coach", "leader"].contains(user.primaryRole)
        case .observe:
            return user.permissions.contains("manage_evaluations")
        case .players:
            return user.permissions.contains("view_players")
        case .selection:
            return user.permissions.contains("manage_squads")
        case .settings:
            return true
        }
    }
}

struct MainSplitView: View {
    @EnvironmentObject private var model: AppModel
    @State private var section: AppSection? = .today
    @State private var selectedPlayer: Int?
    @State private var selectedActivity: String?
    @State private var columnVisibility: NavigationSplitViewVisibility = .automatic

    private var availableSections: [AppSection] {
        AppSection.allCases.filter { $0.isAvailable(to: model.user) }
    }

    var body: some View {
        NavigationSplitView(columnVisibility: $columnVisibility) {
            List(selection: $section) {
                Section {
                    ForEach(availableSections.filter { $0 != .settings }) { item in
                        Label(item.title, systemImage: item.icon).tag(item)
                    }
                }
                Section {
                    Label(AppSection.settings.title, systemImage: AppSection.settings.icon)
                        .tag(AppSection.settings)
                }
            }
            .navigationTitle("BSK")
        } content: {
            switch section ?? .today {
            case .today:
                TodayList(selection: $selectedActivity)
            case .observe:
                ActivityList(selection: $selectedActivity)
            case .players:
                PlayerList(selection: $selectedPlayer)
            case .selection:
                SelectionList(selection: $selectedActivity)
            case .settings:
                SettingsList()
            }
        } detail: {
            switch section ?? .today {
            case .today:
                if let id = selectedActivity, let activity = model.activities.first(where: { $0.id == id }) {
                    ActivityDetail(activity: activity)
                } else {
                    TodayDetail()
                }
            case .observe:
                if let id = selectedActivity, let activity = model.activities.first(where: { $0.id == id }) {
                    ActivityDetail(activity: activity)
                } else {
                    ContentUnavailableView("Välj en aktivitet", systemImage: "chart.xyaxis.line")
                }
            case .players:
                if let selectedPlayer {
                    PlayerDetailView(playerID: selectedPlayer)
                } else {
                    ContentUnavailableView("Välj en spelare", systemImage: "person.crop.circle")
                }
            case .selection:
                if let id = selectedActivity, let match = model.selectionMatches.first(where: { $0.id == id }) {
                    SelectionDetail(match: match)
                } else {
                    ContentUnavailableView("Välj en match", systemImage: "sportscourt")
                }
            case .settings:
                AccountDetail()
            }
        }
        .navigationSplitViewStyle(.balanced)
    }
}

private struct SettingsList: View {
    @EnvironmentObject private var model: AppModel
    var body: some View {
        List {
            Section("Konto") {
                Label(model.user?.name ?? "BSK-konto", systemImage: "person.crop.circle")
                Text(model.user?.email ?? "")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .navigationTitle("Inställningar")
    }
}

private struct AccountDetail: View {
    @EnvironmentObject private var model: AppModel
    var body: some View {
        Form {
            Section("Inloggad som") {
                LabeledContent("Namn", value: model.user?.name ?? "")
                LabeledContent("E-post", value: model.user?.email ?? "")
                LabeledContent("Roll", value: model.user?.primaryRole ?? "")
            }
            Section {
                Button("Logga ut", role: .destructive) { Task { await model.signOut() } }
            }
        }
        .navigationTitle("Konto")
    }
}
