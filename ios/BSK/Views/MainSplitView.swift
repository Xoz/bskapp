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
        case .observe: return "Matcher"
        case .evaluate: return "Utvärdera"
        case .players: return "Spelare"
        case .selection: return "Uttagning"
        case .settings: return "Inställningar"
        }
    }
    var icon: String {
        switch self {
        case .today: return "sun.max"
        case .observe: return "calendar"
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
    @State private var section: AppSection? = {
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("-ui-review"),
           let value = ProcessInfo.processInfo.environment["BSK_UI_SECTION"],
           let reviewSection = AppSection(rawValue: value) {
            return reviewSection
        }
        #endif
        return .today
    }()
    @State private var selectedPlayer: Int?
    @State private var selectedActivity: String?
    @State private var selectedEvaluation: Int?
    @State private var columnVisibility: NavigationSplitViewVisibility = .all
    @State private var compactNavigationID = UUID()
    @State private var showsAccount = false

    private var availableSections: [AppSection] {
        AppSection.allCases.filter { $0.isAvailable(to: model.user) }
    }

    private var currentSection: AppSection {
        if let section, availableSections.contains(section) { return section }
        return availableSections.first ?? .settings
    }

    var body: some View {
        Group {
            if horizontalSizeClass == .compact {
                compactRoot
            } else {
                regularRoot
            }
        }
        .background(BSKTheme.canvas)
        .toolbarBackground(BSKTheme.background.opacity(0.94), for: .navigationBar)
        .onAppear { normalizeSection() }
        .onChange(of: model.user?.id) { _, _ in normalizeSection() }
        .onChange(of: horizontalSizeClass) { _, _ in compactNavigationID = UUID() }
    }

    private var regularRoot: some View {
        NavigationSplitView(columnVisibility: $columnVisibility) {
            sidebar
        } content: {
            sectionContent
        } detail: {
            sectionDetail
        }
        .navigationSplitViewStyle(.balanced)
    }

    private var compactRoot: some View {
        NavigationStack {
            sectionContent
                .navigationDestination(for: String.self) { id in
                    compactStringDestination(id)
                }
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button { showsAccount = true } label: {
                            ZStack {
                                Circle().fill(BSKTheme.accent.opacity(0.16))
                                Text(String(model.user?.name.prefix(1) ?? "B"))
                                    .font(.caption.bold())
                                    .foregroundStyle(BSKTheme.accent)
                            }
                            .frame(width: 34, height: 34)
                        }
                        .accessibilityLabel("Öppna konto")
                    }
                }
        }
        .id(compactNavigationID)
        .safeAreaInset(edge: .bottom, spacing: 0) { compactNavigation }
        .sheet(isPresented: $showsAccount) {
            NavigationStack {
                AccountDetail()
                    .toolbar {
                        ToolbarItem(placement: .confirmationAction) {
                            Button("Klar") { showsAccount = false }
                        }
                    }
            }
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.visible)
        }
    }

    @ViewBuilder
    private var sectionContent: some View {
        switch currentSection {
        case .today:
            TodayList(selection: $selectedActivity)
        case .observe:
            ActivityWorkspaceList(selection: $selectedActivity)
        case .evaluate:
            MatchEvaluationList(selection: $selectedEvaluation)
        case .players:
            PlayerList(selection: $selectedPlayer)
        case .selection:
            PremiumSelectionList(selection: $selectedActivity)
        case .settings:
            if horizontalSizeClass == .compact { AccountDetail() }
            else { SettingsList() }
        }
    }

    @ViewBuilder
    private var sectionDetail: some View {
        switch currentSection {
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
                EmptyWorkspaceDetail(title: "Välj en match", message: "Öppna en Gul- eller Grönmatch för trupp, matchcenter och observationer.", icon: "calendar")
            }
        case .evaluate:
            if let selectedEvaluation {
                MatchEvaluationView(matchID: selectedEvaluation) {
                    self.selectedEvaluation = nil
                }
            } else {
                EmptyWorkspaceDetail(title: "Välj en match", message: "Fortsätt eller starta en spelarutvärdering.", icon: "checklist")
            }
        case .players:
            if let selectedPlayer {
                PlayerDetailView(playerID: selectedPlayer)
            } else {
                EmptyWorkspaceDetail(title: "Välj en spelare", message: "Profil, fokus och historik öppnas här.", icon: "person.crop.circle")
            }
        case .selection:
            if let id = selectedActivity, let match = model.selectionMatches.first(where: { $0.id == id }) {
                PremiumSelectionDetail(match: match)
            } else {
                EmptyWorkspaceDetail(title: "Välj en match", message: "Bygg och spara matchens trupp här.", icon: "sportscourt")
            }
        case .settings:
            AccountDetail()
        }
    }

    @ViewBuilder
    private func compactStringDestination(_ id: String) -> some View {
        if currentSection == .selection, let match = model.selectionMatches.first(where: { $0.id == id }) {
            PremiumSelectionDetail(match: match)
        } else if let activity = model.activities.first(where: { $0.id == id }) {
            ActivityDetail(activity: activity)
        } else {
            ContentUnavailableView("Innehållet finns inte längre", systemImage: "questionmark.folder")
        }
    }

    private var compactMenu: some View {
        Menu {
            ForEach(availableSections) { item in
                Button {
                    selectSection(item)
                } label: {
                    Label(item.title, systemImage: item.icon)
                }
            }
            Divider()
            Button(role: .destructive) {
                Task { await model.signOut() }
            } label: {
                Label("Logga ut", systemImage: "rectangle.portrait.and.arrow.right")
            }
        } label: {
            Image(systemName: "line.3.horizontal.circle.fill")
                .font(.title3)
                .foregroundStyle(BSKTheme.accent)
        }
        .accessibilityLabel("Alla arbetsytor")
    }

    private func normalizeSection() {
        if section == nil || !availableSections.contains(section!) {
            section = availableSections.first ?? .settings
            resetSelections()
        }
    }

    private func selectSection(_ item: AppSection) {
        withAnimation(.easeOut(duration: 0.16)) {
            section = item
            resetSelections()
            compactNavigationID = UUID()
        }
    }

    private func resetSelections() {
        selectedPlayer = nil
        selectedActivity = nil
        selectedEvaluation = nil
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
            selectSection(item)
        } label: {
            HStack(spacing: 12) {
                Image(systemName: item.icon)
                    .font(.system(size: 16, weight: .semibold))
                    .frame(width: 24)
                Text(item.title).font(.subheadline.weight(.semibold))
                Spacer()
                if currentSection == item {
                    Circle().fill(BSKTheme.accent).frame(width: 6, height: 6)
                }
            }
            .foregroundStyle(currentSection == item ? .white : BSKTheme.secondary)
            .padding(.horizontal, 12)
            .frame(height: 46)
            .background(
                currentSection == item ? BSKTheme.accent.opacity(0.13) : Color.clear,
                in: RoundedRectangle(cornerRadius: 14, style: .continuous)
            )
            .overlay(alignment: .leading) {
                if currentSection == item {
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
                    selectSection(item)
                } label: {
                    VStack(spacing: 5) {
                        Image(systemName: item.icon)
                            .font(.system(size: 18, weight: currentSection == item ? .bold : .medium))
                        Text(item.title)
                            .font(.system(size: 9, weight: .bold))
                            .lineLimit(1)
                    }
                    .foregroundStyle(currentSection == item ? BSKTheme.backgroundDeep : BSKTheme.muted)
                    .frame(maxWidth: .infinity)
                    .frame(height: 54)
                    .background(
                        currentSection == item ? BSKTheme.accent : Color.clear,
                        in: RoundedRectangle(cornerRadius: 16, style: .continuous)
                    )
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(item.title)
                .accessibilityAddTraits(currentSection == item ? .isSelected : [])
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
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                BSKPageHeader(eyebrow: "Personligt", title: "Konto", message: "Din identitet, roll och åtkomst i BSK.")
                HStack(spacing: 14) {
                    Circle()
                        .fill(BSKTheme.accent.opacity(0.14))
                        .overlay(Text(String(model.user?.name.prefix(1) ?? "B")).font(.title.bold()).foregroundStyle(BSKTheme.accent))
                        .frame(width: 62, height: 62)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(model.user?.name ?? "BSK-konto").font(.headline)
                        Text(model.user?.email ?? "").font(.caption).foregroundStyle(BSKTheme.secondary)
                    }
                    Spacer()
                    Image(systemName: "checkmark.seal.fill").foregroundStyle(BSKTheme.accent)
                }
                .padding(18)
                .bskCardSurface()
            }
            .padding(20)
        }
        .navigationTitle("Inställningar")
        .background(BSKBackdrop())
    }
}

