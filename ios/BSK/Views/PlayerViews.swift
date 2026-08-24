import SwiftUI

struct PlayerList: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @Binding var selection: Int?
    @State private var searchText = ""

    private var filteredPlayers: [PlayerSummary] {
        guard !searchText.isEmpty else { return model.players }
        return model.players.filter { $0.name.localizedCaseInsensitiveContains(searchText) }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                HStack(alignment: .bottom) {
                    VStack(alignment: .leading, spacing: 5) {
                        Text("TRUPPEN").font(.caption2.bold()).tracking(1.6).foregroundStyle(BSKTheme.accent)
                        Text("\(filteredPlayers.count) spelare").font(.title.bold())
                    }
                    Spacer()
                    Text("\(model.players.filter { !$0.activeGoals.isEmpty }.count) med fokus")
                        .font(.caption.bold()).foregroundStyle(BSKTheme.accent)
                }
                LazyVGrid(columns: [GridItem(.adaptive(minimum: horizontalSizeClass == .compact ? 320 : 155), spacing: 10)], spacing: 10) {
                    ForEach(filteredPlayers) { player in
                        playerLink(player)
                    }
                }
            }
            .padding(16)
            .frame(maxWidth: 900)
            .frame(maxWidth: .infinity)
        }
        .navigationTitle("Spelare")
        .searchable(text: $searchText, prompt: "Sök spelare")
        .background(BSKTheme.canvas)
        .refreshable { await model.reload() }
        .overlay {
            if model.players.isEmpty {
                ContentUnavailableView("Ingen trupp", systemImage: "person.3", description: Text("Kontrollera gruppbehörigheten i BSK."))
            }
        }
    }

    @ViewBuilder
    private func playerLink(_ player: PlayerSummary) -> some View {
        if horizontalSizeClass == .compact {
            NavigationLink { PlayerDetailView(playerID: player.id) } label: { compactPlayerRow(player) }
                .buttonStyle(.plain)
        } else {
            Button { selection = player.id } label: { playerCard(player) }
                .buttonStyle(.plain)
        }
    }

    private func compactPlayerRow(_ player: PlayerSummary) -> some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 13, style: .continuous).fill(BSKTheme.accent.opacity(0.14))
                Text(player.jerseyNumber.map(String.init) ?? String(player.name.prefix(1)))
                    .font(.headline.bold()).foregroundStyle(BSKTheme.accent)
            }
            .frame(width: 46, height: 46)
            VStack(alignment: .leading, spacing: 3) {
                Text(player.name).font(.subheadline.bold()).foregroundStyle(.white).lineLimit(1)
                Text(player.primaryPosition.isEmpty ? (player.position.isEmpty ? "Spelare" : player.position) : player.primaryPosition)
                    .font(.caption).foregroundStyle(BSKTheme.secondary)
                Text(player.activeGoals.first?.title ?? "Inget aktivt fokus")
                    .font(.caption2).foregroundStyle(player.activeGoals.isEmpty ? BSKTheme.muted : BSKTheme.accent).lineLimit(1)
            }
            Spacer(minLength: 6)
            Circle().fill(player.activeGoals.isEmpty ? BSKTheme.muted : BSKTheme.accent).frame(width: 7, height: 7)
            Image(systemName: "chevron.right").font(.caption.bold()).foregroundStyle(BSKTheme.muted)
        }
        .padding(.horizontal, 13).padding(.vertical, 10)
        .background(BSKTheme.surface, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(BSKTheme.border))
    }

    private func playerCard(_ player: PlayerSummary) -> some View {
        VStack(alignment: .leading, spacing: 13) {
            HStack(alignment: .top) {
                ZStack {
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .fill(BSKTheme.accent.opacity(0.14))
                    Text(player.jerseyNumber.map(String.init) ?? String(player.name.prefix(1)))
                        .font(.title2.bold()).foregroundStyle(BSKTheme.accent)
                }
                .frame(width: 58, height: 58)
                Spacer()
                Circle()
                    .fill(player.activeGoals.isEmpty ? BSKTheme.muted : BSKTheme.accent)
                    .frame(width: 8, height: 8)
            }
            Text(player.name).font(.headline).foregroundStyle(.white).lineLimit(1)
            Text(player.primaryPosition.isEmpty ? (player.position.isEmpty ? "Spelare" : player.position) : player.primaryPosition)
                .font(.caption.bold()).foregroundStyle(BSKTheme.secondary)
            Divider().overlay(BSKTheme.border)
            Label(
                player.activeGoals.first?.title ?? "Inget aktivt fokus",
                systemImage: player.activeGoals.isEmpty ? "minus.circle" : "scope"
            )
            .font(.caption)
            .foregroundStyle(player.activeGoals.isEmpty ? BSKTheme.muted : BSKTheme.accent)
            .lineLimit(2)
            .frame(minHeight: 32, alignment: .topLeading)
        }
        .padding(15)
        .background(BSKTheme.surface, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).stroke(selection == player.id ? BSKTheme.accent : BSKTheme.border, lineWidth: selection == player.id ? 2 : 1))
    }
}

