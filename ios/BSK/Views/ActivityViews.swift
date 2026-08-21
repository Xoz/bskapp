import SwiftUI

private struct AdaptiveListLink<Value: Hashable, Destination: View, Label: View>: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @Binding private var selection: Value?
    private let value: Value
    private let destination: () -> Destination
    private let label: () -> Label

    init(
        value: Value,
        selection: Binding<Value?>,
        @ViewBuilder destination: @escaping () -> Destination,
        @ViewBuilder label: @escaping () -> Label
    ) {
        self.value = value
        _selection = selection
        self.destination = destination
        self.label = label
    }

    var body: some View {
        if horizontalSizeClass == .compact {
            NavigationLink(destination: destination, label: label)
        } else {
            Button {
                selection = value
            } label: {
                label()
            }
            .buttonStyle(.plain)
        }
    }
}

struct ActivityList: View {
    @EnvironmentObject private var model: AppModel
    @Binding var selection: String?

    var body: some View {
        List(model.activities, selection: $selection) { activity in
            AdaptiveListLink(value: activity.id, selection: $selection) {
                ActivityDetail(activity: activity)
            } label: {
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 10) {
                        Image(systemName: activity.type == "match" ? "sportscourt.fill" : "figure.run")
                            .foregroundStyle(BSKTheme.accent)
                        Text(activity.title).fontWeight(.semibold)
                    }
                    HStack {
                        Text(activity.date)
                        if let time = activity.startTime { Text(time) }
                        if activity.observationCount > 0 {
                            Text("\(activity.observationCount) observationer")
                        }
                    }
                    .font(.caption)
                    .foregroundStyle(.secondary)
                }
                .padding(.vertical, 4)
            }
        }
        .navigationTitle("Observera")
        .bskListSurface()
        .refreshable { await model.reload() }
    }
}

struct ActivityDetail: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    let activity: ActivitySummary

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: horizontalSizeClass == .compact ? 12 : 18) {
                matchHero

                if activity.type == "match", let matchID = activity.matchId {
                    NavigationLink {
                        MatchCenterView(matchID: matchID, title: activity.title)
                    } label: {
                        HStack(spacing: 12) {
                            Image(systemName: "scoreboard.fill")
                                .font(.title3.bold())
                                .foregroundStyle(BSKTheme.backgroundDeep)
                                .frame(width: 44, height: 44)
                                .background(BSKTheme.accent, in: RoundedRectangle(cornerRadius: 13, style: .continuous))
                            VStack(alignment: .leading, spacing: 2) {
                                Text("MATCHCENTER").font(.system(size: 9, weight: .black)).tracking(1.4).foregroundStyle(BSKTheme.accent)
                                Text("Klocka, period och mål").font(.headline).foregroundStyle(.white)
                            }
                            Spacer()
                            Image(systemName: "chevron.right").font(.caption.bold()).foregroundStyle(BSKTheme.muted)
                        }
                        .padding(12)
                        .background(BSKTheme.surface, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(BSKTheme.accent.opacity(0.38)))
                    }
                    .buttonStyle(.plain)
                }

                if let matchID = activity.matchId {
                    MatchLineupBoard(matchID: matchID)
                }

                MatchObservationBoard(activity: activity)
            }
            .padding(horizontalSizeClass == .compact ? 12 : 18)
            .frame(maxWidth: 820)
            .frame(maxWidth: .infinity)
        }
        .background(BSKTheme.canvas)
        .navigationTitle("Match")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var matchHero: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack {
                Text("MATCHDAG")
                    .font(.caption2.bold())
                    .tracking(1.6)
                    .foregroundStyle(BSKTheme.accent)
                Spacer()
                Image(systemName: "sportscourt.fill")
                    .font(.title2.bold())
                    .foregroundStyle(BSKTheme.backgroundDeep)
                    .frame(width: 52, height: 52)
                    .background(BSKTheme.accent, in: RoundedRectangle(cornerRadius: 17, style: .continuous))
            }

            VStack(alignment: .leading, spacing: 6) {
                Text(activity.title)
                    .font(.system(size: 34, weight: .bold, design: .rounded))
                    .foregroundStyle(Color.white)
                Text("Laguppställning och matchcenter")
                    .font(.subheadline)
                    .foregroundStyle(BSKTheme.secondary)
            }

            HStack(spacing: 9) {
                infoPill(activity.date, systemImage: "calendar")
                if let time = activity.startTime {
                    infoPill(time, systemImage: "clock")
                }
            }
        }
        .padding(horizontalSizeClass == .compact ? 15 : 22)
        .background(
            LinearGradient(
                colors: [BSKTheme.elevated, BSKTheme.surface],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            ),
            in: RoundedRectangle(cornerRadius: 26, style: .continuous)
        )
        .overlay(RoundedRectangle(cornerRadius: 26, style: .continuous).stroke(BSKTheme.accent.opacity(0.42), lineWidth: 1))
        .shadow(color: Color.black.opacity(0.24), radius: 18, y: 9)
    }

    private func infoPill(_ text: String, systemImage: String) -> some View {
        Label(text, systemImage: systemImage)
            .font(.caption.bold())
            .foregroundStyle(BSKTheme.secondary)
            .padding(.horizontal, 12)
            .padding(.vertical, 9)
            .background(BSKTheme.backgroundDeep.opacity(0.68), in: Capsule())
    }

}

private struct MatchLineupBoard: View {
    @EnvironmentObject private var model: AppModel
    let matchID: Int
    @State private var state: LiveMatchState?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text("LAGUPPSTÄLLNING")
                        .font(.system(size: 10, weight: .black))
                        .tracking(1.4)
                        .foregroundStyle(BSKTheme.accent)
                    Text(state?.hasLineup == true ? "Startelva" : "Matchtrupp")
                        .font(.title3.bold())
                        .foregroundStyle(.white)
                }
                Spacer()
                if let state {
                    Text("\(state.players.count) SPELARE")
                        .font(.system(size: 9, weight: .black))
                        .tracking(0.8)
                        .foregroundStyle(BSKTheme.secondary)
                }
            }

            if let state {
                lineupGrid(state.hasLineup ? state.players.filter { state.onField.contains($0.id) } : state.players)
                if state.hasLineup {
                    Text("AVBYTARE")
                        .font(.system(size: 9, weight: .black))
                        .tracking(1.2)
                        .foregroundStyle(BSKTheme.muted)
                        .padding(.top, 2)
                    lineupGrid(state.players.filter { !state.onField.contains($0.id) })
                }
            } else {
                HStack(spacing: 9) {
                    ProgressView().tint(BSKTheme.accent)
                    Text("Hämtar laguppställning…").font(.subheadline).foregroundStyle(BSKTheme.secondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, 10)
            }
        }
        .padding(15)
        .background(BSKTheme.surface, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(BSKTheme.border))
        .task(id: matchID) { await load() }
    }

    private func lineupGrid(_ players: [LiveMatchState.Player]) -> some View {
        LazyVGrid(columns: [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)], spacing: 8) {
            ForEach(players) { player in
                HStack(spacing: 9) {
                    Text(player.jerseyNumber.map(String.init) ?? String(player.name.prefix(1)))
                        .font(.caption.bold())
                        .foregroundStyle(BSKTheme.backgroundDeep)
                        .frame(width: 30, height: 30)
                        .background(BSKTheme.accent, in: RoundedRectangle(cornerRadius: 9, style: .continuous))
                    Text(player.name)
                        .font(.caption.bold())
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    Spacer(minLength: 0)
                }
                .padding(7)
                .background(BSKTheme.elevated, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
        }
    }

    @MainActor private func load() async {
        do { state = try await model.liveMatch(id: matchID) }
        catch { model.errorMessage = error.localizedDescription }
    }
}

private struct MatchObservationDraft {
    var goalID: String
    var evidence: String?
    var note = ""
}

private struct MatchObservationBoard: View {
    @EnvironmentObject private var model: AppModel

    let activity: ActivitySummary
    @State private var players: [PlayerSummary] = []
    @State private var drafts: [Int: MatchObservationDraft] = [:]
    @State private var isLoading = true
    @State private var isSaving = false
    @State private var confirmation: String?

    private var playersWithGoals: [PlayerSummary] {
        players.filter { !$0.activeGoals.isEmpty }
    }