private struct AccountDetail: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: horizontalSizeClass == .compact ? 14 : 22) {
                VStack(spacing: 12) {
                    Circle()
                        .fill(LinearGradient(colors: [BSKTheme.accent, BSKTheme.accent.opacity(0.55)], startPoint: .topLeading, endPoint: .bottomTrailing))
                        .overlay(Text(String(model.user?.name.prefix(1) ?? "B")).font(.system(size: 34, weight: .black)).foregroundStyle(BSKTheme.backgroundDeep))
                        .frame(width: horizontalSizeClass == .compact ? 62 : 88, height: horizontalSizeClass == .compact ? 62 : 88)
                    Text(model.user?.name ?? "BSK-konto").font(horizontalSizeClass == .compact ? .title2.bold() : .title.bold())
                    Text(model.user?.email ?? "").font(.subheadline).foregroundStyle(BSKTheme.secondary)
                    BSKStatusChip(title: model.user?.primaryRole ?? "medlem")
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)

                VStack(spacing: 0) {
                    accountRow("Miljö", value: "BSK F2014", icon: "shield.lefthalf.filled")
                    Divider().overlay(BSKTheme.hairline)
                    accountRow("Status", value: "Synkroniserad", icon: "checkmark.icloud.fill")
                    Divider().overlay(BSKTheme.hairline)
                    accountRow("Åtkomst", value: "Behörighetsstyrd", icon: "lock.shield.fill")
                    Divider().overlay(BSKTheme.hairline)
                    accountRow("Version", value: appVersion, icon: "number.circle.fill")
                }
                .padding(.horizontal, 16)
                .bskCardSurface()