struct PlayerDetailView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    let playerID: Int
    @State private var detail: PlayerDetail?
    @State private var development: PlayerDevelopment?
    @State private var developmentError: String?
    @State private var loadError: String?
    @State private var showsNewGoal = false
    @State private var showsPreferences = false

    var body: some View {
        ScrollView {
            if let detail {
                VStack(alignment: .leading, spacing: horizontalSizeClass == .compact ? 15 : 24) {
                    HStack(alignment: .top, spacing: 16) {
                        Text(detail.name.prefix(1))
                            .font(horizontalSizeClass == .compact ? .title.bold() : .largeTitle.bold())
                            .frame(width: horizontalSizeClass == .compact ? 54 : 72, height: horizontalSizeClass == .compact ? 54 : 72)
                            .foregroundStyle(BSKTheme.accent)
                            .background(BSKTheme.accent.opacity(0.14), in: Circle())
                        VStack(alignment: .leading, spacing: 5) {
                            Text(detail.name).font(horizontalSizeClass == .compact ? .title.bold() : .largeTitle.bold())
                            Text(detail.primaryPosition.isEmpty ? (detail.position.isEmpty ? "Position saknas" : detail.position) : detail.primaryPosition)
                                .foregroundStyle(.secondary)
                            if !detail.preferences.primaryLevel.isEmpty {
                                Text("Normal nivå: \(assessmentLevelLabel(detail.preferences.primaryLevel))" + (detail.preferences.secondaryLevel.isEmpty ? "" : " · Utmaning: \(assessmentLevelLabel(detail.preferences.secondaryLevel))"))
                                    .font(.caption.bold())
                                    .foregroundStyle(BSKTheme.accent)
                                if let assessedAt = detail.preferences.assessedAt {
                                    Text("Bedömd \(String(assessedAt.prefix(10)))" + (detail.preferences.assessedBy.isEmpty ? "" : " av \(detail.preferences.assessedBy)"))
                                        .font(.caption2)
                                        .foregroundStyle(BSKTheme.muted)
                                }
                            }
                            HStack(spacing: 6) {
                                ForEach(detail.teams) { team in
                                    Text(team.name)
                                        .font(.caption2.bold())
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 4)
                                        .background(BSKTheme.elevated, in: Capsule())
                                }
                            }
                        }
                    }

                    HStack(spacing: 10) {
                        ProfileMetric(value: detail.stats.trainingCount, label: "träningar")
                        ProfileMetric(value: detail.stats.matchCount, label: "matcher")
                        ProfileMetric(value: detail.stats.callupCount, label: "kallelser")
                    }

                    if canViewDevelopment {
                        SectionTitle("Utvecklingsträd")
                        NavigationLink {
                            PlayerDevelopmentView(playerID: playerID)
                        } label: {
                            VStack(alignment: .leading, spacing: 10) {
                                HStack(alignment: .firstTextBaseline) {
                                    Text("Långsiktig utvecklingsbild").font(.headline)
                                    Spacer()
                                    if let development {
                                        Text(development.hasStatus ? "\(development.activeCount) i arbete" : "Inte påbörjat")
                                            .font(.caption.bold())
                                            .foregroundStyle(BSKTheme.accent)
                                    }
                                }
                                if let development {
                                    Text(development.latest.map { "Senast uppdaterat \($0.date)" } ?? "Ingen sparad historik")
                                        .font(.caption)
                                        .foregroundStyle(BSKTheme.secondary)
                                    if development.hasStatus {
                                        ProgressView(value: Double(development.doneCount), total: Double(max(development.totalCount, 1)))
                                            .tint(BSKTheme.accent)
                                        Text("\(development.doneCount) av \(development.totalCount) steg behärskade")
                                            .font(.caption2)
                                            .foregroundStyle(BSKTheme.muted)
                                    }
                                } else if let developmentError {
                                    Text(developmentError).font(.caption).foregroundStyle(BSKTheme.danger)
                                } else {
                                    ProgressView().tint(BSKTheme.accent)
                                }
                            }
                            .padding(horizontalSizeClass == .compact ? 13 : 17)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .bskCardSurface()
                        }
                        .buttonStyle(.plain)
                    }

                    SectionTitle("Aktuellt fokus")
                    if detail.activeGoals.isEmpty {
                        Text("Inget aktivt fokus.").foregroundStyle(.secondary)
                    } else {
                        ForEach(detail.activeGoals) { goal in
                            VStack(alignment: .leading, spacing: 6) {
                                Text(goal.title).font(.headline)
                                if !goal.evidenceHint.isEmpty { Text(goal.evidenceHint).foregroundStyle(.secondary) }
                                if canManageGoals {
                                    HStack {
                                        Button("Uppnått") { Task { await close(goal.id, status: "achieved") } }
                                            .buttonStyle(.borderedProminent)
                                        Button("Pausa") { Task { await close(goal.id, status: "paused") } }
                                            .buttonStyle(.bordered)
                                    }
                                    .padding(.top, 6)
                                }
                            }
                            .padding(horizontalSizeClass == .compact ? 12 : 16)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .bskCardSurface()
                        }
                    }

                    if detail.goals.contains(where: { $0.status != "active" }) {
                        SectionTitle("Tidigare mål")
                        ForEach(detail.goals.filter { $0.status != "active" }) { goal in
                            HStack {
                                Text(goal.title)
                                Spacer()
                                Text(goal.status == "achieved" ? "Uppnått" : "Pausat")
                                    .font(.caption.bold())
                                    .foregroundStyle(goal.status == "achieved" ? BSKTheme.accent : BSKTheme.warning)
                            }
                            .padding(horizontalSizeClass == .compact ? 11 : 14)
                            .bskCardSurface()
                        }
                    }

                    if !detail.matchHistory.isEmpty {
                        SectionTitle("Sanktanmatcher")
                        ForEach(detail.matchHistory) { match in
                            HStack {
                                VStack(alignment: .leading, spacing: 3) {
                                    Text("\(match.homeAway == "home" ? "Hemma mot" : "Borta mot") \(match.opponent)")
                                        .fontWeight(.semibold)
                                    Text([match.date, match.startTime].compactMap { $0 }.joined(separator: " · "))
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                Text(match.sourceTeam).font(.caption.bold()).foregroundStyle(BSKTheme.accent)
                            }
                            .padding(horizontalSizeClass == .compact ? 11 : 14)
                            .bskCardSurface()
                        }
                    }

                    SectionTitle("Observationer")
                    ForEach(detail.observations) { observation in
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Text(observation.activityTitle).fontWeight(.semibold)
                                Spacer()
                                Text(observation.activityDate).font(.caption).foregroundStyle(.secondary)
                            }
                            Text(observation.note.isEmpty ? evidenceLabel(observation.evidence) : observation.note)
                            Text(observation.goalTitle ?? "Utveckling")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        .padding(horizontalSizeClass == .compact ? 12 : 16)
                        .bskCardSurface()
                    }
                }
                .padding(horizontalSizeClass == .compact ? 14 : 24)
                .frame(maxWidth: 780, alignment: .leading)
            } else if let loadError {
                ContentUnavailableView("Kunde inte läsa spelaren", systemImage: "exclamationmark.triangle", description: Text(loadError))
            } else {
                ProgressView("Läser spelare…").padding()
            }
        }
        .background(BSKTheme.background)
        .navigationTitle(detail?.name ?? "Spelare")
        .toolbar {
            if detail != nil && (canManageGoals || canManagePreferences) {
                ToolbarItem(placement: .primaryAction) {
                    Menu {
                        if canManageGoals && (detail?.activeGoals.count ?? 2) < 2 {
                            Button("Nytt utvecklingsmål", systemImage: "target") { showsNewGoal = true }
                        }
                        if canManagePreferences {
                            Button("Position och nivå", systemImage: "slider.horizontal.3") { showsPreferences = true }
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                }
            }
        }
        .sheet(isPresented: $showsNewGoal) {
            NewGoalSheet { title, evidenceHint, reviewOn in
                let updated = try await model.createGoal(playerID: playerID, title: title, evidenceHint: evidenceHint, reviewOn: reviewOn)
                detail = updated
            }
        }
        .sheet(isPresented: $showsPreferences) {
            if let detail {
                PlayerPreferencesSheet(preferences: detail.preferences) { preferences in
                    self.detail = try await model.savePlayerPreferences(playerID: playerID, preferences: preferences)
                }
            }
        }
        .task(id: playerID) {
            detail = nil
            development = nil
            developmentError = nil
            loadError = nil
            do { detail = try await model.playerDetail(id: playerID) }
            catch { loadError = error.localizedDescription }
            if canViewDevelopment {
                do { development = try await model.playerDevelopment(id: playerID) }
                catch { developmentError = error.localizedDescription }
            }
        }
    }

    private var canManageGoals: Bool {
        model.user?.permissions.contains("manage_evaluations") == true
    }

    private var canViewDevelopment: Bool {
        model.user?.permissions.contains("view_private_player_data") == true
    }

    private var canManagePreferences: Bool {
        model.user?.permissions.contains("manage_squads") == true
    }

    @MainActor
    private func close(_ goalID: String, status: String) async {
        do { detail = try await model.closeGoal(playerID: playerID, goalID: goalID, status: status) }
        catch { model.errorMessage = error.localizedDescription }
    }

    private func evidenceLabel(_ value: String) -> String {
        switch value {
        case "shown": return "Visade färdigheten"
        case "practicing": return "Tränar på färdigheten"
        default: return "Behöver följas upp"
        }
    }

    private func assessmentLevelLabel(_ value: String) -> String {
        value == "2" ? "Svår" : value == "3" ? "Medel" : value == "4" ? "Lätt" : "Ej satt"
    }
}

