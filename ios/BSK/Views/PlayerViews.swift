import SwiftUI

struct PlayerList: View {
    @EnvironmentObject private var model: AppModel
    @Binding var selection: Int?

    var body: some View {
        List(model.players, selection: $selection) { player in
            NavigationLink(value: player.id) {
                HStack(spacing: 12) {
                    ZStack {
                        Circle().fill(BSKTheme.accent.opacity(0.13))
                        Text(player.name.prefix(1)).font(.headline).foregroundStyle(BSKTheme.accent)
                    }
                    .frame(width: 42, height: 42)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(player.name).fontWeight(.semibold)
                        Text(player.activeGoals.first?.title ?? "Inget aktivt fokus")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }
                .padding(.vertical, 3)
            }
        }
        .navigationTitle("Spelare")
        .bskListSurface()
        .refreshable { await model.reload() }
        .overlay {
            if model.players.isEmpty {
                ContentUnavailableView("Ingen trupp", systemImage: "person.3", description: Text("Kontrollera gruppbehörigheten i BSK."))
            }
        }
    }
}

struct PlayerDetailView: View {
    @EnvironmentObject private var model: AppModel
    let playerID: Int
    @State private var detail: PlayerDetail?
    @State private var loadError: String?
    @State private var showsNewGoal = false
    @State private var showsPreferences = false

    var body: some View {
        ScrollView {
            if let detail {
                VStack(alignment: .leading, spacing: 24) {
                    HStack(alignment: .top, spacing: 16) {
                        Text(detail.name.prefix(1))
                            .font(.largeTitle.bold())
                            .frame(width: 72, height: 72)
                            .foregroundStyle(BSKTheme.accent)
                            .background(BSKTheme.accent.opacity(0.14), in: Circle())
                        VStack(alignment: .leading, spacing: 5) {
                            Text(detail.name).font(.largeTitle.bold())
                            Text([detail.primaryPosition, detail.position].filter { !$0.isEmpty }.joined(separator: " · "))
                                .foregroundStyle(.secondary)
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
                            .padding()
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
                            .padding(14)
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
                            .padding(14)
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
                        .padding(16)
                        .bskCardSurface()
                    }
                }
                .padding(24)
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
            loadError = nil
            do { detail = try await model.playerDetail(id: playerID) }
            catch { loadError = error.localizedDescription }
        }
    }

    private var canManageGoals: Bool {
        model.user?.permissions.contains("manage_evaluations") == true
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
}

private struct ProfileMetric: View {
    let value: Int
    let label: String
    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(String(value)).font(.title2.bold()).foregroundStyle(BSKTheme.accent)
            Text(label).font(.caption).foregroundStyle(BSKTheme.secondary)
        }
        .padding(14)
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
                    positionPicker("Förstaval", selection: $primaryPosition)
                    positionPicker("Andraval", selection: $secondaryPosition)
                }
                Section("Sanktan-nivå") {
                    levelPicker("Förstaval", selection: $primaryLevel)
                    levelPicker("Andraval", selection: $secondaryLevel)
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
            ForEach(["2", "3", "4", "5"], id: \.self) { Text("Sanktan \($0)").tag($0) }
        }
    }
}

private struct SectionTitle: View {
    let title: String
    init(_ title: String) { self.title = title }
    var body: some View { Text(title).font(.title2.bold()) }
}