    private var markedCount: Int {
        drafts.values.filter { $0.evidence != nil }.count
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(alignment: .top, spacing: 16) {
                VStack(alignment: .leading, spacing: 5) {
                    Text("MÅLANKNUTEN EVIDENS")
                        .font(.caption2.bold())
                        .tracking(1.5)
                        .foregroundStyle(BSKTheme.accent)
                    Text("Vad såg ni?")
                        .font(.title2.bold())
                        .foregroundStyle(Color.white)
                    Text("Markera bara det som faktiskt observerades.")
                        .font(.subheadline)
                        .foregroundStyle(BSKTheme.secondary)
                }
                Spacer()
                if markedCount > 0 {
                    Text("\(markedCount) MARKERADE")
                        .font(.caption2.bold())
                        .tracking(1)
                        .foregroundStyle(BSKTheme.backgroundDeep)
                        .padding(.horizontal, 11)
                        .padding(.vertical, 8)
                        .background(BSKTheme.accent, in: Capsule())
                }
            }

            if isLoading {
                HStack(spacing: 10) {
                    ProgressView().tint(BSKTheme.accent)
                    Text("Hämtar matchtruppen...").foregroundStyle(BSKTheme.secondary)
                }
                .padding(.vertical, 20)
            } else if playersWithGoals.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Label("Inga aktiva utvecklingsmål ännu", systemImage: "scope")
                        .font(.headline)
                        .foregroundStyle(BSKTheme.warning)
                    Text(players.isEmpty ? "Ingen uttagen eller accepterad spelare finns för matchen ännu." : "Sätt ett aktivt mål på spelarsidan innan observationer registreras.")
                        .font(.subheadline)
                        .foregroundStyle(BSKTheme.secondary)
                }
                .padding(18)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(BSKTheme.warning.opacity(0.08), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            } else {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 300), spacing: 12, alignment: .top)], spacing: 12) {
                    ForEach(playersWithGoals) { player in
                        observationCard(player)
                    }
                }
            }

            if let confirmation {
                Label(confirmation, systemImage: "checkmark.circle.fill")
                    .font(.subheadline.bold())
                    .foregroundStyle(BSKTheme.accent)
                    .padding(13)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(BSKTheme.accent.opacity(0.09), in: RoundedRectangle(cornerRadius: 15, style: .continuous))
            }

            if model.queuedObservationCount > 0 {
                Label("\(model.queuedObservationCount) väntar på synkning", systemImage: "arrow.triangle.2.circlepath")
                    .font(.caption.bold())
                    .foregroundStyle(BSKTheme.warning)
            }

            saveButton
        }
        .padding(20)
        .background(BSKTheme.surface, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).stroke(BSKTheme.border, lineWidth: 1))
        .task(id: activity.id) { await loadPlayers() }
    }

    private func observationCard(_ player: PlayerSummary) -> some View {
        let draft = drafts[player.id] ?? initialDraft(player)
        return VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 12) {
                Text(player.jerseyNumber.map(String.init) ?? String(player.name.prefix(1)).uppercased())
                    .font(.headline.bold())
                    .foregroundStyle(BSKTheme.backgroundDeep)
                    .frame(width: 42, height: 42)
                    .background(BSKTheme.accent, in: RoundedRectangle(cornerRadius: 13, style: .continuous))
                VStack(alignment: .leading, spacing: 2) {
                    Text(player.name).font(.headline).foregroundStyle(Color.white)
                    Text(draft.evidence == nil ? "Inte markerad" : "Observation markerad")
                        .font(.caption)
                        .foregroundStyle(draft.evidence == nil ? BSKTheme.muted : BSKTheme.accent)
                }
                Spacer()
                if draft.evidence != nil {
                    Image(systemName: "checkmark.circle.fill").foregroundStyle(BSKTheme.accent)
                }
            }

            if player.activeGoals.count > 1 {
                VStack(alignment: .leading, spacing: 7) {
                    Text("UTVECKLINGSMÅL").font(.system(size: 9, weight: .bold)).tracking(1).foregroundStyle(BSKTheme.muted)
                    ForEach(player.activeGoals) { goal in
                        Button {
                            update(player) { $0.goalID = goal.id }
                        } label: {
                            HStack(spacing: 8) {
                                Image(systemName: draft.goalID == goal.id ? "checkmark.circle.fill" : "circle")
                                Text(goal.title).multilineTextAlignment(.leading)
                                Spacer()
                            }
                            .font(.caption.bold())
                            .foregroundStyle(draft.goalID == goal.id ? Color.white : BSKTheme.secondary)
                            .padding(11)
                            .background(draft.goalID == goal.id ? BSKTheme.accent.opacity(0.09) : BSKTheme.backgroundDeep.opacity(0.5), in: RoundedRectangle(cornerRadius: 13, style: .continuous))
                        }
                        .buttonStyle(.plain)
                    }
                }
            } else if let goal = player.activeGoals.first {
                Label(goal.title, systemImage: "scope")
                    .font(.caption.bold())
                    .foregroundStyle(BSKTheme.secondary)
            }

            VStack(spacing: 7) {
                evidenceChoice(player, value: "shown", title: "Visade", help: "Beteendet syntes tydligt")
                evidenceChoice(player, value: "practicing", title: "Tränar på", help: "Försökte och är på väg")
                evidenceChoice(player, value: "revisit", title: "Nytt tillfälle", help: "Behöver observeras igen")
            }

            TextField("Kort konkret exempel, frivilligt", text: noteBinding(player))
                .font(.subheadline)
                .foregroundStyle(Color.white)
                .padding(.horizontal, 13)
                .frame(height: 46)
                .background(BSKTheme.backgroundDeep.opacity(0.65), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(BSKTheme.border, lineWidth: 1))
        }
        .padding(16)
        .background(BSKTheme.elevated, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(draft.evidence == nil ? BSKTheme.border : BSKTheme.accent.opacity(0.55), lineWidth: 1))
    }

    private func evidenceChoice(_ player: PlayerSummary, value: String, title: String, help: String) -> some View {
        let selected = drafts[player.id]?.evidence == value
        return Button {
            update(player) { $0.evidence = $0.evidence == value ? nil : value }
        } label: {
            HStack(spacing: 11) {
                Image(systemName: selected ? "largecircle.fill.circle" : "circle")
                    .font(.headline)
                    .foregroundStyle(selected ? BSKTheme.accent : BSKTheme.muted)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).font(.subheadline.bold()).foregroundStyle(selected ? Color.white : BSKTheme.secondary)
                    Text(help).font(.caption2).foregroundStyle(BSKTheme.muted)
                }
                Spacer()
            }
            .padding(11)
            .background(selected ? BSKTheme.accent.opacity(0.09) : BSKTheme.backgroundDeep.opacity(0.48), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    private var saveButton: some View {
        Button {
            Task { await save() }
        } label: {
            HStack {
                if isSaving { ProgressView().tint(BSKTheme.backgroundDeep) }
                else { Image(systemName: "checkmark.circle.fill") }
                Text(isSaving ? "Sparar..." : "Spara markerade observationer")
                    .font(.headline)
                Spacer()
                if markedCount > 0 { Text("\(markedCount)").font(.headline.monospacedDigit()) }
            }
            .foregroundStyle(markedCount > 0 && !isSaving ? BSKTheme.backgroundDeep : BSKTheme.muted)
            .padding(.horizontal, 18)
            .frame(height: 56)
            .background(markedCount > 0 && !isSaving ? BSKTheme.accent : BSKTheme.elevated, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(markedCount == 0 || isSaving)
    }

    private func initialDraft(_ player: PlayerSummary) -> MatchObservationDraft {
        MatchObservationDraft(goalID: player.activeGoals.first?.id ?? "", evidence: nil)
    }

    private func update(_ player: PlayerSummary, change: (inout MatchObservationDraft) -> Void) {
        var draft = drafts[player.id] ?? initialDraft(player)
        change(&draft)
        drafts[player.id] = draft
        confirmation = nil
    }

    private func noteBinding(_ player: PlayerSummary) -> Binding<String> {
        Binding(
            get: { drafts[player.id]?.note ?? "" },
            set: { value in update(player) { $0.note = String(value.prefix(280)) } }
        )
    }

    @MainActor
    private func loadPlayers() async {
        isLoading = true
        defer { isLoading = false }
        do {
            players = try await model.activityPlayers(id: activity.id)
            drafts = Dictionary(uniqueKeysWithValues: players.filter { !$0.activeGoals.isEmpty }.map { ($0.id, initialDraft($0)) })
        } catch {
            players = []
            drafts = [:]
            model.errorMessage = error.localizedDescription
        }
    }

    @MainActor
    private func save() async {
        let submissions = playersWithGoals.compactMap { player -> ObservationSubmission? in
            guard let draft = drafts[player.id], let evidence = draft.evidence, !draft.goalID.isEmpty else { return nil }
            return ObservationSubmission(playerId: player.id, goalId: draft.goalID, evidence: evidence, note: draft.note)
        }
        guard !submissions.isEmpty else { return }
        isSaving = true
        defer { isSaving = false }
        do {
            let status = try await model.saveObservations(activityID: activity.id, submissions: submissions)
            confirmation = status == .saved ? "\(submissions.count) observationer sparades." : "Sparat offline och synkas automatiskt."
            for player in playersWithGoals {
                drafts[player.id] = initialDraft(player)
            }
        } catch {
            model.errorMessage = error.localizedDescription
        }
    }
}

private struct ObservationComposer: View {
    @EnvironmentObject private var model: AppModel

    let activity: ActivitySummary
    @State private var selectedPlayerID: Int?
    @State private var selectedGoalID: String?
    @State private var evidence = "practicing"
    @State private var note = ""
    @State private var isSaving = false
    @State private var isLoadingPlayers = true
    @State private var matchPlayers: [PlayerSummary] = []
    @State private var confirmation: String?

    private var selectedPlayer: PlayerSummary? {
        matchPlayers.first { $0.id == selectedPlayerID }
    }

    private var canSave: Bool {
        selectedPlayerID != nil && selectedGoalID != nil && !isSaving
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 22) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 5) {
                    Text("SNABB OBSERVATION")
                        .font(.caption2.bold())
                        .tracking(1.5)
                        .foregroundStyle(BSKTheme.accent)
                    Text("Fånga det du ser")
                        .font(.title2.bold())
                        .foregroundStyle(Color.white)
                    Text("Välj spelare, mål och en tydlig bedömning.")
                        .font(.subheadline)
                        .foregroundStyle(BSKTheme.secondary)
                }
                Spacer()
                Image(systemName: "eye.fill")
                    .font(.title3.bold())
                    .foregroundStyle(BSKTheme.accent)
                    .frame(width: 44, height: 44)
                    .background(BSKTheme.accent.opacity(0.11), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            }

            VStack(alignment: .leading, spacing: 10) {
                sectionLabel("1. Välj spelare", systemImage: "person.fill")
                if isLoadingPlayers {
                    HStack(spacing: 10) {
                        ProgressView().tint(BSKTheme.accent)
                        Text("Hämtar matchtruppen...")
                            .font(.subheadline)
                            .foregroundStyle(BSKTheme.secondary)
                    }
                    .padding(.vertical, 12)
                } else if matchPlayers.isEmpty {
                    Label("Ingen uttagen eller accepterad spelare finns för matchen ännu.", systemImage: "person.3.sequence.fill")
                        .font(.subheadline.bold())
                        .foregroundStyle(BSKTheme.warning)
                        .padding(14)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(BSKTheme.warning.opacity(0.09), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                } else {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 9) {
                            ForEach(matchPlayers) { player in
                                playerButton(player)
                            }
                        }
                        .padding(.vertical, 2)
                    }
                }
            }

            VStack(alignment: .leading, spacing: 10) {
                sectionLabel("2. Koppla till mål", systemImage: "scope")
                if let player = selectedPlayer, player.activeGoals.isEmpty {
                    Label("Spelaren saknar ett aktivt utvecklingsmål", systemImage: "exclamationmark.triangle.fill")
                        .font(.subheadline.bold())
                        .foregroundStyle(BSKTheme.warning)
                        .padding(14)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(BSKTheme.warning.opacity(0.09), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                } else if selectedPlayer == nil {
                    Text("Välj en spelare för att se aktiva mål.")
                        .font(.subheadline)
                        .foregroundStyle(BSKTheme.muted)
                        .padding(.vertical, 8)
                } else {
                    VStack(spacing: 8) {
                        ForEach(selectedPlayer?.activeGoals ?? []) { goal in
                            goalButton(goal)
                        }
                    }
                }
            }

            VStack(alignment: .leading, spacing: 10) {
                sectionLabel("3. Vad såg du?", systemImage: "waveform.path.ecg")
                HStack(spacing: 8) {
                    evidenceButton(value: "shown", title: "Visade", systemImage: "sparkles")
                    evidenceButton(value: "practicing", title: "Tränar på", systemImage: "arrow.triangle.2.circlepath")
                    evidenceButton(value: "revisit", title: "Följ upp", systemImage: "flag.fill")
                }
            }

            VStack(alignment: .leading, spacing: 10) {
                sectionLabel("Anteckning", systemImage: "text.alignleft")
                ZStack(alignment: .topLeading) {
                    if note.isEmpty {
                        Text("Vad gjorde spelaren? Kort och konkret...")
                            .font(.subheadline)
                            .foregroundStyle(BSKTheme.muted)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 17)
                            .allowsHitTesting(false)
                    }
                    TextEditor(text: $note)
                        .font(.body)
                        .foregroundStyle(Color.white)
                        .scrollContentBackground(.hidden)
                        .padding(11)
                        .frame(minHeight: 108)
                        .background(Color.clear)
                }
                .background(BSKTheme.backgroundDeep.opacity(0.72), in: RoundedRectangle(cornerRadius: 17, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 17, style: .continuous).stroke(BSKTheme.border, lineWidth: 1))
            }

            if let confirmation {
                Label(confirmation, systemImage: "checkmark.circle.fill")
                    .font(.subheadline.bold())
                    .foregroundStyle(BSKTheme.accent)
                    .padding(13)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(BSKTheme.accent.opacity(0.09), in: RoundedRectangle(cornerRadius: 15, style: .continuous))
            }
            if model.queuedObservationCount > 0 {
                Label("\(model.queuedObservationCount) väntar på synkning", systemImage: "arrow.triangle.2.circlepath")
                    .font(.caption.bold())
                    .foregroundStyle(BSKTheme.warning)
            }

            Button {
                Task { await save() }
            } label: {
                HStack {
                    if isSaving {
                        ProgressView().tint(BSKTheme.backgroundDeep)
                    } else {
                        Image(systemName: "checkmark.circle.fill")
                    }
                    Text(isSaving ? "Sparar..." : "Spara observation")
                        .font(.headline)
                    Spacer()
                    if !isSaving { Image(systemName: "arrow.right") }
                }
                .foregroundStyle(canSave ? BSKTheme.backgroundDeep : BSKTheme.muted)
                .padding(.horizontal, 18)
                .frame(height: 56)
                .background(canSave ? BSKTheme.accent : BSKTheme.elevated, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            }
            .buttonStyle(.plain)
            .disabled(!canSave)
        }
        .padding(20)
        .background(BSKTheme.surface, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).stroke(BSKTheme.border, lineWidth: 1))
        .task(id: activity.id) { await loadPlayers() }
        .onChange(of: selectedPlayerID) { _, _ in selectInitialGoal() }
    }

    private func sectionLabel(_ title: String, systemImage: String) -> some View {
        Label(title, systemImage: systemImage)
            .font(.caption.bold())
            .foregroundStyle(BSKTheme.secondary)
    }

    private func playerButton(_ player: PlayerSummary) -> some View {
        let selected = player.id == selectedPlayerID
        return Button {
            selectedPlayerID = player.id
            confirmation = nil
        } label: {
            HStack(spacing: 9) {
                Text(String(player.name.prefix(1)).uppercased())
                    .font(.caption.bold())
                    .foregroundStyle(selected ? BSKTheme.backgroundDeep : BSKTheme.accent)
                    .frame(width: 30, height: 30)
                    .background(selected ? BSKTheme.accent : BSKTheme.accent.opacity(0.1), in: Circle())
                Text(player.name)
                    .font(.subheadline.bold())
                    .foregroundStyle(selected ? Color.white : BSKTheme.secondary)
                    .lineLimit(1)
            }
            .padding(.horizontal, 12)
            .frame(height: 50)
            .background(selected ? BSKTheme.elevated : BSKTheme.backgroundDeep.opacity(0.55), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(selected ? BSKTheme.accent : BSKTheme.border, lineWidth: selected ? 1.5 : 1))
        }
        .buttonStyle(.plain)
    }

    private func goalButton(_ goal: GoalSummary) -> some View {
        let selected = goal.id == selectedGoalID
        return Button {
            selectedGoalID = goal.id
            confirmation = nil
        } label: {
            HStack(spacing: 12) {
                Image(systemName: selected ? "checkmark.circle.fill" : "circle")
                    .font(.title3)
                    .foregroundStyle(selected ? BSKTheme.accent : BSKTheme.muted)
                Text(goal.title)
                    .font(.subheadline.bold())
                    .foregroundStyle(selected ? Color.white : BSKTheme.secondary)
                    .multilineTextAlignment(.leading)
                Spacer()
            }
            .padding(14)
            .background(selected ? BSKTheme.accent.opacity(0.08) : BSKTheme.backgroundDeep.opacity(0.55), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(selected ? BSKTheme.accent.opacity(0.7) : BSKTheme.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private func evidenceButton(value: String, title: String, systemImage: String) -> some View {
        let selected = evidence == value
        return Button {
            evidence = value
            confirmation = nil
        } label: {
            VStack(spacing: 8) {
                Image(systemName: systemImage).font(.headline)
                Text(title).font(.caption.bold()).lineLimit(1).minimumScaleFactor(0.78)
            }
            .foregroundStyle(selected ? BSKTheme.backgroundDeep : BSKTheme.secondary)
            .frame(maxWidth: .infinity, minHeight: 72)
            .background(selected ? BSKTheme.accent : BSKTheme.backgroundDeep.opacity(0.55), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(selected ? BSKTheme.accent : BSKTheme.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private func selectInitialPlayer() {
        if selectedPlayerID == nil {
            selectedPlayerID = matchPlayers.first(where: { !$0.activeGoals.isEmpty })?.id ?? matchPlayers.first?.id
        }
        selectInitialGoal()
    }

    @MainActor
    private func loadPlayers() async {
        isLoadingPlayers = true
        defer { isLoadingPlayers = false }
        do {
            matchPlayers = try await model.activityPlayers(id: activity.id)
            selectedPlayerID = nil
            selectInitialPlayer()
        } catch {
            matchPlayers = []
            model.errorMessage = error.localizedDescription
        }
    }

    private func selectInitialGoal() {
        selectedGoalID = selectedPlayer?.activeGoals.first?.id
    }

    @MainActor
    private func save() async {
        guard let playerID = selectedPlayerID, let goalID = selectedGoalID else { return }
        isSaving = true
        confirmation = nil
        defer { isSaving = false }
        do {
            let status = try await model.saveObservation(
                activityID: activity.id,
                playerID: playerID,
                goalID: goalID,
                evidence: evidence,
                note: note
            )
            confirmation = status == .saved ? "Observationen är sparad." : "Sparad offline och synkas automatiskt."
            note = ""
        } catch {
            model.errorMessage = error.localizedDescription
        }
    }
}

struct TodayList: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @Binding var selection: String?
    @State private var selectedPlayerLoad: PlayerMatchLoad?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                VStack(alignment: .leading, spacing: 14) {
                    VStack(alignment: .leading, spacing: 5) {
                        Text("MATCHVECKAN").font(.caption2.bold()).tracking(1.6).foregroundStyle(BSKTheme.accent)
                        Text("Den här veckan").font(.title.bold())
                    }
                    if thisWeeksMatches.isEmpty {
                        Label("Inga fler matcher den här veckan", systemImage: "calendar")
                            .font(.subheadline)
                            .foregroundStyle(BSKTheme.secondary)
                            .padding(16)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(BSKTheme.surface, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                            .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(BSKTheme.border))
                    } else {
                        ForEach(Array(thisWeeksMatches.enumerated()), id: \.element.id) { index, activity in
                            matchLink(activity, featured: index == 0)
                        }
                    }
                }

                VStack(alignment: .leading, spacing: 12) {
                    VStack(alignment: .leading, spacing: 5) {
                        Text("GULSPELARE").font(.caption2.bold()).tracking(1.6).foregroundStyle(BSKTheme.accent)
                        Text("Mest matchutrymme").font(.title2.bold())
                        Text("Spelade matcher de senaste sju dagarna")
                            .font(.caption)
                            .foregroundStyle(BSKTheme.muted)
                    }
                    if model.playerMatchLoads.isEmpty {
                        Text("Inga Gulspelare hittades.")
                            .font(.subheadline)
                            .foregroundStyle(BSKTheme.secondary)
                            .padding(.vertical, 8)
                    } else {
                        VStack(spacing: 0) {
                            ForEach(sortedPlayerLoads) { player in
                                Button { selectedPlayerLoad = player } label: {
                                    playerLoadRow(player)
                                }
                                .buttonStyle(.plain)
                                if player.id != sortedPlayerLoads.last?.id {
                                    Divider().overlay(BSKTheme.hairline).padding(.leading, 14)
                                }
                            }
                        }
                        .background(BSKTheme.surface, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(BSKTheme.border))
                    }
                }
            }
            .padding(horizontalSizeClass == .compact ? 14 : 18)
            .frame(maxWidth: 840)
            .frame(maxWidth: .infinity)
        }
        .navigationTitle("Idag")
        .background(BSKTheme.canvas)
        .refreshable { await model.reload() }
        .sheet(item: $selectedPlayerLoad) { player in
            NavigationStack {
                PlayerMatchLoadDetail(player: player)
            }
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.visible)
        }
    }

    private var sortedPlayerLoads: [PlayerMatchLoad] {
        model.playerMatchLoads.sorted {
            $0.capacity > $1.capacity || ($0.capacity == $1.capacity && $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending)
        }
    }

    private func playerLoadRow(_ player: PlayerMatchLoad) -> some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(player.name).font(.subheadline.bold()).foregroundStyle(.white)
                Text(player.recentMatches.count == 1 ? "1 match senaste 7 dagarna" : "\(player.recentMatches.count) matcher senaste 7 dagarna")
                    .font(.caption2)
                    .foregroundStyle(BSKTheme.muted)
            }
            Spacer(minLength: 8)
            VStack(alignment: .trailing, spacing: 6) {
                Text("\(player.capacity) %")
                    .font(.system(size: 15, weight: .black, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(capacityColor(player.capacity))
                ProgressView(value: Double(player.capacity), total: 100)
                    .tint(capacityColor(player.capacity))
                    .frame(width: horizontalSizeClass == .compact ? 92 : 130)
            }
            Image(systemName: "chevron.right").font(.caption.bold()).foregroundStyle(BSKTheme.muted)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(player.name), \(player.capacity) procent matchutrymme, \(player.recentMatches.count) matcher senaste sju dagarna")
    }

    private func capacityColor(_ capacity: Int) -> Color {
        if capacity >= 75 { return BSKTheme.accent }
        if capacity >= 40 { return BSKTheme.warning }
        return BSKTheme.danger
    }

    @ViewBuilder
    private func matchLink(_ activity: ActivitySummary, featured: Bool) -> some View {
        if horizontalSizeClass == .compact {
            NavigationLink { ActivityDetail(activity: activity) } label: { matchCard(activity, featured: featured) }
                .buttonStyle(.plain)
        } else {
            Button { selection = activity.id } label: { matchCard(activity, featured: featured) }
                .buttonStyle(.plain)
        }
    }

    @ViewBuilder
    private func matchCard(_ activity: ActivitySummary, featured: Bool) -> some View {
        if horizontalSizeClass == .compact {
            compactMatchRow(activity, featured: featured)
        } else {
        HStack(spacing: featured ? 18 : 13) {
            ZStack {
                RoundedRectangle(cornerRadius: featured ? 22 : 16, style: .continuous)
                    .fill(featured ? BSKTheme.accent : BSKTheme.accent.opacity(0.14))
                Image(systemName: "sportscourt.fill")
                    .font(.system(size: featured ? 28 : 20, weight: .bold))
                    .foregroundStyle(featured ? BSKTheme.backgroundDeep : BSKTheme.accent)
            }
            .frame(width: featured ? 76 : 52, height: featured ? 76 : 52)
            VStack(alignment: .leading, spacing: featured ? 8 : 5) {
                Text(featured ? "NÄSTA MATCH" : "MATCH")
                    .font(.caption2.bold()).tracking(1.3).foregroundStyle(BSKTheme.accent)
                Text(activity.title)
                    .font(featured ? .title2.bold() : .headline)
                    .foregroundStyle(.white)
                    .multilineTextAlignment(.leading)
                Label(activitySchedule(activity), systemImage: "calendar")
                    .font(.caption).foregroundStyle(BSKTheme.secondary)
                if featured, !activity.theme.isEmpty {
                    Text(activity.theme).font(.caption).foregroundStyle(BSKTheme.muted).lineLimit(2)
                }
            }
            Spacer()
            Image(systemName: "arrow.up.right")
                .font(.caption.bold()).foregroundStyle(BSKTheme.accent).padding(9)
                .background(BSKTheme.accent.opacity(0.1), in: Circle())
        }
        .padding(featured ? 22 : 16)
        .background(
            LinearGradient(colors: [BSKTheme.elevated, BSKTheme.surface], startPoint: .topLeading, endPoint: .bottomTrailing),
            in: RoundedRectangle(cornerRadius: featured ? 26 : 20, style: .continuous)
        )
        .overlay(RoundedRectangle(cornerRadius: featured ? 26 : 20, style: .continuous).stroke(featured ? BSKTheme.accent.opacity(0.45) : BSKTheme.border, lineWidth: 1))
        .shadow(color: .black.opacity(featured ? 0.28 : 0.14), radius: featured ? 20 : 10, y: 8)
        }
    }

    private func compactMatchRow(_ activity: ActivitySummary, featured: Bool) -> some View {
        HStack(spacing: 12) {
            compactDateTile(activity.date)
            VStack(alignment: .leading, spacing: 4) {
                Text(featured ? "NÄSTA MATCH" : "MATCH")
                    .font(.system(size: 9, weight: .black)).tracking(1.2).foregroundStyle(BSKTheme.accent)
                Text(activity.title).font(.subheadline.bold()).foregroundStyle(.white).lineLimit(1)
                if !activity.theme.isEmpty { Text(activity.theme).font(.caption2).foregroundStyle(BSKTheme.muted).lineLimit(1) }
            }
            Spacer(minLength: 4)
            VStack(alignment: .trailing, spacing: 8) {
                Text(activity.startTime ?? "--:--")
                    .font(.system(size: 19, weight: .black, design: .rounded)).monospacedDigit().foregroundStyle(.white)
                Image(systemName: "chevron.right").font(.caption.bold()).foregroundStyle(BSKTheme.muted)
            }
        }
        .padding(12)
        .background(BSKTheme.surface, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(featured ? BSKTheme.accent.opacity(0.42) : BSKTheme.border))
    }

    private func compactDateTile(_ date: String) -> some View {
        let parts = date.split(separator: "-").compactMap { Int($0) }
        let day = parts.count == 3 ? parts[2] : 0
        let month = parts.count == 3 ? parts[1] : 0
        let months = ["JAN", "FEB", "MAR", "APR", "MAJ", "JUN", "JUL", "AUG", "SEP", "OKT", "NOV", "DEC"]
        let monthText = (1...12).contains(month) ? months[month - 1] : ""
        return VStack(spacing: 1) {
            Text(String(format: "%02d", day)).font(.system(size: 20, weight: .black, design: .rounded)).foregroundStyle(.white)
            Text(monthText).font(.system(size: 9, weight: .bold)).tracking(0.7).foregroundStyle(BSKTheme.muted)
        }
        .frame(width: 50, height: 56)
        .background(BSKTheme.elevated, in: RoundedRectangle(cornerRadius: 13, style: .continuous))
    }

    private var thisWeeksMatches: [ActivitySummary] {
        let today = Self.dayFormatter.string(from: .now)
        let endOfWeek = Calendar.current.dateInterval(of: .weekOfYear, for: .now)?.end ?? .now
        let lastDay = Self.dayFormatter.string(from: endOfWeek.addingTimeInterval(-1))
        return model.activities
            .filter {
                $0.type == "match"
                    && $0.isPrimaryMatch
                    && !$0.finished
                    && $0.date >= today
                    && $0.date <= lastDay
            }
            .sorted { ($0.date, $0.startTime ?? "") < ($1.date, $1.startTime ?? "") }
    }

    private func activitySchedule(_ activity: ActivitySummary) -> String {
        [activity.date, activity.startTime].compactMap { $0 }.joined(separator: " · ")
    }

    private static let dayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .iso8601)
        formatter.locale = Locale(identifier: "sv_SE")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()
}

private struct PlayerMatchLoadDetail: View {
    @Environment(\.dismiss) private var dismiss
    let player: PlayerMatchLoad

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("MATCHUTRYMME").font(.caption2.bold()).tracking(1.6).foregroundStyle(BSKTheme.accent)
                    HStack(alignment: .firstTextBaseline) {
                        Text(player.name).font(.largeTitle.bold())
                        Spacer()
                        Text("\(player.capacity) %")
                            .font(.title.bold()).monospacedDigit().foregroundStyle(capacityColor)
                    }
                    ProgressView(value: Double(player.capacity), total: 100)
                        .tint(capacityColor)
                    Text(player.recentMatches.count == 1 ? "1 spelad match de senaste sju dagarna" : "\(player.recentMatches.count) spelade matcher de senaste sju dagarna")
                        .font(.caption).foregroundStyle(BSKTheme.muted)
                }

                VStack(alignment: .leading, spacing: 12) {
                    Text("Kommande matcher").font(.title3.bold())
                    if player.upcomingMatches.isEmpty {
                        Label("Inga kommande matcher registrerade", systemImage: "calendar.badge.checkmark")
                            .font(.subheadline)
                            .foregroundStyle(BSKTheme.secondary)
                            .padding(16)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(BSKTheme.surface, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                    } else {
                        VStack(spacing: 0) {
                            ForEach(player.upcomingMatches) { match in
                                HStack(spacing: 12) {
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(match.title).font(.subheadline.bold())
                                        Text([match.date, match.startTime].compactMap { $0 }.joined(separator: " · "))
                                            .font(.caption).foregroundStyle(BSKTheme.muted)
                                    }
                                    Spacer()
                                    VStack(alignment: .trailing, spacing: 4) {
                                        Text(match.sourceTeam).font(.caption.bold()).foregroundStyle(BSKTheme.secondary)
                                        Text(statusLabel(match.status)).font(.caption2.bold()).foregroundStyle(statusColor(match.status))
                                    }
                                }
                                .padding(14)
                                if match.id != player.upcomingMatches.last?.id {
                                    Divider().overlay(BSKTheme.hairline).padding(.leading, 14)
                                }
                            }
                        }
                        .background(BSKTheme.surface, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(BSKTheme.border))
                    }
                }
            }
            .padding(20)
        }
        .background(BSKTheme.canvas)
        .navigationTitle("Spelare")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("Klar") { dismiss() }
            }
        }
    }

    private var capacityColor: Color {
        if player.capacity >= 75 { return BSKTheme.accent }
        if player.capacity >= 40 { return BSKTheme.warning }
        return BSKTheme.danger
    }

    private func statusLabel(_ status: String) -> String {
        switch status {
        case "selected": return "Uttagen"
        case "accepted": return "Tackat ja"
        default: return "Inväntar svar"
        }
    }

    private func statusColor(_ status: String) -> Color {
        status == "pending" ? BSKTheme.warning : BSKTheme.accent
    }
}