private struct PlayerDevelopmentView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    let playerID: Int
    @State private var development: PlayerDevelopment?
    @State private var loadError: String?
    @State private var showsEditor = false

    var body: some View {
        ScrollView {
            if let development {
                VStack(alignment: .leading, spacing: horizontalSizeClass == .compact ? 16 : 24) {
                    VStack(alignment: .leading, spacing: 7) {
                        Text("UTVECKLINGSTRÄD · 7V7 TILL 9V9")
                            .font(.system(size: 11, weight: .black))
                            .tracking(1.8)
                            .foregroundStyle(BSKTheme.accent)
                        Text(development.playerName)
                            .font(horizontalSizeClass == .compact ? .title.bold() : .largeTitle.bold())
                        Text(development.latest.map { "Senast uppdaterat \($0.date) av \($0.coachName)" } ?? "Utvecklingsträdet är inte påbörjat")
                            .font(.subheadline)
                            .foregroundStyle(BSKTheme.secondary)
                    }

                    developmentSummary(development)

                    if let latest = development.latest {
                        SectionTitle("Nuläge och nästa steg")
                        developmentLatest(latest, focusSkills: development.focusSkills)
                    }

                    SectionTitle("Färdigheter och aktuellt nuläge")
                    ForEach(development.categories) { category in
                        DisclosureGroup {
                            VStack(spacing: 8) {
                                ForEach(category.skills) { skill in
                                    DevelopmentSkillRow(skill: skill)
                                }
                            }
                            .padding(.top, 10)
                        } label: {
                            developmentCategoryHeader(category)
                        }
                        .tint(BSKTheme.accent)
                        .padding(horizontalSizeClass == .compact ? 13 : 16)
                        .bskCardSurface()
                    }

                    if !development.internalNote.isEmpty {
                        SectionTitle("Tränaranteckning")
                        Text(development.internalNote)
                            .font(.subheadline)
                            .foregroundStyle(BSKTheme.secondary)
                            .padding(horizontalSizeClass == .compact ? 13 : 16)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .bskCardSurface()
                    }
                }
                .padding(horizontalSizeClass == .compact ? 14 : 24)
                .frame(maxWidth: 820, alignment: .leading)
            } else if let loadError {
                ContentUnavailableView {
                    Text("Kunde inte läsa utvecklingsträdet")
                } description: {
                    Text(loadError)
                }
            } else {
                ProgressView("Läser utvecklingsträdet…").padding()
            }
        }
        .background(BSKTheme.background)
        .navigationTitle("Utvecklingsträd")
        .toolbar {
            if development != nil && canManageDevelopment {
                ToolbarItem(placement: .primaryAction) {
                    Button("Uppdatera") { showsEditor = true }
                }
            }
        }
        .sheet(isPresented: $showsEditor) {
            if let development {
                PlayerDevelopmentUpdateSheet(development: development) { updated in
                    self.development = updated
                }
            }
        }
        .task(id: playerID) { await load() }
        .refreshable { await load() }
    }

    private var canManageDevelopment: Bool {
        model.user?.permissions.contains("manage_evaluations") == true
    }

    @MainActor
    private func load() async {
        loadError = nil
        do { development = try await model.playerDevelopment(id: playerID) }
        catch { loadError = error.localizedDescription }
    }

    private func developmentSummary(_ value: PlayerDevelopment) -> some View {
        HStack(spacing: 10) {
            DevelopmentMetric(value: value.doneCount, label: "behärskade")
            DevelopmentMetric(value: value.activeCount, label: "i arbete")
            DevelopmentMetric(value: value.totalCount, label: "steg totalt")
        }
    }

    private func developmentLatest(_ latest: PlayerDevelopment.Latest, focusSkills: [PlayerDevelopment.Skill]) -> some View {
        VStack(spacing: 10) {
            DevelopmentTextCard(title: "Styrkor just nu", text: latest.strengths, emptyText: "Inga styrkor noterade ännu.")
            DevelopmentTextCard(
                title: "Nästa fokus",
                text: ([focusSkills.map(\.title).joined(separator: " · "), latest.focusNote].filter { !$0.isEmpty }).joined(separator: "\n"),
                emptyText: "Inget fokus valt ännu."
            )
            DevelopmentTextCard(title: "Mående och spelarens röst", text: latest.wellbeingNote, emptyText: "Ingen aktuell anteckning.")
        }
    }

    private func developmentCategoryHeader(_ category: PlayerDevelopment.Category) -> some View {
        let doneCount = category.skills.reduce(0) { count, skill in
            count + (skill.status == "done" ? 1 : 0)
        }
        return HStack {
            Text(category.name).font(.subheadline.bold())
            Spacer()
            Text("\(doneCount)/\(category.skills.count)")
                .font(.caption.monospacedDigit())
                .foregroundStyle(BSKTheme.muted)
        }
    }
}

