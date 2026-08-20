import SwiftUI

struct ActivityList: View {
    @EnvironmentObject private var model: AppModel
    @Binding var selection: String?

    var body: some View {
        List(model.activities, selection: $selection) { activity in
            NavigationLink(value: activity.id) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(activity.title).fontWeight(.semibold)
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
        .refreshable { await model.reload() }
    }
}

struct ActivityDetail: View {
    @EnvironmentObject private var model: AppModel
    let activity: ActivitySummary

    var body: some View {
        Form {
            Section("Aktivitet") {
                LabeledContent("Datum", value: activity.date)
                if let time = activity.startTime { LabeledContent("Start", value: time) }
                LabeledContent("Typ", value: activity.type)
                LabeledContent("Observationer", value: String(activity.observationCount))
            }
            if !activity.theme.isEmpty {
                Section("Tema") { Text(activity.theme) }
            }
            Section {
                ObservationComposer(activity: activity)
            }
        }
        .navigationTitle(activity.title)
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
    @State private var confirmation: String?

    private var selectedPlayer: PlayerSummary? {
        model.players.first { $0.id == selectedPlayerID }
    }

    private var canSave: Bool {
        selectedPlayerID != nil && selectedGoalID != nil && !isSaving
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Ny observation").font(.headline)

            Picker("Spelare", selection: $selectedPlayerID) {
                Text("Välj spelare").tag(nil as Int?)
                ForEach(model.players) { player in
                    Text(player.name).tag(player.id as Int?)
                }
            }

            Picker("Aktivt mål", selection: $selectedGoalID) {
                Text("Välj mål").tag(nil as String?)
                ForEach(selectedPlayer?.activeGoals ?? []) { goal in
                    Text(goal.title).tag(goal.id as String?)
                }
            }
            .disabled(selectedPlayer == nil || selectedPlayer?.activeGoals.isEmpty == true)

            Picker("Bedömning", selection: $evidence) {
                Text("Visade").tag("shown")
                Text("Tränar på").tag("practicing")
                Text("Följ upp").tag("revisit")
            }
            .pickerStyle(.segmented)

            TextField("Kort anteckning (valfritt)", text: $note, axis: .vertical)
                .lineLimit(2...4)

            Button {
                Task { await save() }
            } label: {
                if isSaving {
                    ProgressView().frame(maxWidth: .infinity)
                } else {
                    Label("Spara observation", systemImage: "checkmark.circle.fill")
                        .frame(maxWidth: .infinity)
                }
            }
            .buttonStyle(.borderedProminent)
            .disabled(!canSave)

            if let confirmation {
                Label(confirmation, systemImage: "checkmark.circle")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            if model.queuedObservationCount > 0 {
                Label("\(model.queuedObservationCount) väntar på synkning", systemImage: "arrow.triangle.2.circlepath")
                    .font(.footnote)
                    .foregroundStyle(.orange)
            }
        }
        .onAppear { selectInitialPlayer() }
        .onChange(of: selectedPlayerID) { _, _ in selectInitialGoal() }
    }

    private func selectInitialPlayer() {
        if selectedPlayerID == nil {
            selectedPlayerID = model.players.first(where: { !$0.activeGoals.isEmpty })?.id
        }
        selectInitialGoal()
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
    @Binding var selection: String?

    var body: some View {
        List(selection: $selection) {
            if thisWeeksMatches.isEmpty {
                ContentUnavailableView(
                    "Inga fler matcher den här veckan",
                    systemImage: "calendar",
                    description: Text("När nya matcher har hämtats visas de här.")
                )
            } else {
                Section("Den här veckan") {
                    ForEach(thisWeeksMatches) { activity in
                        NavigationLink(value: activity.id) {
                            VStack(alignment: .leading, spacing: 3) {
                                Text(activity.title).fontWeight(.semibold)
                                Text(activitySchedule(activity)).font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle("Idag")
        .refreshable { await model.reload() }
    }

    private var thisWeeksMatches: [ActivitySummary] {
        let today = Self.dayFormatter.string(from: .now)
        let endOfWeek = Calendar.current.dateInterval(of: .weekOfYear, for: .now)?.end ?? .now
        let lastDay = Self.dayFormatter.string(from: endOfWeek.addingTimeInterval(-1))
        return model.activities
            .filter { $0.type == "match" && $0.date >= today && $0.date <= lastDay }
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

struct TodayDetail: View {
    @EnvironmentObject private var model: AppModel
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                Text("Hej \(model.user?.name.components(separatedBy: " ").first ?? "tränare")")
                    .font(.largeTitle.bold())
                Text("Veckans matcher, kallelseläget och det som behöver följas upp.")
                    .font(.title3)
                    .foregroundStyle(.secondary)
                VStack(alignment: .leading, spacing: 8) {
                    Label("Matchhistorik och efterarbete finns under Observera.", systemImage: "chart.xyaxis.line")
                    Label("Spelarprofiler och utvecklingsmål finns under Spelare.", systemImage: "person.3")
                }
                .foregroundStyle(.secondary)
            }
            .padding(28)
            .frame(maxWidth: 800, alignment: .leading)
        }
        .navigationTitle("Översikt")
    }
}

struct SelectionList: View {
    @EnvironmentObject private var model: AppModel
    @Binding var selection: String?

    var body: some View {
        List(model.selectionMatches, selection: $selection) { match in
            NavigationLink(value: match.id) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(match.title).fontWeight(.semibold)
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
                        .foregroundStyle(status == "declined" ? .red : .secondary)
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