struct TodayDetail: View {
    @EnvironmentObject private var model: AppModel
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                Text("UTVECKLINGSVERKTYGET")
                    .font(.caption2.bold())
                    .tracking(1.6)
                    .foregroundStyle(BSKTheme.accent)
                Text("Hej \(model.user?.name.components(separatedBy: " ").first ?? "tränare")")
                    .font(.largeTitle.bold())
                Text("Veckans matcher, kallelseläget och det som behöver följas upp.")
                    .font(.title3)
                    .foregroundStyle(.secondary)
                VStack(alignment: .leading, spacing: 8) {
                    Label("Efterarbete och spelarbedömning finns under Utvärdera.", systemImage: "checklist")
                    Label("Spelarprofiler och utvecklingsmål finns under Spelare.", systemImage: "person.3")
                }
                .foregroundStyle(.secondary)
            }
            .padding(28)
            .frame(maxWidth: 800, alignment: .leading)
        }
        .background(BSKTheme.background)
        .navigationTitle("Översikt")
    }
}

struct SelectionList: View {
    @EnvironmentObject private var model: AppModel
    @Binding var selection: String?

    var body: some View {
        List(model.selectionMatches, selection: $selection) { match in
            AdaptiveListLink(value: match.id, selection: $selection) {
                SelectionDetail(match: match)
            } label: {
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Image(systemName: "sportscourt.fill").foregroundStyle(BSKTheme.accent)
                        Text(match.title).fontWeight(.semibold)
                    }
                    Text([match.date, match.startTime].compactMap { $0 }.joined(separator: " · "))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    HStack(spacing: 8) {
                        if match.selectionCount > 0 { Text("\(match.selectionCount) valda") }
                        let called = match.acceptedCallupCount + match.declinedCallupCount + match.pendingCallupCount
                        if called > 0 { Text("\(called) kallade") }
                    }
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                }
                .padding(.vertical, 4)
            }
        }
        .navigationTitle("Uttagning")
        .bskListSurface()
        .refreshable { await model.reload() }
    }
}