private struct DevelopmentMetric: View {
    let value: Int
    let label: String
    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(String(value)).font(.headline.bold()).foregroundStyle(BSKTheme.accent)
            Text(label).font(.caption2).foregroundStyle(BSKTheme.secondary)
        }
        .padding(11)
        .frame(maxWidth: .infinity, alignment: .leading)
        .bskCardSurface()
    }
}

private struct DevelopmentTextCard: View {
    let title: String
    let text: String
    let emptyText: String
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).font(.subheadline.bold())
            Text(text.isEmpty ? emptyText : text)
                .font(.subheadline)
                .foregroundStyle(BSKTheme.secondary)
        }
        .padding(13)
        .frame(maxWidth: .infinity, alignment: .leading)
        .bskCardSurface()
    }
}

private struct DevelopmentSkillRow: View {
    let skill: PlayerDevelopment.Skill
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline) {
                Text("Nivå \(skill.level)").font(.caption2.bold()).foregroundStyle(BSKTheme.muted)
                Spacer()
                Text(developmentStatusLabel(skill.status))
                    .font(.caption2.bold())
                    .foregroundStyle(developmentStatusColor(skill.status))
            }
            Text(skill.question).font(.subheadline.bold())
            Text("Klart när: \(skill.criterion)").font(.caption).foregroundStyle(BSKTheme.secondary)
            if skill.status != "done" {
                Text("Träningsråd: \(skill.advice)").font(.caption).foregroundStyle(BSKTheme.muted)
            } else {
                Text(skill.nextStep).font(.caption).foregroundStyle(BSKTheme.accent)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(BSKTheme.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(skill.isFocus ? BSKTheme.accent.opacity(0.55) : BSKTheme.border))
        .opacity(skill.isUnlocked ? 1 : 0.55)
    }
}

