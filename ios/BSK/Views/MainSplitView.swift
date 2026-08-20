import SwiftUI

private enum AppSection: String, CaseIterable, Identifiable {
    case today
    case observe
    case evaluate
    case players
    case selection
    case settings

    var id: String { rawValue }
    var title: String {
        switch self {
        case .today: return "Idag"
        case .observe: return "Observera"
        case .evaluate: return "Utvärdera"
        case .players: return "Spelare"
        case .selection: return "Uttagning"
        case .settings: return "Inställningar"
        }
    }
    var icon: String {
        switch self {
        case .today: return "sun.max"
        case .observe: return "chart.xyaxis.line"
        case .evaluate: return "checklist"
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
        case .evaluate:
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
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var section: AppSection? = .today
    @State private var selectedPlayer: Int?
    @State private var selectedActivity: String?
    @State private var selectedEvaluation: Int?
    @State private var columnVisibility: NavigationSplitViewVisibility = .automatic
    @State private var preferredCompactColumn: NavigationSplitViewColumn = .content

    private var availableSections: [AppSection] {
        AppSection.allCases.filter { $0.isAvailable(to: model.user) }
    }

    var body: some View {
        NavigationSplitView(columnVisibility: $columnVisibility, preferredCompactColumn: $preferredCompactColumn) {
            sidebar
        } content: {
            switch section ?? .today {
            case .today:
                TodayList(selection: $selectedActivity)
            case .observe:
                ActivityList(selection: $selectedActivity)
            case .evaluate:
                MatchEvaluationList(selection: $selectedEvaluation)
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
            case .evaluate:
                if let selectedEvaluation {
                    MatchEvaluationView(matchID: selectedEvaluation)
                } else {
                    ContentUnavailableView("Välj en match", systemImage: "checklist")
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
        .background(BSKTheme.canvas)
        .toolbarBackground(BSKTheme.background.opacity(0.94), for: .navigationBar)
        .onAppear {
            if horizontalSizeClass == .compact {
                preferredCompactColumn = .content
            }
        }
        .onChange(of: horizontalSizeClass) { _, sizeClass in
            if sizeClass == .compact {
                preferredCompactColumn = .content
            }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if horizontalSizeClass == .compact {
                compactNavigation
            }
        }
    }

    private var sidebar: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 15, style: .continuous)
                        .fill(BSKTheme.accent)
                    Text("B")
                        .font(.system(size: 25, weight: .black, design: .rounded))
                        .foregroundStyle(BSKTheme.backgroundDeep)
                }
                .frame(width: 48, height: 48)

                VStack(alignment: .leading, spacing: 2) {
                    Text("BSK F2014")
                        .font(.headline.weight(.black))
                    Text("MATCHCENTER")
                        .font(.system(size: 9, weight: .bold))
                        .tracking(1.7)
                        .foregroundStyle(BSKTheme.accent)
                }
            }
            .padding(.horizontal, 18)
            .padding(.top, 22)
            .padding(.bottom, 24)

            Text("ARBETSYTOR")
                .font(.system(size: 10, weight: .bold))
                .tracking(1.5)
                .foregroundStyle(BSKTheme.muted)
                .padding(.horizontal, 20)
                .padding(.bottom, 8)

            VStack(spacing: 7) {
                ForEach(availableSections.filter { $0 != .settings }) { item in
                    sidebarButton(item)
                }
            }
            .padding(.horizontal, 10)

            Spacer()

            sidebarButton(.settings)
                .padding(.horizontal, 10)

            HStack(spacing: 10) {
                Circle()
                    .fill(BSKTheme.accent.opacity(0.16))
                    .overlay(Text(String(model.user?.name.prefix(1) ?? "B")).font(.caption.bold()).foregroundStyle(BSKTheme.accent))
                    .frame(width: 34, height: 34)
                VStack(alignment: .leading, spacing: 1) {
                    Text(model.user?.name ?? "BSK-konto").font(.caption.bold()).lineLimit(1)
                    Text("Redo för match").font(.caption2).foregroundStyle(BSKTheme.muted)
                }
                Spacer()
                Circle().fill(BSKTheme.accent).frame(width: 7, height: 7)
            }
            .padding(14)
            .background(BSKTheme.backgroundDeep.opacity(0.55), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .padding(12)
        }
        .background {
            LinearGradient(
                colors: [BSKTheme.elevated, BSKTheme.backgroundDeep],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()
        }
        .overlay(alignment: .trailing) { Rectangle().fill(BSKTheme.border).frame(width: 1) }
    }

    private func sidebarButton(_ item: AppSection) -> some View {
        Button {
            withAnimation(.easeOut(duration: 0.18)) {
                section = item
                selectedPlayer = nil
                selectedActivity = nil
                selectedEvaluation = nil
            }
        } label: {
            HStack(spacing: 12) {
                Image(systemName: item.icon)
                    .font(.system(size: 16, weight: .semibold))
                    .frame(width: 24)
                Text(item.title).font(.subheadline.weight(.semibold))
                Spacer()
                if section == item {
                    Circle().fill(BSKTheme.accent).frame(width: 6, height: 6)
                }
            }
            .foregroundStyle(section == item ? .white : BSKTheme.secondary)
            .padding(.horizontal, 12)
            .frame(height: 46)
            .background(
                section == item ? BSKTheme.accent.opacity(0.13) : Color.clear,
                in: RoundedRectangle(cornerRadius: 14, style: .continuous)
            )
            .overlay(alignment: .leading) {
                if section == item {
                    Capsule().fill(BSKTheme.accent).frame(width: 3, height: 22).offset(x: -1)
                }
            }
        }
        .buttonStyle(.plain)
    }

    private var compactNavigation: some View {
        HStack(spacing: 4) {
            ForEach(availableSections.filter { $0 != .settings }) { item in
                Button {
                    withAnimation(.easeOut(duration: 0.16)) {
                        section = item
                        selectedPlayer = nil
                        selectedActivity = nil
                        selectedEvaluation = nil
                        preferredCompactColumn = .content
                    }
                } label: {
                    VStack(spacing: 5) {
                        Image(systemName: item.icon)
                            .font(.system(size: 18, weight: section == item ? .bold : .medium))
                        Text(item.title)
                            .font(.system(size: 9, weight: .bold))
                            .lineLimit(1)
                    }
                    .foregroundStyle(section == item ? BSKTheme.backgroundDeep : BSKTheme.muted)
                    .frame(maxWidth: .infinity)
                    .frame(height: 54)
                    .background(
                        section == item ? BSKTheme.accent : Color.clear,
                        in: RoundedRectangle(cornerRadius: 16, style: .continuous)
                    )
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(item.title)
                .accessibilityAddTraits(section == item ? .isSelected : [])
            }
        }
        .padding(6)
        .background(BSKTheme.elevated.opacity(0.98), in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).stroke(BSKTheme.border, lineWidth: 1))
        .shadow(color: .black.opacity(0.38), radius: 20, y: 8)
        .padding(.horizontal, 10)
        .padding(.bottom, 5)
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
        .bskListSurface()
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
        .bskListSurface()
    }
}