struct SelectionDetail: View {
    @EnvironmentObject private var model: AppModel
    let match: SelectionMatchSummary
    @State private var workspace: SelectionWorkspace?
    @State private var decisions: [Int: String] = [:]
    @State private var positions: [Int: String] = [:]
    @State private var isSaving = false
    @State private var savedMessage: String?

    var body: some View {
        Group {
            if let workspace {
                List {
                    Section("Match") {
                        LabeledContent("Datum", value: [match.date, match.startTime].compactMap { $0 }.joined(separator: " · "))
                        LabeledContent("Kallelse", value: "\(match.acceptedCallupCount) ja · \(match.declinedCallupCount) nej · \(match.pendingCallupCount) inväntar")
                        LabeledContent("Valda", value: String(selectedCount))
                        if let savedMessage { Label(savedMessage, systemImage: "checkmark.circle.fill").foregroundStyle(.green) }
                    }

                    Section("Spelare") {
                        ForEach(workspace.candidates) { candidate in
                            candidateRow(candidate)
                        }
                    }
                }
                .bskListSurface()
                .safeAreaInset(edge: .bottom) {
                    Button {
                        Task { await save() }
                    } label: {
                        if isSaving {
                            ProgressView().frame(maxWidth: .infinity)
                        } else {
                            Text("Spara uttagning · \(selectedCount) valda").frame(maxWidth: .infinity)
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(BSKTheme.accent)
                    .disabled(isSaving)
                    .padding()
                    .background(.bar)
                }
            } else {
                ProgressView("Läser uttagning…")
            }
        }
        .navigationTitle(match.title)
        .task(id: match.id) { await load() }
    }

    private var selectedCount: Int {
        decisions.values.filter { $0 == "selected" }.count
    }

    @ViewBuilder
    private func candidateRow(_ candidate: SelectionCandidate) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text(candidate.name).fontWeight(.semibold)
                    Text(candidate.teamNames.isEmpty ? "Ingen lagkoppling" : candidate.teamNames.joined(separator: " · "))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                if let status = candidate.currentCallupStatus {
                    Text(callupLabel(status))
                        .font(.caption.bold())
                        .foregroundStyle(status == "declined" ? BSKTheme.danger : status == "accepted" ? BSKTheme.accent : BSKTheme.warning)
                }
            }

            Picker("Beslut", selection: decisionBinding(candidate)) {
                Text("Vald").tag("selected")
                Text("Reserv").tag("reserve")
                Text("Vilar").tag("rested")
            }
            .pickerStyle(.segmented)

            if decisions[candidate.playerId] == "selected" {
                Picker("Position", selection: positionBinding(candidate)) {
                    ForEach(["", "Målvakt", "Back", "Mittfält", "Vänsterkant", "Högerkant", "Anfall"], id: \.self) { position in
                        Text(position.isEmpty ? "Ej satt" : position).tag(position)
                    }
                }
            }

            Text("\(candidate.selectedLastEight) av senaste 8 · \(candidate.callupCount) kallelser")
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 5)
    }

    private func decisionBinding(_ candidate: SelectionCandidate) -> Binding<String> {
        Binding(
            get: { decisions[candidate.playerId] ?? candidate.decision },
            set: { decisions[candidate.playerId] = $0; savedMessage = nil }
        )
    }

    private func positionBinding(_ candidate: SelectionCandidate) -> Binding<String> {
        Binding(
            get: { positions[candidate.playerId] ?? candidate.primaryPosition },
            set: { positions[candidate.playerId] = $0; savedMessage = nil }
        )
    }

    @MainActor
    private func load() async {
        do {
            let loaded = try await model.selectionWorkspace(id: match.id)
            workspace = loaded
            decisions = Dictionary(uniqueKeysWithValues: loaded.candidates.map { ($0.playerId, $0.decision) })
            positions = Dictionary(uniqueKeysWithValues: loaded.candidates.map { ($0.playerId, $0.primaryPosition.isEmpty ? $0.position : $0.primaryPosition) })
        } catch {
            model.errorMessage = error.localizedDescription
        }
    }

    @MainActor
    private func save() async {
        guard let workspace else { return }
        isSaving = true
        savedMessage = nil
        defer { isSaving = false }
        let payload = workspace.candidates.map { candidate in
            SelectionDecision(
                playerId: candidate.playerId,
                decision: decisions[candidate.playerId] ?? candidate.decision,
                position: positions[candidate.playerId] ?? candidate.primaryPosition
            )
        }
        do {
            let updated = try await model.saveSelection(id: match.id, decisions: payload)
            self.workspace = updated
            savedMessage = "Uttagningen är sparad."
        } catch {
            model.errorMessage = error.localizedDescription
        }
    }

    private func callupLabel(_ status: String) -> String {
        switch status {
        case "accepted": return "Ja"
        case "declined": return "Nej"
        default: return "Inväntar"
        }
    }
}