private struct PlayerDevelopmentUpdateSheet: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss
    let development: PlayerDevelopment
    let didSave: (PlayerDevelopment) -> Void
    @State private var date: Date
    @State private var strengths: String
    @State private var focusNote: String
    @State private var wellbeingNote: String
    @State private var statuses: [String: String]
    @State private var focusSkillIds: Set<String>
    @State private var isSaving = false
    @State private var errorMessage: String?

    init(development: PlayerDevelopment, didSave: @escaping (PlayerDevelopment) -> Void) {
        self.development = development
        self.didSave = didSave
        _date = State(initialValue: Self.dateFormatter.date(from: development.latest?.date ?? "") ?? Date())
        _strengths = State(initialValue: development.latest?.strengths ?? "")
        _focusNote = State(initialValue: development.latest?.focusNote ?? "")
        _wellbeingNote = State(initialValue: development.latest?.wellbeingNote ?? "")
        _statuses = State(initialValue: Dictionary(uniqueKeysWithValues: development.categories.flatMap(\.skills).map { ($0.id, $0.status) }))
        _focusSkillIds = State(initialValue: Set(development.focusSkills.map(\.id)))
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Grunduppgifter") {
                    DatePicker("Datum", selection: $date, displayedComponents: .date)
                    Text("Tränare: \(model.user?.name ?? "Tränare")").foregroundStyle(BSKTheme.secondary)
                }
                Section("Sammanfattning") {
                    TextField("Styrkor just nu", text: $strengths, axis: .vertical).lineLimit(2...6)
                    TextField("Nästa fokus", text: $focusNote, axis: .vertical).lineLimit(2...6)
                    TextField("Mående och spelarens upplevelse", text: $wellbeingNote, axis: .vertical).lineLimit(2...6)
                    Text("\(focusSkillIds.count)/2 fokusfärdigheter valda")
                        .font(.caption)
                        .foregroundStyle(focusSkillIds.isEmpty ? BSKTheme.warning : BSKTheme.secondary)
                }
                Section("Utvecklingsträd") {
                    ForEach(development.categories) { category in
                        DisclosureGroup(category.name) {
                            ForEach(category.skills) { skill in
                                DevelopmentEditSkillRow(skill: skill, statuses: $statuses, focusSkillIds: $focusSkillIds)
                            }
                        }
                    }
                }
                if let errorMessage { Text(errorMessage).foregroundStyle(BSKTheme.danger) }
            }
            .bskListSurface()
            .navigationTitle("Uppdatera utvecklingsbild")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Avbryt") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Spara") { Task { await save() } }.disabled(isSaving)
                }
            }
            .interactiveDismissDisabled(isSaving)
        }
    }

    @MainActor
    private func save() async {
        isSaving = true
        errorMessage = nil
        do {
            let update = PlayerDevelopmentUpdate(
                date: Self.dateFormatter.string(from: date),
                strengths: strengths,
                focusNote: focusNote,
                wellbeingNote: wellbeingNote,
                focusSkillIds: Array(focusSkillIds).sorted(),
                statuses: statuses
            )
            let updated = try await model.updatePlayerDevelopment(playerID: development.playerId, update: update)
            didSave(updated)
            dismiss()
        } catch { errorMessage = error.localizedDescription }
        isSaving = false
    }

    private static let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "sv_SE")
        formatter.timeZone = TimeZone(identifier: "Europe/Stockholm")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()
}