                Button(role: .destructive) { Task { await model.signOut() } } label: {
                    Label("Logga ut", systemImage: "rectangle.portrait.and.arrow.right")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 15)
                }
                .buttonStyle(.plain)
                .foregroundStyle(BSKTheme.danger)
                .background(BSKTheme.danger.opacity(0.08), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(BSKTheme.danger.opacity(0.22)))
            }
            .padding(horizontalSizeClass == .compact ? 16 : 22)
            .frame(maxWidth: 620)
            .frame(maxWidth: .infinity)
        }
        .navigationTitle("Konto")
        .background(BSKBackdrop())
    }

    private var appVersion: String {
        let info = Bundle.main.infoDictionary
        let version = info?["CFBundleShortVersionString"] as? String ?? "0.000"
        let build = info?["CFBundleVersion"] as? String ?? "0"
        return "v\(version) (\(build))"
    }

    private func accountRow(_ title: String, value: String, icon: String) -> some View {
        HStack(spacing: 13) {
            Image(systemName: icon).foregroundStyle(BSKTheme.accent).frame(width: 24)
            Text(title).foregroundStyle(BSKTheme.secondary)
            Spacer()
            Text(value).fontWeight(.semibold)
        }
        .padding(.vertical, 15)
    }
}

private struct ActivityWorkspaceList: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @Binding var selection: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                BSKPageHeader(
                    eyebrow: "GUL OCH GRÖN",
                    title: "Matcher",
                    message: "Alla lagens matcher på samma plats. Gulspelare som lånas till Grön markeras direkt.",
                    trailing: "\(model.activities.count) matcher"
                )

                if model.activities.isEmpty {
                    ContentUnavailableView(
                        "Inga matcher",
                        systemImage: "sportscourt",
                        description: Text("Gul- och Grönmatcher visas här när de har hämtats.")
                    )
                    .frame(maxWidth: .infinity, minHeight: 360)
                } else {
                    if !upcomingMatches.isEmpty {
                        matchSection(title: "Kommande", matches: upcomingMatches)
                    }
                    if !playedMatches.isEmpty {
                        matchSection(title: "Spelade", matches: playedMatches)
                    }
                }
            }
            .padding(horizontalSizeClass == .compact ? 14 : 18)
            .frame(maxWidth: 980)
            .frame(maxWidth: .infinity)
        }
        .navigationTitle("")
        .background(BSKBackdrop())
        .refreshable { await model.reload() }
    }

    private func matchSection(title: String, matches: [ActivitySummary]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .bottom) {
                Text(title)
                    .font(.title2.bold())
                    .foregroundStyle(.white)
                Spacer()
                Text("\(matches.count) \(matches.count == 1 ? "match" : "matcher")")
                    .font(.caption)
                    .foregroundStyle(BSKTheme.muted)
            }

            LazyVGrid(columns: [GridItem(.adaptive(minimum: 340), spacing: 11)], spacing: 11) {
                ForEach(matches) { activity in
                    activityLink(activity)
                }
            }
        }
    }

    @ViewBuilder
    private func activityLink(_ activity: ActivitySummary) -> some View {
        if horizontalSizeClass == .compact {
            NavigationLink { ActivityDetail(activity: activity) } label: { activityCard(activity) }
                .buttonStyle(.plain)
        } else {
            Button { selection = activity.id } label: { activityCard(activity) }
                .buttonStyle(.plain)
        }
    }

    private func activityCard(_ activity: ActivitySummary) -> some View {
        HStack(spacing: 13) {
            dateTile(activity.date)
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 7) {
                    Text(activity.sourceTeam.isEmpty ? "MATCH" : activity.sourceTeam.uppercased())
                        .font(.system(size: 10, weight: .black))
                        .tracking(0.8)
                        .foregroundStyle(BSKTheme.backgroundDeep)
                        .padding(.horizontal, 9)
                        .padding(.vertical, 4)
                        .background(teamColor(activity.sourceTeam), in: Capsule())
                    Text(activity.matchLevel)
                        .font(.caption2.bold())
                        .foregroundStyle(levelColor(activity.matchLevel))
                        .padding(.horizontal, 7)
                        .padding(.vertical, 4)
                        .background(levelColor(activity.matchLevel).opacity(0.12), in: Capsule())
                    Spacer(minLength: 2)
                    Text(activity.startTime ?? "--:--")
                        .font(.system(size: 20, weight: .black, design: .rounded))
                        .monospacedDigit()
                        .foregroundStyle(.white)
                }

                Text(activity.title)
                    .font(.subheadline.bold())
                    .foregroundStyle(.white)
                    .lineLimit(1)

                if !displayedRoster(activity).isEmpty {
                    Text("\(rosterLabel(activity)): \(displayedRoster(activity).joined(separator: ", "))")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(BSKTheme.secondary)
                        .lineLimit(2)
                } else {
                    Text("Ingen trupp registrerad")
                        .font(.caption)
                        .foregroundStyle(BSKTheme.muted)
                }

                if !activity.loanedPlayerNames.isEmpty {
                    Label("Gul-lån: \(activity.loanedPlayerNames.joined(separator: ", "))", systemImage: "arrow.left.arrow.right")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(BSKTheme.accent)
                        .lineLimit(1)
                        .minimumScaleFactor(0.78)
                } else if activity.finished || activity.date < today {
                    Text(matchStatus(activity))
                        .font(.caption)
                        .foregroundStyle(BSKTheme.muted)
                }
            }

            Image(systemName: "chevron.right")
                .font(.caption.bold())
                .foregroundStyle(BSKTheme.muted)
        }
        .padding(13)
        .frame(maxWidth: .infinity, minHeight: 122, alignment: .leading)
        .background(BSKTheme.surface, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(selection == activity.id ? BSKTheme.accent : BSKTheme.border, lineWidth: selection == activity.id ? 2 : 1)
        )
        .contentShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
    }

    private func dateTile(_ date: String) -> some View {
        let parts = date.split(separator: "-").compactMap { Int($0) }
        let day = parts.count == 3 ? parts[2] : 0
        let month = parts.count == 3 ? parts[1] : 0
        let year = parts.count == 3 ? parts[0] % 100 : 0
        let months = ["JAN", "FEB", "MAR", "APR", "MAJ", "JUN", "JUL", "AUG", "SEP", "OKT", "NOV", "DEC"]
        let monthText = (1...12).contains(month) ? months[month - 1] : ""

        return VStack(spacing: 1) {
            Text(String(format: "%02d", day))
                .font(.system(size: 21, weight: .black, design: .rounded))
                .foregroundStyle(.white)
            Text("\(monthText) \(String(format: "%02d", year))")
                .font(.system(size: 9, weight: .bold))
                .tracking(0.6)
                .foregroundStyle(BSKTheme.muted)
        }
        .frame(width: 58, height: 64)
        .background(BSKTheme.elevated, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(BSKTheme.border))
    }

    private var upcomingMatches: [ActivitySummary] {
        model.activities
            .filter { !$0.finished && $0.date >= today }
            .sorted(by: ascendingMatchOrder)
    }

    private var playedMatches: [ActivitySummary] {
        model.activities
            .filter { $0.finished || $0.date < today }
            .sorted { ascendingMatchOrder($1, $0) }
    }

    private var today: String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "sv_SE")
        formatter.timeZone = TimeZone(identifier: "Europe/Stockholm")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: Date())
    }

    private func matchStatus(_ activity: ActivitySummary) -> String {
        if activity.finished { return "Avslutad" }
        if activity.date < today { return "Ej avslutad" }
        return "Ingen Gulspelare utlånad"
    }

    private func displayedRoster(_ activity: ActivitySummary) -> [String] {
        activity.squadPlayerNames.isEmpty ? activity.acceptedPlayerNames : activity.squadPlayerNames
    }

    private func rosterLabel(_ activity: ActivitySummary) -> String {
        activity.squadPlayerNames.isEmpty ? "Tackat ja" : "Trupp"
    }

    private func levelColor(_ level: String?) -> Color {
        switch level {
        case "Lätt", "Extra lätt": return BSKTheme.accent
        case "Medel": return BSKTheme.warning
        case "Svår", "Extra svår": return BSKTheme.danger
        default: return BSKTheme.muted
        }
    }

    private func teamColor(_ team: String) -> Color {
        team == "Gul" ? BSKTheme.teamYellow : BSKTheme.accent
    }

    private func ascendingMatchOrder(_ lhs: ActivitySummary, _ rhs: ActivitySummary) -> Bool {
        lhs.date == rhs.date
            ? (lhs.startTime ?? "") < (rhs.startTime ?? "")
            : lhs.date < rhs.date
    }
}