struct MatchCenterView: View {
    @EnvironmentObject private var model: AppModel
    let matchID: Int
    let title: String

    @State private var state: LiveMatchState?
    @State private var loadedAt = Date()
    @State private var isMutating = false
    @State private var showScorers = false
    @State private var showReset = false
    @State private var showFinish = false

    var body: some View {
        Group {
            if let state {
                TimelineView(.periodic(from: .now, by: 1)) { context in
                    ScrollView {
                        VStack(spacing: 14) {
                            scoreCard(state)
                            clockCard(state, at: context.date)
                            goalControls(state)
                            recentGoals(state)
                        }
                        .padding(10)
                        .frame(maxWidth: 620)
                        .frame(maxWidth: .infinity)
                    }
                    .refreshable { await load() }
                }
            } else {
                ProgressView("Öppnar matchcenter…")
            }
        }
        .background(BSKBackdrop())
        .navigationTitle("Matchcenter")
        .navigationBarTitleDisplayMode(.inline)
        .task(id: matchID) { await pollLiveState() }
        .sheet(isPresented: $showScorers) {
            scorerPicker
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
        }
        .confirmationDialog("Nollställ klockan?", isPresented: $showReset, titleVisibility: .visible) {
            Button("Nollställ matchklockan", role: .destructive) { Task { await send(.clock("reset")) } }
            Button("Avbryt", role: .cancel) {}
        }
        .confirmationDialog("Avsluta matchen?", isPresented: $showFinish, titleVisibility: .visible) {
            Button("Avsluta match", role: .destructive) { Task { await send(.finish) } }
            Button("Avbryt", role: .cancel) {}
        } message: {
            Text("Matchklockan stoppas och rapporteringen stängs för alla.")
        }
    }