private struct DevelopmentEditSkillRow: View {
    let skill: PlayerDevelopment.Skill
    @Binding var statuses: [String: String]
    @Binding var focusSkillIds: Set<String>

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(skill.question).font(.subheadline.bold())
            HStack {
                Text("Nivå \(skill.level)").font(.caption).foregroundStyle(BSKTheme.secondary)
                Spacer()
                Picker("Status", selection: statusBinding) {
                    ForEach(["not_started", "training", "almost", "done"], id: \.self) { status in
                        Text(developmentStatusLabel(status)).tag(status)
                    }
                }
                .pickerStyle(.menu)
            }
            Toggle("Fokus", isOn: focusBinding)
                .disabled(!focusSkillIds.contains(skill.id) && focusSkillIds.count >= 2)
        }
        .padding(.vertical, 5)
    }

    private var statusBinding: Binding<String> {
        Binding(get: { statuses[skill.id] ?? skill.status }, set: { statuses[skill.id] = $0 })
    }

    private var focusBinding: Binding<Bool> {
        Binding(
            get: { focusSkillIds.contains(skill.id) },
            set: { selected in
                if selected { focusSkillIds.insert(skill.id) }
                else { focusSkillIds.remove(skill.id) }
            }
        )
    }
}

private func developmentStatusLabel(_ status: String) -> String {
    status == "training" ? "Tränar på" : status == "almost" ? "Nästan klar" : status == "done" ? "Klar" : "Ej påbörjad"
}

