import SwiftUI

private enum AppSection: String, CaseIterable, Identifiable {
    case today
    case players
    case activities
    case settings

    var id: String { rawValue }
    var title: String {
        switch self {
        case .today: return "Idag"
        case .players: return "Spelare"
        case .activities: return "Aktiviteter"
        case .settings: return "Inställningar"
        }
    }
    var icon: String {
        switch self {
        case .today: return "sun.max"
        case .players: return "person.3"
        case .activities: return "sportscourt"
        case .settings: return "gearshape"
        }
    }
}

struct MainSplitView: View {
    @EnvironmentObject private var model: AppModel
    @State private var section: AppSection? = .today
    @State private var selectedPlayer: Int?
    @State private var selectedActivity: String?
    @State private var columnVisibility: NavigationSplitViewVisibility = .automatic

    var body: some View {
        NavigationSplitView(columnVisibility: $columnVisibility) {
            List(AppSection.allCases, selection: $section) { item in
                Label(item.title, systemImage: item.icon).tag(item)
            }
            .navigationTitle("BSK")
        } content: {
            switch section ?? .today {
            case .today:
                TodayList()
            case .players:
                PlayerList(selection: $selectedPlayer)
            case .activities:
                ActivityList(selection: $selectedActivity)
            case .settings:
                SettingsList()
            }
        } detail: {
            switch section ?? .today {
            case .today:
                TodayDetail()
            case .players:
                if let selectedPlayer {
                    PlayerDetailView(playerID: selectedPlayer)
                } else {
                    ContentUnavailableView("Välj en spelare", systemImage: "person.crop.circle")
                }
            case .activities:
                if let id = selectedActivity, let activity = model.activities.first(where: { $0.id == id }) {
                    ActivityDetail(activity: activity)
                } else {
                    ContentUnavailableView("Välj en aktivitet", systemImage: "sportscourt")
                }
            case .settings:
                AccountDetail()
            }
        }
        .navigationSplitViewStyle(.balanced)
        .task { await model.reload() }
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