    private func scoreCard(_ state: LiveMatchState) -> some View {
        VStack(spacing: 13) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text(state.finished ? "MATCH SLUT" : "LIVE MATCH").font(.system(size: 10, weight: .black)).tracking(1.5).foregroundStyle(BSKTheme.accent)
                    Text(title).font(.headline).foregroundStyle(.white).lineLimit(1)
                }
                Spacer()
                Text("P\(state.period) AV \(state.periods)")
                    .font(.system(size: 10, weight: .black)).tracking(1).foregroundStyle(BSKTheme.secondary)
            }
            HStack(spacing: 18) {
                scoreTeam("BSK", score: state.ourScore)
                Text("–").font(.title.bold()).foregroundStyle(BSKTheme.muted)
                scoreTeam(state.opponent, score: state.oppScore)
            }
        }
        .padding(12)
        .background(BSKTheme.hero, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(BSKTheme.accent.opacity(0.3)))
    }

    private func scoreTeam(_ name: String, score: Int) -> some View {
        VStack(spacing: 3) {
            Text(String(score)).font(.system(size: 34, weight: .black, design: .rounded)).monospacedDigit().foregroundStyle(.white)
            Text(name).font(.caption.bold()).foregroundStyle(BSKTheme.secondary).lineLimit(1)
        }
        .frame(maxWidth: .infinity)
    }

    private func clockCard(_ state: LiveMatchState, at date: Date) -> some View {
        let elapsed = displayedSeconds(state, at: date)
        let limit = max(1, state.periodMinutes * 60)
        return VStack(spacing: 9) {
            HStack {
                Label("Period \(state.period)", systemImage: "timer").font(.caption.bold()).foregroundStyle(BSKTheme.secondary)
                Spacer()
                Circle().fill(state.clockRunning ? BSKTheme.accent : BSKTheme.muted).frame(width: 7, height: 7)
                Text(state.finished ? "MATCH SLUT" : state.clockRunning ? (elapsed >= limit ? "TILLÄGGSTID" : "IGÅNG") : "PAUS")
                    .font(.system(size: 9, weight: .black)).tracking(1).foregroundStyle(BSKTheme.secondary)
            }
            Text(clockText(elapsed))
                .font(.system(size: 44, weight: .black, design: .rounded)).monospacedDigit().foregroundStyle(.white)
                .contentTransition(.numericText())
            ProgressView(value: Double(elapsed), total: Double(limit)).tint(BSKTheme.accent)
            HStack(spacing: 9) {
                Button {
                    Task { await send(.clock(state.clockRunning ? "pause" : "start")) }
                } label: {
                    Label(state.clockRunning ? "Pausa" : "Starta", systemImage: state.clockRunning ? "pause.fill" : "play.fill")
                        .font(.caption.bold()).frame(maxWidth: .infinity).frame(height: 34)
                }
                .buttonStyle(.borderedProminent).tint(BSKTheme.accent).disabled(isMutating || state.finished)

                if state.period < state.periods {
                    Button { Task { await send(.clock("next_period")) } } label: {
                        Image(systemName: "forward.end.fill").font(.caption.bold()).frame(width: 32, height: 32)
                    }
                    .buttonStyle(.bordered).tint(BSKTheme.secondary).disabled(isMutating || state.finished)
                    .accessibilityLabel("Nästa period")
                }
                Button { showReset = true } label: {
                    Image(systemName: "arrow.counterclockwise").font(.caption.bold()).frame(width: 32, height: 32)
                }
                .buttonStyle(.bordered).tint(BSKTheme.secondary).disabled(isMutating || state.finished)
                .accessibilityLabel("Nollställ klockan")
            }
            if state.period >= state.periods, !state.finished {
                Button { showFinish = true } label: {
                    Label("Avsluta match", systemImage: "checkered.flag")
                        .font(.caption.bold()).frame(maxWidth: .infinity).frame(height: 34)
                }
                .buttonStyle(.bordered).tint(BSKTheme.danger).disabled(isMutating)
            }
        }
        .padding(10)
        .background(BSKTheme.surface, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(BSKTheme.border))
    }

    private func goalControls(_ state: LiveMatchState) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("REGISTRERA MÅL").font(.system(size: 10, weight: .black)).tracking(1.4).foregroundStyle(BSKTheme.accent)
            HStack(spacing: 8) {
                Button { showScorers = true } label: {
                    Label("Mål BSK", systemImage: "plus.circle.fill").font(.caption.bold()).frame(maxWidth: .infinity).frame(height: 36)
                }
                .buttonStyle(.borderedProminent).tint(BSKTheme.accent).disabled(isMutating || state.finished)
                Button { Task { await send(.opponentGoal()) } } label: {
                    Label("Motståndare", systemImage: "plus.circle").font(.caption.bold()).frame(maxWidth: .infinity).frame(height: 36)
                }
                .buttonStyle(.bordered).tint(BSKTheme.danger).disabled(isMutating || state.finished)
            }
            Button { Task { await send(.undo) } } label: {
                Label("Ångra senaste målhändelsen", systemImage: "arrow.uturn.backward")
                    .font(.caption2.bold())
            }
            .buttonStyle(.plain).foregroundStyle(BSKTheme.secondary).disabled(isMutating || goalEvents(state).isEmpty)
        }
        .padding(12)
        .background(BSKTheme.surface, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(BSKTheme.border))
    }

    @ViewBuilder
    private func recentGoals(_ state: LiveMatchState) -> some View {
        let goals = Array(goalMoments(state).prefix(3))
        if !goals.isEmpty {
            VStack(alignment: .leading, spacing: 0) {
                Text("SENASTE MÅLEN").font(.system(size: 10, weight: .black)).tracking(1.4).foregroundStyle(BSKTheme.accent).padding(.bottom, 7)
                ForEach(goals) { goal in
                    HStack {
                        Text(goal.event.statId == "opponent_goal" ? state.opponent : (goal.event.playerName ?? "BSK"))
                            .font(.subheadline.bold()).foregroundStyle(.white)
                        Spacer()
                        Text(eventTime(goal.event)).font(.caption).monospacedDigit().foregroundStyle(BSKTheme.secondary)
                        scoreAfterGoal(goal)
                    }
                    .padding(.vertical, 6)
                    Divider().overlay(BSKTheme.hairline)
                }
            }
            .padding(12)
            .background(BSKTheme.surface, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
    }

    private var scorerPicker: some View {
        ZStack {
            Rectangle().fill(BSKTheme.canvas).ignoresSafeArea()
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("MÅL BSK").font(.system(size: 10, weight: .black)).tracking(1.4).foregroundStyle(BSKTheme.accent)
                        Text("Välj målskytt").font(.title2.bold()).foregroundStyle(.white)
                    }
                    Spacer()
                    Button { showScorers = false } label: {
                        Image(systemName: "xmark").font(.caption.bold()).frame(width: 34, height: 34)
                            .background(BSKTheme.elevated, in: Circle())
                    }
                    .foregroundStyle(BSKTheme.secondary)
                }

                ScrollView {
                    LazyVGrid(columns: [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)], spacing: 8) {
                        ForEach(state?.players ?? []) { player in
                            Button {
                                showScorers = false
                                Task { await send(.goal(playerID: player.id)) }
                            } label: {
                                HStack(spacing: 8) {
                                    Text(player.jerseyNumber.map(String.init) ?? String(player.name.prefix(1)))
                                        .font(.headline.bold())
                                        .foregroundStyle(BSKTheme.backgroundDeep)
                                        .frame(width: 34, height: 34)
                                        .background(BSKTheme.accent, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                                    Text(player.name).font(.caption.bold()).foregroundStyle(.white).lineLimit(1)
                                    Spacer(minLength: 0)
                                }
                                .padding(8)
                                .background(BSKTheme.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                                .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(BSKTheme.border))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
            .padding(16)
        }
    }

    private func displayedSeconds(_ state: LiveMatchState, at date: Date) -> Int {
        let live = state.clockRunning ? max(0, Int(date.timeIntervalSince(loadedAt))) : 0
        return state.clockSeconds + live
    }

    private func clockText(_ seconds: Int) -> String {
        String(format: "%02d:%02d", max(0, seconds) / 60, max(0, seconds) % 60)
    }

    private func goalEvents(_ state: LiveMatchState) -> [LiveMatchState.Event] {
        state.events.filter { $0.statId == "goals" || $0.statId == "opponent_goal" }
    }

    private func goalMoments(_ state: LiveMatchState) -> [GoalMoment] {
        var ourScore = state.ourScore
        var opponentScore = state.oppScore
        return goalEvents(state).map { event in
            let moment = GoalMoment(event: event, ourScore: ourScore, opponentScore: opponentScore)
            if event.statId == "opponent_goal" { opponentScore = max(0, opponentScore - 1) }
            else { ourScore = max(0, ourScore - 1) }
            return moment
        }
    }

    private func scoreAfterGoal(_ goal: GoalMoment) -> some View {
        HStack(spacing: 1) {
            Text("\(goal.ourScore)")
                .foregroundStyle(goal.event.statId == "goals" ? BSKTheme.accent : .white)
            Text("–").foregroundStyle(BSKTheme.muted)
            Text("\(goal.opponentScore)")
                .foregroundStyle(goal.event.statId == "opponent_goal" ? BSKTheme.danger : .white)
        }
        .font(.system(.headline, design: .rounded, weight: .black))
        .monospacedDigit()
        .padding(.leading, 7)
    }

    private func eventTime(_ event: LiveMatchState.Event) -> String {
        guard let seconds = event.matchSecond else { return "–" }
        return "P\(event.period ?? 1) \(clockText(seconds))"
    }

    @MainActor private func pollLiveState() async {
        await load()
        while !Task.isCancelled {
            do {
                try await Task.sleep(for: .seconds(10))
            } catch {
                return
            }
            guard !isMutating else { continue }
            await load(reportErrors: false)
        }
    }

    @MainActor private func load(reportErrors: Bool = true) async {
        do {
            let loaded = try await model.liveMatch(id: matchID)
            state = loaded
            loadedAt = Date()
            if #available(iOS 16.1, *) { await MatchLiveActivityManager.sync(matchID: matchID, title: title, state: loaded) }
        } catch {
            if reportErrors { model.errorMessage = error.localizedDescription }
        }
    }

    @MainActor private func send(_ command: LiveMatchCommand) async {
        guard !isMutating else { return }
        isMutating = true
        defer { isMutating = false }
        do {
            let updated = try await model.updateLiveMatch(id: matchID, command: command)
            state = updated
            loadedAt = Date()
            if #available(iOS 16.1, *) { await MatchLiveActivityManager.sync(matchID: matchID, title: title, state: updated) }
            if updated.finished { await model.reload() }
        } catch { model.errorMessage = error.localizedDescription }
    }
}

private struct GoalMoment: Identifiable {
    let event: LiveMatchState.Event
    let ourScore: Int
    let opponentScore: Int

    var id: Int { event.id }
}

struct MatchEvaluationList: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @Binding var selection: Int?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                VStack(alignment: .leading, spacing: 5) {
                    Text("MATCHUPPFÖLJNING").font(.caption2.bold()).tracking(1.6).foregroundStyle(BSKTheme.accent)
                    Text("Utvärdera").font(.title.bold())
                    Text("Fortsätt där du slutade eller öppna en ny match.").foregroundStyle(BSKTheme.secondary)
                }
                LazyVGrid(columns: [GridItem(.adaptive(minimum: horizontalSizeClass == .compact ? 320 : 245), spacing: 10)], spacing: 10) {
                    ForEach(model.matchEvaluations) { match in
                        evaluationLink(match)
                    }
                }
            }
            .padding(horizontalSizeClass == .compact ? 14 : 18)
            .frame(maxWidth: 900)
            .frame(maxWidth: .infinity)
        }
        .navigationTitle("Utvärdera")
        .background(BSKTheme.canvas)
        .refreshable { await model.reload() }
        .overlay {
            if model.matchEvaluations.isEmpty {
                ContentUnavailableView("Inga matcher att utvärdera", systemImage: "checklist", description: Text("Matcher från den senaste veckan visas här."))
            }
        }
    }

    @ViewBuilder
    private func evaluationLink(_ match: MatchEvaluationSummary) -> some View {
        if horizontalSizeClass == .compact {
            NavigationLink { MatchEvaluationView(matchID: match.id) } label: { compactEvaluationRow(match) }
                .buttonStyle(.plain)
        } else {
            Button { selection = match.id } label: { evaluationCard(match) }
                .buttonStyle(.plain)
        }
    }

    private func compactEvaluationRow(_ match: MatchEvaluationSummary) -> some View {
        let complete = match.total > 0 && match.handled == match.total
        return HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 13, style: .continuous).fill((complete ? BSKTheme.accent : BSKTheme.warning).opacity(0.13))
                Image(systemName: complete ? "checkmark" : "figure.soccer")
                    .font(.headline.bold()).foregroundStyle(complete ? BSKTheme.accent : BSKTheme.warning)
            }.frame(width: 48, height: 48)
            VStack(alignment: .leading, spacing: 4) {
                Text("\(match.homeAway == "home" ? "Hemma mot" : "Borta mot") \(match.opponent)")
                    .font(.subheadline.bold()).foregroundStyle(.white).lineLimit(1)
                Text([match.date, match.startTime].compactMap { $0 }.joined(separator: " · "))
                    .font(.caption).foregroundStyle(BSKTheme.secondary)
                ProgressView(value: Double(match.handled), total: Double(max(match.total, 1)))
                    .tint(complete ? BSKTheme.accent : BSKTheme.warning)
            }
            VStack(alignment: .trailing, spacing: 4) {
                Text("\(match.handled)/\(match.total)").font(.headline.bold()).monospacedDigit().foregroundStyle(.white)
                Text(complete ? "KLAR" : match.handled > 0 ? "FORTSÄTT" : "STARTA")
                    .font(.system(size: 9, weight: .black)).tracking(0.8).foregroundStyle(complete ? BSKTheme.accent : BSKTheme.warning)
            }
            Image(systemName: "chevron.right").font(.caption.bold()).foregroundStyle(BSKTheme.muted)
        }
        .padding(12)
        .background(BSKTheme.surface, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(complete ? BSKTheme.accent.opacity(0.35) : BSKTheme.border))
    }

    private func evaluationCard(_ match: MatchEvaluationSummary) -> some View {
        let complete = match.total > 0 && match.handled == match.total
        return VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 5) {
                    Text(match.homeAway == "home" ? "HEMMA" : "BORTA")
                        .font(.caption2.bold()).tracking(1.4).foregroundStyle(BSKTheme.accent)
                    Text(match.opponent).font(.title3.bold()).foregroundStyle(.white)
                    Text([match.date, match.startTime].compactMap { $0 }.joined(separator: " · "))
                        .font(.caption).foregroundStyle(BSKTheme.secondary)
                }
                Spacer()
                Image(systemName: complete ? "checkmark.seal.fill" : "figure.soccer")
                    .font(.title2).foregroundStyle(complete ? BSKTheme.accent : BSKTheme.warning)
            }
            ProgressView(value: Double(match.handled), total: Double(max(match.total, 1)))
                .tint(complete ? BSKTheme.accent : BSKTheme.warning)
            HStack {
                Text("\(match.handled) av \(match.total) spelare").font(.caption.bold()).foregroundStyle(BSKTheme.secondary)
                Spacer()
                Text(complete ? "KLAR" : match.handled > 0 ? "FORTSÄTT" : "STARTA")
                    .font(.caption2.bold()).tracking(1.1)
                    .foregroundStyle(complete ? BSKTheme.accent : BSKTheme.warning)
            }
        }
        .padding(18)
        .background(BSKTheme.surface, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).stroke(complete ? BSKTheme.accent.opacity(0.35) : BSKTheme.border, lineWidth: 1))
    }
}