private func developmentStatusColor(_ status: String) -> Color {
    status == "training" ? BSKTheme.warning : status == "almost" ? .blue : status == "done" ? BSKTheme.accent : BSKTheme.muted
}

private struct ProfileMetric: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    let value: Int
    let label: String
    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(String(value)).font(horizontalSizeClass == .compact ? .headline.bold() : .title2.bold()).foregroundStyle(BSKTheme.accent)
            Text(label).font(.caption).foregroundStyle(BSKTheme.secondary)
        }
        .padding(horizontalSizeClass == .compact ? 10 : 14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .bskCardSurface()
    }
}

private struct NewGoalSheet: View {
    @Environment(\.dismiss) private var dismiss
    let save: (String, String, String?) async throws -> Void
    @State private var title = ""
    @State private var evidenceHint = ""
    @State private var reviewOn = ""
    @State private var isSaving = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Utvecklingsmål") {
                    TextField("Observerbart nästa steg", text: $title, axis: .vertical)
                    TextField("Vad kan tränaren se?", text: $evidenceHint, axis: .vertical)
                    TextField("Följ upp YYYY-MM-DD", text: $reviewOn)
                        .textContentType(.dateTime)
                }
                if let errorMessage { Text(errorMessage).foregroundStyle(BSKTheme.danger) }
            }
            .bskListSurface()
            .navigationTitle("Nytt mål")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Avbryt") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Spara") {
                        Task {
                            isSaving = true
                            do {
                                try await save(title, evidenceHint, reviewOn.isEmpty ? nil : reviewOn)
                                dismiss()
                            } catch { errorMessage = error.localizedDescription }
                            isSaving = false
                        }
                    }
                    .disabled(isSaving || title.trimmingCharacters(in: .whitespacesAndNewlines).count < 3)
                }
            }
        }
    }
}