private struct PremiumSelectionList: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @Binding var selection: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                pageHeader

                if !thisWeekMatches.isEmpty {
                    matchSection(
                        eyebrow: "PRIORITERA NU",
                        title: "Den här veckan",
                        matches: thisWeekMatches
                    )
                }

                if !laterMatches.isEmpty {
                    matchSection(
                        eyebrow: "PLANERA FRAMÅT",
                        title: "Senare matcher",
                        matches: laterMatches
                    )
                }
            }
            .padding(.horizontal, horizontalSizeClass == .compact ? 20 : 28)
            .padding(.top, 20)
            .padding(.bottom, 32)
            .frame(maxWidth: 1040)
            .frame(maxWidth: .infinity)
        }
        .navigationTitle("")
        .background(BSKBackdrop())
        .refreshable { await model.reload() }
        .overlay {
            if model.selectionMatches.isEmpty { ContentUnavailableView("Inga matcher för uttagning", systemImage: "person.badge.plus") }
        }
    }

    @ViewBuilder
    private func matchLink(_ match: SelectionMatchSummary) -> some View {
        if horizontalSizeClass == .compact {
            NavigationLink(value: match.id) { matchRow(match) }.buttonStyle(.plain)
        } else {
            Button { selection = match.id } label: { matchRow(match) }.buttonStyle(.plain)
        }
    }

    private var pageHeader: some View {
        VStack(alignment: .leading, spacing: 9) {
            HStack(spacing: 9) {
                Capsule().fill(BSKTheme.accent).frame(width: 24, height: 3)
                Text("TRANSPARENT BESLUTSSTÖD")
                    .font(.system(size: 11, weight: .black))
                    .tracking(1.6)
                    .foregroundStyle(BSKTheme.accent)
            }
            Text("Uttagning")
                .font(.system(size: horizontalSizeClass == .compact ? 34 : 42, weight: .black, design: .rounded))
                .foregroundStyle(.white)
            Text("Gula lagets kommande Sanktanmatcher. Se kallelser och svar eller skapa ett rättvist lagförslag.")
                .font(.subheadline)
                .foregroundStyle(BSKTheme.secondary)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: 620, alignment: .leading)
        }
    }

    private func matchSection(eyebrow: String, title: String, matches: [SelectionMatchSummary]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .bottom) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(eyebrow)
                        .font(.system(size: 10, weight: .black))
                        .tracking(1.5)
                        .foregroundStyle(BSKTheme.accent)
                    Text(title)
                        .font(.title2.bold())
                        .foregroundStyle(.white)
                }
                Spacer()
                Text("\(matches.count) \(matches.count == 1 ? "match" : "matcher")")
                    .font(.caption)
                    .foregroundStyle(BSKTheme.muted)
            }

            LazyVGrid(columns: [GridItem(.adaptive(minimum: 340), spacing: 11)], spacing: 11) {
                ForEach(matches) { match in matchLink(match) }
            }
        }
    }

    private func matchRow(_ match: SelectionMatchSummary) -> some View {
        let called = match.acceptedCallupCount + match.declinedCallupCount + match.pendingCallupCount
        let effectiveCount = match.hasConfirmedSquad ? match.squadCount : match.acceptedCallupCount
        let missing = (match.hasConfirmedSquad || called > 0) ? max(0, 9 - effectiveCount) : 0
        let extra = max(0, effectiveCount - 9)

        return HStack(spacing: 13) {
            dateTile(match.date)

            VStack(alignment: .leading, spacing: 7) {
                HStack(spacing: 7) {
                    Text(match.sourceTeam.uppercased())
                        .font(.system(size: 10, weight: .black))
                        .tracking(0.8)
                        .foregroundStyle(BSKTheme.backgroundDeep)
                        .padding(.horizontal, 9)
                        .padding(.vertical, 4)
                        .background(match.sourceTeam == "Gul" ? BSKTheme.teamYellow : BSKTheme.accent, in: Capsule())

                    if let level = levelLabel(match.competitionLevel) {
                        Text(level)
                            .font(.caption.bold())
                            .foregroundStyle(BSKTheme.secondary)
                    }

                    Spacer(minLength: 2)

                    if missing > 0 {
                        Text("Saknar \(missing)")
                            .font(.caption2.bold())
                            .foregroundStyle(BSKTheme.warning)
                            .padding(.horizontal, 7)
                            .padding(.vertical, 4)
                            .background(BSKTheme.warning.opacity(0.12), in: Capsule())
                    } else if extra > 0 {
                        Text("\(extra) extra")
                            .font(.caption2.bold())
                            .foregroundStyle(BSKTheme.warning)
                            .padding(.horizontal, 7)
                            .padding(.vertical, 4)
                            .background(BSKTheme.warning.opacity(0.12), in: Capsule())
                    } else if match.hasConfirmedSquad {
                        Text("Trupp klar")
                            .font(.caption2.bold())
                            .foregroundStyle(BSKTheme.accent)
                    }

                    Text(match.startTime ?? "--:--")
                        .font(.system(size: 20, weight: .black, design: .rounded))
                        .monospacedDigit()
                        .foregroundStyle(.white)
                }

                Text(match.title)
                    .font(.subheadline.bold())
                    .foregroundStyle(.white)
                    .lineLimit(1)

                if match.hasConfirmedSquad {
                    HStack(spacing: 8) {
                        Text("\(match.squadCount) i truppen").foregroundStyle(.white)
                        if called > 0 {
                            Text("\(match.acceptedCallupCount) ja").foregroundStyle(BSKTheme.accent)
                            Text("\(match.declinedCallupCount) nej").foregroundStyle(BSKTheme.danger)
                            Text("\(match.pendingCallupCount) väntar").foregroundStyle(BSKTheme.muted)
                        }
                    }
                    .font(.system(size: 11, weight: .semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.72)
                } else if called > 0 {
                    HStack(spacing: 8) {
                        Text("\(called) kallade").foregroundStyle(BSKTheme.secondary)
                        Text("\(match.acceptedCallupCount) ja").foregroundStyle(BSKTheme.accent)
                        Text("\(match.declinedCallupCount) nej").foregroundStyle(BSKTheme.danger)
                        Text("\(match.pendingCallupCount) väntar").foregroundStyle(BSKTheme.muted)
                    }
                    .font(.system(size: 11, weight: .semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.78)
                } else {
                    Text("Ingen kallelse registrerad ännu")
                        .font(.caption)
                        .foregroundStyle(BSKTheme.muted)
                }
            }

            Image(systemName: "chevron.right")
                .font(.caption.bold())
                .foregroundStyle(BSKTheme.muted)
        }
        .padding(13)
        .frame(maxWidth: .infinity, minHeight: 104, alignment: .leading)
        .background(BSKTheme.surface, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(selection == match.id ? BSKTheme.accent : BSKTheme.border, lineWidth: selection == match.id ? 2 : 1)
        )
        .contentShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
    }

    private func dateTile(_ date: String) -> some View {
        let parts = date.split(separator: "-").compactMap { Int($0) }
        let day = parts.count == 3 ? parts[2] : 0
        let month = parts.count == 3 ? parts[1] : 0
        let year = parts.count == 3 ? parts[0] % 100 : 0
        let months = ["JAN", "FEB", "MAR", "APR", "MAJ", "JUN", "JUL", "AUG", "SEP", "OKT", "NOV", "DEC"]
        let monthText = (1...12).contains(month) ? months[month - 1] : ""

        return VStack(spacing: 1) {
            Text(String(format: "%02d", day))
                .font(.system(size: 21, weight: .black, design: .rounded))
                .foregroundStyle(.white)
            Text("\(monthText) \(String(format: "%02d", year))")
                .font(.system(size: 9, weight: .bold))
                .tracking(0.6)
                .foregroundStyle(BSKTheme.muted)
        }
        .frame(width: 58, height: 64)
        .background(BSKTheme.elevated, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(BSKTheme.border))
    }

    private var sortedMatches: [SelectionMatchSummary] {
        model.selectionMatches.sorted {
            $0.date == $1.date ? ($0.startTime ?? "") < ($1.startTime ?? "") : $0.date < $1.date
        }
    }

    private var thisWeekMatches: [SelectionMatchSummary] {
        sortedMatches.filter { $0.date <= weekEnd }
    }

    private var laterMatches: [SelectionMatchSummary] {
        sortedMatches.filter { $0.date > weekEnd }
    }

    private var weekEnd: String {
        var calendar = Calendar(identifier: .iso8601)
        calendar.timeZone = TimeZone(identifier: "Europe/Stockholm") ?? .current
        let end = calendar.dateInterval(of: .weekOfYear, for: Date())?.end.addingTimeInterval(-1) ?? Date()
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.timeZone = calendar.timeZone
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: end)
    }

    private func levelLabel(_ competitionLevel: Int?) -> String? {
        switch competitionLevel {
        case 1: return "Extra svår"
        case 2: return "Svår"
        case 3: return "Medel"
        case 4: return "Lätt"
        case 5: return "Extra lätt"
        default: return nil
        }
    }
}