struct MatchEvaluationView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @Environment(\.dismiss) private var dismiss
    let matchID: Int
    var onComplete: (() -> Void)? = nil
    @State private var workspace: MatchEvaluationWorkspace?
    @State private var answers: [Int: MatchEvaluationAnswer] = [:]
    @State private var activeIndex = 0
    @State private var isSaving = false
    @State private var savedMessage: String?

    var body: some View {
        Group {
            if let workspace, !workspace.players.isEmpty {
                ScrollView {
                    VStack(alignment: .leading, spacing: horizontalSizeClass == .compact ? 12 : 18) {
                        progressCard(workspace)
                        playerCard(workspace.players[activeIndex])
                    }
                    .padding(horizontalSizeClass == .compact ? 12 : 20)
                    .frame(maxWidth: 760)
                    .frame(maxWidth: .infinity)
                }
                .background(BSKTheme.background)
            } else if workspace != nil {
                ContentUnavailableView("Ingen matchtrupp", systemImage: "person.3", description: Text("Lägg spelare i truppen före utvärderingen."))
            } else {
                ProgressView("Läser match…")
            }
        }
        .navigationTitle(workspace?.match.opponent ?? "Utvärdera")
        .task(id: matchID) { await load() }
    }

    private func progressCard(_ workspace: MatchEvaluationWorkspace) -> some View {
        HStack(spacing: horizontalSizeClass == .compact ? 10 : 18) {
            VStack(alignment: .leading, spacing: 8) {
                Text(workspace.match.homeAway == "home" ? "HEMMAMATCH" : "BORTAMATCH")
                    .font(.caption2.bold())
                    .tracking(1.6)
                    .foregroundStyle(BSKTheme.accent)
                Text(workspace.match.opponent)
                    .font(horizontalSizeClass == .compact ? .headline.bold() : .title2.bold())
                    .foregroundStyle(.white)
                HStack(spacing: 8) {
                    Label(workspace.match.date, systemImage: "calendar")
                    if let startTime = workspace.match.startTime {
                        Label(startTime, systemImage: "clock")
                    }
                }
                .font(.caption)
                .foregroundStyle(BSKTheme.secondary)
                ProgressView(value: Double(handledCount), total: Double(workspace.players.count))
                    .tint(BSKTheme.accent)
            }

            ZStack {
                Circle().stroke(BSKTheme.border, lineWidth: 7)
                Circle()
                    .trim(from: 0, to: Double(handledCount) / Double(max(workspace.players.count, 1)))
                    .stroke(BSKTheme.accent, style: StrokeStyle(lineWidth: 7, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                VStack(spacing: 0) {
                    Text("\(handledCount)").font(.title2.bold()).monospacedDigit()
                    Text("av \(workspace.players.count)").font(.caption2).foregroundStyle(BSKTheme.muted)
                }
            }
            .frame(width: horizontalSizeClass == .compact ? 52 : 72, height: horizontalSizeClass == .compact ? 52 : 72)

            if horizontalSizeClass != .compact {
            VStack(alignment: .leading, spacing: 4) {
                Text("SPELARE").font(.caption2.bold()).tracking(1.2).foregroundStyle(BSKTheme.muted)
                Text("\(activeIndex + 1)/\(workspace.players.count)").font(.headline).monospacedDigit()
            }
            }

            Spacer(minLength: 0)
        }
        .overlay(alignment: .bottomLeading) {
            VStack(alignment: .leading, spacing: 5) {
            if let savedMessage {
                    Label(savedMessage, systemImage: savedMessage == "Sparat" ? "checkmark.circle.fill" : "arrow.triangle.2.circlepath")
                        .font(.caption.bold())
                        .foregroundStyle(savedMessage == "Sparat" ? BSKTheme.accent : BSKTheme.warning)
            }
            if model.queuedMatchEvaluationCount > 0 {
                Label("\(model.queuedMatchEvaluationCount) utvärdering väntar på synkning", systemImage: "arrow.triangle.2.circlepath")
                    .font(.caption)
                    .foregroundStyle(BSKTheme.warning)
            }
            }
            .offset(y: 34)
        }
        .padding(horizontalSizeClass == .compact ? 14 : 20)
        .padding(.bottom, savedMessage == nil && model.queuedMatchEvaluationCount == 0 ? 0 : 28)
        .background(
            LinearGradient(
                colors: [BSKTheme.elevated, BSKTheme.surface],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).stroke(BSKTheme.border, lineWidth: 1))
    }

    private func playerCard(_ player: MatchEvaluationWorkspace.Player) -> some View {
        let answer = answers[player.id] ?? blankAnswer(player)
        return VStack(alignment: .leading, spacing: horizontalSizeClass == .compact ? 9 : 24) {
            HStack(spacing: horizontalSizeClass == .compact ? 10 : 16) {
                ZStack {
                    RoundedRectangle(cornerRadius: 20, style: .continuous)
                        .fill(LinearGradient(colors: [BSKTheme.accent, BSKTheme.accent.opacity(0.68)], startPoint: .topLeading, endPoint: .bottomTrailing))
                    Text(player.jerseyNumber.map(String.init) ?? String(player.name.prefix(1)))
                        .font(.title.bold())
                        .foregroundStyle(.black.opacity(0.78))
                }
                .frame(width: horizontalSizeClass == .compact ? 44 : 68, height: horizontalSizeClass == .compact ? 44 : 68)

                VStack(alignment: .leading, spacing: 4) {
                    Text("BEDÖM SPELAREN").font(.caption2.bold()).tracking(1.4).foregroundStyle(BSKTheme.muted)
                    Text(player.name).font(horizontalSizeClass == .compact ? .title2.bold() : .title.bold())
                    if !player.level.isEmpty {
                        Text(player.level).font(.caption.bold()).foregroundStyle(BSKTheme.accent)
                    }
                }
                Spacer()
                if activeIndex > 0 {
                    Button {
                        activeIndex -= 1
                        savedMessage = nil
                    } label: {
                        Image(systemName: "chevron.left")
                            .font(.subheadline.bold())
                            .foregroundStyle(BSKTheme.secondary)
                            .frame(width: 36, height: 36)
                            .background(BSKTheme.elevated, in: RoundedRectangle(cornerRadius: 11, style: .continuous))
                            .overlay(RoundedRectangle(cornerRadius: 11, style: .continuous).stroke(BSKTheme.border))
                    }
                    .buttonStyle(.plain)
                    .disabled(isSaving)
                    .accessibilityLabel("Föregående spelare")
                }
                if answer.skipped {
                    Label("Överhoppad", systemImage: "forward.fill")
                        .font(.caption.bold())
                        .foregroundStyle(BSKTheme.warning)
                }
            }

            if answer.skipped {
                Button { update(player.id) { $0.skipped = false } } label: {
                    Label("Bedöm spelaren istället", systemImage: "arrow.uturn.backward.circle.fill")
                        .font(.subheadline.bold())
                        .foregroundStyle(BSKTheme.backgroundDeep)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 13)
                        .background(BSKTheme.accent, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
                .buttonStyle(.plain)
            } else {
                ChoiceRow(
                    title: "Jämfört med sin vanliga nivå",
                    systemImage: "person.line.dotted.person.fill",
                    values: ["below", "usual", "above"],
                    labels: ["Sämre", "Som vanligt", "Bättre"],
                    selection: answer.selfComparison
                ) { value in update(player.id) { $0.selfComparison = value } }

                ChoiceRow(
                    title: "På den här matchnivån",
                    systemImage: "sportscourt.fill",
                    values: ["struggled", "held", "influenced"],
                    labels: ["Hade svårt", "Hängde med", "Påverkade"],
                    selection: answer.matchImpact
                ) { value in update(player.id) { $0.matchImpact = value } }

                ReasonTagChoices(selection: answer.reasonTag) { value in
                    update(player.id) { $0.reasonTag = value }
                }

                Group {
                    if horizontalSizeClass == .compact {
                        HStack(spacing: 8) {
                            saveButton
                            skipButton(player.id)
                        }
                    } else {
                        VStack(spacing: 10) {
                            saveButton
                            skipButton(player.id)
                        }
                    }
                }
            }
        }
        .padding(horizontalSizeClass == .compact ? 11 : 22)
        .background(BSKTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).stroke(BSKTheme.border, lineWidth: 1))
    }

    private var saveButton: some View {
        Button {
            Task { await save(advance: activeIndex < (workspace?.players.count ?? 1) - 1) }
        } label: {
            HStack(spacing: 6) {
                if isSaving { ProgressView().tint(BSKTheme.backgroundDeep) }
                Text(activeIndex < (workspace?.players.count ?? 1) - 1 ? "Spara & nästa" : "Spara")
                Image(systemName: activeIndex < (workspace?.players.count ?? 1) - 1 ? "arrow.right.circle.fill" : "checkmark.circle.fill")
            }
            .font(.subheadline.bold())
            .foregroundStyle(BSKTheme.backgroundDeep)
            .frame(maxWidth: .infinity)
            .frame(height: 46)
            .background(BSKTheme.accent, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(isSaving)
        .opacity(isSaving ? 0.5 : 1)
    }

    private func skipButton(_ playerID: Int) -> some View {
        Button {
            update(playerID) {
                $0.selfComparison = nil
                $0.matchImpact = nil
                $0.reasonTag = ""
                $0.skipped = true
            }
            Task { await save(advance: activeIndex < (workspace?.players.count ?? 1) - 1) }
        } label: {
            Label("Hoppa över", systemImage: "forward.fill")
                .font(.subheadline.bold())
                .foregroundStyle(BSKTheme.secondary)
                .frame(maxWidth: .infinity)
                .frame(height: 46)
                .background(BSKTheme.elevated, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(BSKTheme.border))
        }
        .buttonStyle(.plain)
        .disabled(isSaving)
        .opacity(isSaving ? 0.5 : 1)
    }

    private var handledCount: Int { answers.values.filter(isHandled).count }

    private func isHandled(_ playerID: Int) -> Bool { answers[playerID].map(isHandled) ?? false }
    private func isHandled(_ answer: MatchEvaluationAnswer) -> Bool {
        answer.skipped || (answer.selfComparison != nil && answer.matchImpact != nil)
    }

    private func blankAnswer(_ player: MatchEvaluationWorkspace.Player) -> MatchEvaluationAnswer {
        .init(
            playerId: player.id,
            selfComparison: player.selfComparison,
            matchImpact: player.matchImpact,
            reasonTag: player.reasonTag,
            skipped: player.skipped
        )
    }

    private func update(_ playerID: Int, change: (inout MatchEvaluationAnswer) -> Void) {
        guard let player = workspace?.players.first(where: { $0.id == playerID }) else { return }
        var answer = answers[playerID] ?? blankAnswer(player)
        change(&answer)
        savedMessage = nil
        answers[playerID] = answer
    }

    @MainActor
    private func load() async {
        do {
            let loaded = try await model.matchEvaluation(id: matchID)
            workspace = loaded
            answers = Dictionary(uniqueKeysWithValues: loaded.players.map { ($0.id, blankAnswer($0)) })
            if let pending = model.pendingMatchEvaluation(id: matchID) {
                for answer in pending.answers { answers[answer.playerId] = answer }
                activeIndex = min(pending.activeIndex, max(0, loaded.players.count - 1))
                savedMessage = "Väntar på synkning"
            } else {
                activeIndex = loaded.players.firstIndex(where: { player in
                    answers[player.id].map { !isHandled($0) } ?? true
                }) ?? max(0, loaded.players.count - 1)
            }
        } catch {
            model.errorMessage = error.localizedDescription
        }
    }

    @MainActor
    private func save(advance: Bool) async {
        guard !isSaving else { return }
        isSaving = true
        defer { isSaving = false }
        do {
            guard let currentWorkspace = workspace else { return }
            let nextIndex = advance ? min(activeIndex + 1, currentWorkspace.players.count - 1) : activeIndex
            if advance { activeIndex = nextIndex }
            let status = try await model.saveMatchEvaluation(
                id: matchID,
                answers: Array(answers.values),
                workspace: currentWorkspace,
                activeIndex: nextIndex
            )
            switch status {
            case .saved(let updated):
                workspace = updated
                savedMessage = "Sparat"
            case .queued:
                savedMessage = "Väntar på synkning"
            }
            finishAfterLastPlayerIfNeeded(in: currentWorkspace, advanced: advance)
        } catch {
            model.errorMessage = error.localizedDescription
        }
    }

    private func finishAfterLastPlayerIfNeeded(in workspace: MatchEvaluationWorkspace, advanced: Bool) {
        guard !advanced, activeIndex == workspace.players.count - 1 else { return }
        let incompleteIndices = workspace.players.indices.filter { index in
            !isHandled(workspace.players[index].id)
        }
        if let firstIncomplete = incompleteIndices.first {
            activeIndex = firstIncomplete
            savedMessage = "(incompleteIndices.count) spelare kvar"
        } else {
            onComplete?()
            dismiss()
        }
    }
}

private struct ChoiceRow: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    let title: String
    let systemImage: String
    let values: [String]
    let labels: [String]
    let selection: String?
    let select: (String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: horizontalSizeClass == .compact ? 6 : 11) {
            Label(title, systemImage: systemImage)
                .font(.subheadline.bold())
                .foregroundStyle(BSKTheme.secondary)
            Group {
                if horizontalSizeClass == .compact {
                    HStack(spacing: 6) {
                        ForEach(values.indices, id: \.self) { index in
                            choiceButton(value: values[index], label: labels[index])
                        }
                    }
                } else {
                    VStack(spacing: 8) {
                        ForEach(values.indices, id: \.self) { index in
                            choiceButton(value: values[index], label: labels[index])
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func choiceButton(value: String, label: String) -> some View {
        let selected = selection == value
        Button { select(value) } label: {
            HStack(spacing: horizontalSizeClass == .compact ? 5 : 11) {
                Image(systemName: selected ? "checkmark.square.fill" : "square")
                    .font((horizontalSizeClass == .compact ? Font.body : Font.title3).bold())
                    .foregroundStyle(selected ? BSKTheme.accent : BSKTheme.muted)
                Text(label)
                    .font(horizontalSizeClass == .compact ? .caption.bold() : .subheadline.bold())
                    .foregroundStyle(selected ? Color.white : BSKTheme.secondary)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, horizontalSizeClass == .compact ? 7 : 14)
            .frame(maxWidth: .infinity, minHeight: horizontalSizeClass == .compact ? 40 : 48)
            .background(selected ? BSKTheme.accent.opacity(0.13) : BSKTheme.elevated)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(selected ? BSKTheme.accent.opacity(0.65) : BSKTheme.border, lineWidth: selected ? 1.5 : 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}

private struct ReasonTagChoices: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    private let options = [
        ("", "Ingen särskild"),
        ("decisions", "Beslut"),
        ("defence", "Försvar"),
        ("attack", "Anfall"),
        ("effort", "Arbetsinsats"),
        ("confidence", "Självförtroende"),
    ]
    let selection: String
    let select: (String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: horizontalSizeClass == .compact ? 6 : 11) {
            Label("Vad påverkade mest?", systemImage: "scope")
                .font(.subheadline.bold())
                .foregroundStyle(BSKTheme.secondary)
            LazyVGrid(
                columns: Array(repeating: GridItem(.flexible(), spacing: 6), count: horizontalSizeClass == .compact ? 3 : 2),
                spacing: horizontalSizeClass == .compact ? 6 : 8
            ) {
                ForEach(options, id: \.0) { value, label in
                    let selected = selection == value
                    Button { select(value) } label: {
                        HStack(spacing: horizontalSizeClass == .compact ? 4 : 8) {
                            Image(systemName: selected ? "checkmark.square.fill" : "square")
                                .font((horizontalSizeClass == .compact ? Font.caption : Font.body).bold())
                                .foregroundStyle(selected ? BSKTheme.accent : BSKTheme.muted)
                            Text(label)
                                .font(horizontalSizeClass == .compact ? .system(size: 10, weight: .bold) : .caption.bold())
                                .foregroundStyle(selected ? Color.white : BSKTheme.secondary)
                                .lineLimit(1)
                            Spacer(minLength: 0)
                        }
                        .padding(.horizontal, horizontalSizeClass == .compact ? 5 : 11)
                        .frame(minHeight: horizontalSizeClass == .compact ? 36 : 44)
                        .background(selected ? BSKTheme.accent.opacity(0.13) : BSKTheme.elevated)
                        .clipShape(RoundedRectangle(cornerRadius: 13, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 13, style: .continuous)
                                .stroke(selected ? BSKTheme.accent.opacity(0.65) : BSKTheme.border)
                        )
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(selected ? .isSelected : [])
                }
            }
        }
    }
}