private struct PlayerPreferencesSheet: View {
    @Environment(\.dismiss) private var dismiss
    let save: (PlayerDetail.Preferences) async throws -> Void
    @State private var primaryPosition: String
    @State private var secondaryPosition: String
    @State private var primaryLevel: String
    @State private var secondaryLevel: String
    @State private var selectionEligible: Bool
    @State private var isSaving = false
    @State private var errorMessage: String?

    init(preferences: PlayerDetail.Preferences, save: @escaping (PlayerDetail.Preferences) async throws -> Void) {
        self.save = save
        _primaryPosition = State(initialValue: preferences.primaryPosition)
        _secondaryPosition = State(initialValue: preferences.secondaryPosition)
        _primaryLevel = State(initialValue: preferences.primaryLevel)
        _secondaryLevel = State(initialValue: preferences.secondaryLevel)
        _selectionEligible = State(initialValue: preferences.selectionEligible)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Position") {
                    positionPicker("Primär position", selection: $primaryPosition)
                }
                Section("Tränarbedömd Sanktan-nivå") {
                    levelPicker("Normal nivå", selection: $primaryLevel)
                    levelPicker("Utmaningsnivå", selection: $secondaryLevel)
                }
                Section { Toggle("Kan föreslås till uttagning", isOn: $selectionEligible) }
                if let errorMessage { Text(errorMessage).foregroundStyle(BSKTheme.danger) }
            }
            .bskListSurface()
            .navigationTitle("Position och nivå")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Avbryt") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Spara") {
                        Task {
                            isSaving = true
                            do {
                                try await save(.init(
                                    primaryPosition: primaryPosition,
                                    secondaryPosition: secondaryPosition,
                                    primaryLevel: primaryLevel,
                                    secondaryLevel: secondaryLevel,
                                    assessedAt: nil,
                                    assessedBy: "",
                                    selectionEligible: selectionEligible
                                ))
                                dismiss()
                            } catch { errorMessage = error.localizedDescription }
                            isSaving = false
                        }
                    }
                    .disabled(isSaving)
                }
            }
        }
    }

    private func positionPicker(_ title: String, selection: Binding<String>) -> some View {
        Picker(title, selection: selection) {
            ForEach(["", "Målvakt", "Back", "Mittfält", "Vänsterkant", "Högerkant", "Anfall"], id: \.self) {
                Text($0.isEmpty ? "Ej satt" : $0).tag($0)
            }
        }
    }

    private func levelPicker(_ title: String, selection: Binding<String>) -> some View {
        Picker(title, selection: selection) {
            Text("Ej satt").tag("")
            ForEach(["2", "3", "4"], id: \.self) { Text("Sanktan \($0)").tag($0) }
        }
    }
}

private struct SectionTitle: View {
    let title: String
    init(_ title: String) { self.title = title }
    var body: some View { Text(title).font(.headline.bold()) }
}