private struct PremiumSelectionDetail: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    let match: SelectionMatchSummary
    @State private var workspace: SelectionWorkspace?
    @State private var decisions: [Int: String] = [:]
    @State private var isSaving = false
    @State private var savedMessage: String?
    @State private var mobileFilter = "all"

    var body: some View {
        Group {
            if let workspace {
                workspaceContent(workspace)
                .background(BSKBackdrop())
                .safeAreaInset(edge: .bottom) {
                    if horizontalSizeClass != .compact { saveBar }
                }
            } else {
                ZStack { BSKBackdrop(); ProgressView("Förbereder uttagning…").tint(BSKTheme.accent) }
            }
        }
        .navigationTitle(match.title)
        .task(id: match.id) { await load() }
    }

    @ViewBuilder
    private func workspaceContent(_ workspace: SelectionWorkspace) -> some View {
        if horizontalSizeClass == .compact {
            ScrollView {
                LazyVStack(spacing: 10) {
                    compactOverview(workspace)
                    compactConfirmButton
                    filterBar(workspace)
                    ForEach(filteredCandidates(workspace)) { candidate in
                        compactCandidateRow(candidate)
                    }
                }
                .padding(.horizontal, 12)
                .padding(.top, 8)
                .padding(.bottom, 12)
            }
        } else {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    summaryCard
                    BSKPageHeader(
                        eyebrow: "Truppbeslut",
                        title: "\(selectedCount) valda",
                        message: "Välj spelare och bekräfta sedan matchtruppen.",
                        trailing: "\(workspace.candidates.count) tillgängliga"
                    )
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 300), spacing: 13)], spacing: 13) {
                        ForEach(workspace.candidates) { candidate in candidateCard(candidate) }
                    }
                }
                .padding(18)
                .frame(maxWidth: 1050)
                .frame(maxWidth: .infinity)
            }
        }
    }

    private func compactOverview(_ workspace: SelectionWorkspace) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("UTTAGNING").font(.system(size: 10, weight: .black)).tracking(1.7).foregroundStyle(BSKTheme.accent)
                    Text(match.title).font(.title2.bold()).lineLimit(2)
                    Text([match.date, match.startTime].compactMap { $0 }.joined(separator: " · "))
                        .font(.caption).foregroundStyle(BSKTheme.secondary)
                }
                Spacer()
                if let savedMessage {
                    Image(systemName: "checkmark.circle.fill").foregroundStyle(BSKTheme.accent).accessibilityLabel(savedMessage)
                }
            }
            HStack(spacing: 12) {
                Label("\(selectedCount) valda", systemImage: "checkmark.circle.fill").foregroundStyle(BSKTheme.accent)
                Text("\(count("reserve", in: workspace)) reserv").foregroundStyle(BSKTheme.warning)
                Text("\(count("rested", in: workspace)) vilar").foregroundStyle(BSKTheme.muted)
            }
            .font(.caption.bold())
            if selectedCount > 0 {
                Divider().overlay(BSKTheme.border)
                VStack(alignment: .leading, spacing: 7) {
                    Text("TRUPP ATT BEKRÄFTA")
                        .font(.system(size: 9, weight: .black))
                        .tracking(1.2)
                        .foregroundStyle(BSKTheme.secondary)
                    ForEach(selectedCandidates(in: workspace)) { candidate in
                        HStack(spacing: 8) {
                            Text(candidate.name).font(.caption.bold()).lineLimit(1)
                            Spacer(minLength: 8)
                            Text(primaryPosition(candidate))
                                .font(.caption2.bold())
                                .foregroundStyle(BSKTheme.secondary)
                        }
                    }
                }
            }
        }
        .padding(13)
        .background(BSKTheme.hero, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(BSKTheme.accent.opacity(0.3)))
    }

    private func overviewMetric(_ value: Int, _ label: String, _ color: Color) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(String(value)).font(.title3.bold()).monospacedDigit().foregroundStyle(color)
            Text(label).font(.caption2.bold()).foregroundStyle(BSKTheme.secondary)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 9)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(BSKTheme.backgroundDeep.opacity(0.55), in: RoundedRectangle(cornerRadius: 13, style: .continuous))
    }

    private var compactConfirmButton: some View {
        Button { Task { await save() } } label: {
            HStack {
                if isSaving { ProgressView().tint(BSKTheme.backgroundDeep) }
                Text(isSaving ? "Bekräftar…" : "Bekräfta trupp")
                Spacer()
                Text("\(selectedCount) spelare").opacity(0.7)
            }
            .font(.subheadline.bold())
            .foregroundStyle(BSKTheme.backgroundDeep)
            .padding(.horizontal, 15)
            .frame(height: 48)
        }
        .buttonStyle(.plain)
        .background(BSKTheme.accent, in: RoundedRectangle(cornerRadius: 15, style: .continuous))
        .disabled(isSaving || selectedCount == 0)
    }

    private func filterBar(_ workspace: SelectionWorkspace) -> some View {
        HStack(spacing: 6) {
            mobileFilterButton("Alla", value: "all", count: workspace.candidates.count)
            mobileFilterButton("Valda", value: "selected", count: selectedCount)
            mobileFilterButton("Reserv", value: "reserve", count: count("reserve", in: workspace))
            mobileFilterButton("Vilar", value: "rested", count: count("rested", in: workspace))
        }
        .padding(5)
        .background(BSKTheme.elevated, in: RoundedRectangle(cornerRadius: 15, style: .continuous))
    }

    private func mobileFilterButton(_ title: String, value: String, count: Int) -> some View {
        let active = mobileFilter == value
        return Button {
            withAnimation(.easeOut(duration: 0.16)) { mobileFilter = value }
        } label: {
            VStack(spacing: 1) {
                Text(title).font(.caption2.bold())
                Text(String(count)).font(.system(size: 9, weight: .bold)).monospacedDigit().opacity(0.7)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 7)
            .foregroundStyle(active ? BSKTheme.backgroundDeep : BSKTheme.secondary)
            .background(active ? BSKTheme.accent : Color.clear, in: RoundedRectangle(cornerRadius: 11, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    private func compactCandidateRow(_ candidate: SelectionCandidate) -> some View {
        VStack(spacing: 7) {
            HStack(spacing: 10) {
                ZStack {
                    RoundedRectangle(cornerRadius: 12, style: .continuous).fill(decisionColor(candidate).opacity(0.13))
                    Text(String(candidate.name.prefix(1))).font(.subheadline.bold()).foregroundStyle(decisionColor(candidate))
                }
                .frame(width: 40, height: 40)

                VStack(alignment: .leading, spacing: 2) {
                    Text(candidate.name).font(.subheadline.bold()).lineLimit(1)
                    HStack(spacing: 5) {
                        if let status = candidate.currentCallupStatus {
                            Circle().fill(status == "accepted" ? BSKTheme.accent : status == "declined" ? BSKTheme.danger : BSKTheme.warning).frame(width: 6, height: 6)
                            Text(callupLabel(status)).font(.caption2).foregroundStyle(BSKTheme.muted)
                        }
                        Text("\(candidate.windowMatchCount) matcher ±7 dagar").font(.caption2).foregroundStyle(BSKTheme.muted)
                    }
                }
                Spacer(minLength: 4)
                HStack(spacing: 5) {
                    compactDecisionButton(candidate, value: "selected", icon: "checkmark", label: "Vald")
                    compactDecisionButton(candidate, value: "reserve", icon: "hourglass", label: "Reserv")
                    compactDecisionButton(candidate, value: "rested", icon: "moon.zzz", label: "Vilar")
                }
            }

        }
        .padding(9)
        .background(BSKTheme.surface, in: RoundedRectangle(cornerRadius: 15, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 15, style: .continuous).stroke(decision(candidate) == "selected" ? BSKTheme.accent.opacity(0.4) : BSKTheme.border))
    }

    private func compactDecisionButton(_ candidate: SelectionCandidate, value: String, icon: String, label: String) -> some View {
        let active = decision(candidate) == value
        return Button {
            decisions[candidate.playerId] = value
            savedMessage = nil
        } label: {
            Image(systemName: icon)
                .font(.system(size: 12, weight: .bold))
                .frame(width: 34, height: 34)
                .foregroundStyle(active ? BSKTheme.backgroundDeep : BSKTheme.muted)
                .background(active ? decisionColor(value) : BSKTheme.backgroundDeep.opacity(0.6), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .accessibilityAddTraits(active ? .isSelected : [])
    }

    private func filteredCandidates(_ workspace: SelectionWorkspace) -> [SelectionCandidate] {
        guard mobileFilter != "all" else { return workspace.candidates }
        return workspace.candidates.filter { decision($0) == mobileFilter }
    }

    private func count(_ value: String, in workspace: SelectionWorkspace) -> Int {
        workspace.candidates.filter { decision($0) == value }.count
    }

    private func decisionColor(_ candidate: SelectionCandidate) -> Color { decisionColor(decision(candidate)) }
    private func decisionColor(_ value: String) -> Color {
        value == "selected" ? BSKTheme.accent : value == "reserve" ? BSKTheme.warning : BSKTheme.muted
    }

    private var summaryCard: some View {
        HStack(spacing: 16) {
            ZStack {
                RoundedRectangle(cornerRadius: 20, style: .continuous).fill(BSKTheme.accent)
                Image(systemName: "sportscourt.fill").font(.title.bold()).foregroundStyle(BSKTheme.backgroundDeep)
            }.frame(width: 68, height: 68)
            VStack(alignment: .leading, spacing: 5) {
                BSKStatusChip(title: "Match")
                Text(match.title).font(.title2.bold())
                Text([match.date, match.startTime].compactMap { $0 }.joined(separator: " · ")).font(.caption).foregroundStyle(BSKTheme.secondary)
            }
            Spacer()
            if let savedMessage { Label(savedMessage, systemImage: "checkmark.circle.fill").font(.caption.bold()).foregroundStyle(BSKTheme.accent) }
        }
        .padding(20)
        .background(BSKTheme.hero, in: RoundedRectangle(cornerRadius: 26, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 26, style: .continuous).stroke(BSKTheme.accent.opacity(0.3)))
    }

    private func candidateCard(_ candidate: SelectionCandidate) -> some View {
        VStack(alignment: .leading, spacing: 15) {
            HStack {
                ZStack {
                    RoundedRectangle(cornerRadius: 14, style: .continuous).fill(BSKTheme.accent.opacity(0.12))
                    Text(String(candidate.name.prefix(1))).font(.headline.bold()).foregroundStyle(BSKTheme.accent)
                }.frame(width: 46, height: 46)
                VStack(alignment: .leading, spacing: 3) {
                    Text(candidate.name).font(.headline)
                    Text(candidate.teamNames.isEmpty ? "Ingen lagkoppling" : candidate.teamNames.joined(separator: " · ")).font(.caption2).foregroundStyle(BSKTheme.muted).lineLimit(1)
                }
                Spacer()
                if let status = candidate.currentCallupStatus {
                    BSKStatusChip(title: callupLabel(status), color: status == "declined" ? BSKTheme.danger : status == "accepted" ? BSKTheme.accent : BSKTheme.warning)
                }
            }
            HStack(spacing: 7) {
                decisionButton(candidate, value: "selected", title: "Vald")
                decisionButton(candidate, value: "reserve", title: "Reserv")
                decisionButton(candidate, value: "rested", title: "Vilar")
            }
            Text("\(candidate.windowMatchCount) matcher under perioden ±7 dagar")
                .font(.caption2).foregroundStyle(BSKTheme.muted)
        }
        .padding(16)
        .background(BSKTheme.surface, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).stroke(decision(candidate) == "selected" ? BSKTheme.accent.opacity(0.5) : BSKTheme.border))
    }

    private func decisionButton(_ candidate: SelectionCandidate, value: String, title: String) -> some View {
        let active = decision(candidate) == value
        return Button {
            decisions[candidate.playerId] = value
            savedMessage = nil
        } label: {
            Text(title).font(.caption.bold()).frame(maxWidth: .infinity).padding(.vertical, 10)
                .foregroundStyle(active ? BSKTheme.backgroundDeep : BSKTheme.secondary)
                .background(active ? BSKTheme.accent : BSKTheme.backgroundDeep.opacity(0.55), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        }.buttonStyle(.plain)
    }

    private var saveBar: some View {
        Button { Task { await save() } } label: {
            HStack {
                if isSaving { ProgressView().tint(BSKTheme.backgroundDeep) }
                Text(isSaving ? "Bekräftar…" : "Bekräfta trupp")
                Spacer()
                Text("\(selectedCount) valda").opacity(0.7)
            }
            .font(.headline).foregroundStyle(BSKTheme.backgroundDeep).padding(.horizontal, 18).frame(height: 56)
        }
        .buttonStyle(.plain).background(BSKTheme.accent, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .disabled(isSaving).padding(.horizontal, 14).padding(.bottom, 6)
        .background(.ultraThinMaterial)
    }

    private var selectedCount: Int { decisions.values.filter { $0 == "selected" }.count }
    private func decision(_ candidate: SelectionCandidate) -> String { decisions[candidate.playerId] ?? candidate.decision }
    private func selectedCandidates(in workspace: SelectionWorkspace) -> [SelectionCandidate] {
        workspace.candidates.filter { decision($0) == "selected" }
    }
    private func primaryPosition(_ candidate: SelectionCandidate) -> String {
        candidate.primaryPosition.isEmpty ? (candidate.position.isEmpty ? "Position saknas" : candidate.position) : candidate.primaryPosition
    }
    private func callupLabel(_ status: String) -> String { status == "accepted" ? "Ja" : status == "declined" ? "Nej" : "Väntar" }

    @MainActor private func load() async {
        do {
            let loaded = try await model.selectionWorkspace(id: match.id)
            workspace = loaded
            decisions = Dictionary(uniqueKeysWithValues: loaded.candidates.map { ($0.playerId, $0.decision) })
        } catch { model.errorMessage = error.localizedDescription }
    }

    @MainActor private func save() async {
        guard let workspace else { return }
        isSaving = true
        savedMessage = nil
        defer { isSaving = false }
        let payload = workspace.candidates.map { SelectionDecision(playerId: $0.playerId, decision: decision($0), position: primaryPosition($0)) }
        do {
            self.workspace = try await model.saveSelection(id: match.id, decisions: payload)
            savedMessage = "Trupp bekräftad"
        } catch { model.errorMessage = error.localizedDescription }
    }
}

private struct EmptyWorkspaceDetail: View {
    let title: String
    let message: String
    let icon: String

    var body: some View {
        ZStack {
            BSKBackdrop()
            VStack(spacing: 16) {
                ZStack {
                    RoundedRectangle(cornerRadius: 24, style: .continuous).fill(BSKTheme.hero)
                    Image(systemName: icon).font(.system(size: 32, weight: .bold)).foregroundStyle(BSKTheme.accent)
                }
                .frame(width: 88, height: 88)
                Text(title).font(.title2.bold())
                Text(message).font(.subheadline).foregroundStyle(BSKTheme.secondary).multilineTextAlignment(.center)
            }
            .padding(28)
        }
    }
}
