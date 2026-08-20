import SwiftUI

struct ActivityList: View {
    @EnvironmentObject private var model: AppModel
    @Binding var selection: String?

    var body: some View {
        List(model.activities, selection: $selection) { activity in
            NavigationLink(value: activity.id) {
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
    let activity: ActivitySummary

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                matchHero

                LazyVGrid(columns: [GridItem(.adaptive(minimum: 145), spacing: 12)], spacing: 12) {
                    metricCard(
                        eyebrow: "AVSPARK",
                        value: activity.startTime ?? "Tid saknas",
                        systemImage: "clock.fill"
                    )
                    metricCard(
                        eyebrow: "OBSERVATIONER",
                        value: activity.observationCount == 1 ? "1 sparad" : "\(activity.observationCount) sparade",
                        systemImage: "checkmark.seal.fill"
                    )
                }

                if !activity.theme.isEmpty {
                    VStack(alignment: .leading, spacing: 10) {
                        Label("Matchens fokus", systemImage: "scope")
                            .font(.caption.bold())
                            .tracking(1.1)
                            .foregroundStyle(BSKTheme.accent)
                        Text(activity.theme)
                            .font(.title3.bold())
                            .foregroundStyle(Color.white)
                    }
                    .padding(18)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(BSKTheme.elevated, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(BSKTheme.border, lineWidth: 1))
                }

                ObservationComposer(activity: activity)
            }
            .padding(18)
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
                Text("NÄSTA MATCH")
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
                Text("Förbered observationerna före avspark")
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
        .padding(22)
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

    private func metricCard(eyebrow: String, value: String, systemImage: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: systemImage)
                .font(.headline)
                .foregroundStyle(BSKTheme.accent)
                .frame(width: 40, height: 40)
                .background(BSKTheme.accent.opacity(0.11), in: RoundedRectangle(cornerRadius: 13, style: .continuous))
            VStack(alignment: .leading, spacing: 3) {
                Text(eyebrow)
                    .font(.system(size: 9, weight: .bold))
                    .tracking(1)
                    .foregroundStyle(BSKTheme.muted)
                Text(value)
                    .font(.subheadline.bold())
                    .foregroundStyle(Color.white)
            }
            Spacer(minLength: 0)
        }
        .padding(15)
        .background(BSKTheme.surface, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(BSKTheme.border, lineWidth: 1))
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
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 9) {
                        ForEach(model.players) { player in
                            playerButton(player)
                        }
                    }
                    .padding(.vertical, 2)
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
        .onAppear { selectInitialPlayer() }
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
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @Binding var selection: String?

    var body: some View {
        ScrollView {
            if thisWeeksMatches.isEmpty {
                ContentUnavailableView(
                    "Inga fler matcher den här veckan",
                    systemImage: "calendar",
                    description: Text("När nya matcher har hämtats visas de här.")
                )
                .frame(maxWidth: .infinity, minHeight: 420)
            } else {
                VStack(alignment: .leading, spacing: 22) {
                    VStack(alignment: .leading, spacing: 5) {
                        Text("MATCHVECKAN").font(.caption2.bold()).tracking(1.6).foregroundStyle(BSKTheme.accent)
                        Text("Nästa uppgift").font(.largeTitle.bold())
                    }
                    ForEach(Array(thisWeeksMatches.enumerated()), id: \.element.id) { index, activity in
                        matchLink(activity, featured: index == 0)
                    }
                }
                .padding(18)
                .frame(maxWidth: 840)
                .frame(maxWidth: .infinity)
            }
        }
        .navigationTitle("Idag")
        .background(BSKTheme.canvas)
        .refreshable { await model.reload() }
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

    private func matchCard(_ activity: ActivitySummary, featured: Bool) -> some View {
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

    private var thisWeeksMatches: [ActivitySummary] {
        let today = Self.dayFormatter.string(from: .now)
        let endOfWeek = Calendar.current.dateInterval(of: .weekOfYear, for: .now)?.end ?? .now
        let lastDay = Self.dayFormatter.string(from: endOfWeek.addingTimeInterval(-1))
        return model.activities
            .filter {
                $0.type == "match"
                    && $0.isPrimaryMatch
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
                    Label("Matchhistorik och efterarbete finns under Observera.", systemImage: "chart.xyaxis.line")
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
            NavigationLink(value: match.id) {
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

struct MatchEvaluationList: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @Binding var selection: Int?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                VStack(alignment: .leading, spacing: 5) {
                    Text("EFTER MATCHEN").font(.caption2.bold()).tracking(1.6).foregroundStyle(BSKTheme.accent)
                    Text("Spelarnas insats").font(.largeTitle.bold())
                    Text("Fortsätt där du slutade eller öppna en ny match.").foregroundStyle(BSKTheme.secondary)
                }
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 245), spacing: 14)], spacing: 14) {
                    ForEach(model.matchEvaluations) { match in
                        evaluationLink(match)
                    }
                }
            }
            .padding(18)
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
            NavigationLink { MatchEvaluationView(matchID: match.id) } label: { evaluationCard(match) }
                .buttonStyle(.plain)
        } else {
            Button { selection = match.id } label: { evaluationCard(match) }
                .buttonStyle(.plain)
        }
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
    let matchID: Int
    @State private var workspace: MatchEvaluationWorkspace?
    @State private var answers: [Int: MatchEvaluationAnswer] = [:]
    @State private var activeIndex = 0
    @State private var isSaving = false
    @State private var savedMessage: String?

    var body: some View {
        Group {
            if let workspace, !workspace.players.isEmpty {
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        progressCard(workspace)
                        playerCard(workspace.players[activeIndex])
                    }
                    .padding(20)
                    .frame(maxWidth: 760)
                    .frame(maxWidth: .infinity)
                }
                .background(BSKTheme.background)
                .safeAreaInset(edge: .bottom) { navigationBar(workspace) }
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
        HStack(spacing: 18) {
            VStack(alignment: .leading, spacing: 8) {
                Text(workspace.match.homeAway == "home" ? "HEMMAMATCH" : "BORTAMATCH")
                    .font(.caption2.bold())
                    .tracking(1.6)
                    .foregroundStyle(BSKTheme.accent)
                Text(workspace.match.opponent)
                    .font(.title2.bold())
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
            .frame(width: 72, height: 72)

            VStack(alignment: .leading, spacing: 4) {
                Text("SPELARE").font(.caption2.bold()).tracking(1.2).foregroundStyle(BSKTheme.muted)
                Text("\(activeIndex + 1)/\(workspace.players.count)").font(.headline).monospacedDigit()
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
        .padding(20)
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
        return VStack(alignment: .leading, spacing: 24) {
            HStack(spacing: 16) {
                ZStack {
                    RoundedRectangle(cornerRadius: 20, style: .continuous)
                        .fill(LinearGradient(colors: [BSKTheme.accent, BSKTheme.accent.opacity(0.68)], startPoint: .topLeading, endPoint: .bottomTrailing))
                    Text(player.jerseyNumber.map(String.init) ?? String(player.name.prefix(1)))
                        .font(.title.bold())
                        .foregroundStyle(.black.opacity(0.78))
                }
                .frame(width: 68, height: 68)

                VStack(alignment: .leading, spacing: 4) {
                    Text("BEDÖM SPELAREN").font(.caption2.bold()).tracking(1.4).foregroundStyle(BSKTheme.muted)
                    Text(player.name).font(.title.bold())
                    if !player.level.isEmpty {
                        Text(player.level).font(.caption.bold()).foregroundStyle(BSKTheme.accent)
                    }
                }
                Spacer()
                if answer.skipped {
                    Label("Överhoppad", systemImage: "forward.fill")
                        .font(.caption.bold())
                        .foregroundStyle(BSKTheme.warning)
                }
            }

            if answer.skipped {
                Button("Bedöm spelaren istället") { update(player.id) { $0.skipped = false } }
                    .buttonStyle(.bordered)
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

                HStack {
                    Label("Vad påverkade mest?", systemImage: "scope")
                        .font(.subheadline.bold())
                        .foregroundStyle(BSKTheme.secondary)
                    Spacer()
                    Picker("Orsakstagg", selection: Binding(
                        get: { answers[player.id]?.reasonTag ?? "" },
                        set: { value in update(player.id) { $0.reasonTag = value } }
                    )) {
                        Text("Ingen tagg").tag("")
                        Text("Beslut").tag("decisions")
                        Text("Försvar").tag("defence")
                        Text("Anfall").tag("attack")
                        Text("Arbetsinsats").tag("effort")
                        Text("Självförtroende").tag("confidence")
                    }
                    .tint(BSKTheme.accent)
                }
                .padding(14)
                .background(BSKTheme.elevated)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))

                Button("Hoppa över spelaren") {
                    update(player.id) {
                        $0.selfComparison = nil
                        $0.matchImpact = nil
                        $0.reasonTag = ""
                        $0.skipped = true
                    }
                }
                .buttonStyle(.bordered)
                .frame(maxWidth: .infinity)
                .tint(BSKTheme.muted)
            }
        }
        .padding(22)
        .background(BSKTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).stroke(BSKTheme.border, lineWidth: 1))
    }

    private func navigationBar(_ workspace: MatchEvaluationWorkspace) -> some View {
        HStack(spacing: 10) {
            Button("Föregående") {
                activeIndex = max(0, activeIndex - 1)
                savedMessage = nil
            }
            .buttonStyle(.bordered)
            .controlSize(.large)
            .disabled(activeIndex == 0 || isSaving)

            Button(activeIndex == workspace.players.count - 1 ? "Slutför" : "Spara och nästa") {
                Task { await save(advance: activeIndex < workspace.players.count - 1) }
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .tint(BSKTheme.accent)
            .disabled(!isHandled(workspace.players[activeIndex].id) || isSaving)
            .frame(maxWidth: .infinity)
        }
        .padding()
        .background(.ultraThinMaterial)
        .overlay(alignment: .top) { Rectangle().fill(BSKTheme.border).frame(height: 1) }
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
        isSaving = true
        defer { isSaving = false }
        do {
            guard let currentWorkspace = workspace else { return }
            let nextIndex = advance ? min(activeIndex + 1, currentWorkspace.players.count - 1) : activeIndex
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
            if advance { activeIndex += 1 }
        } catch {
            model.errorMessage = error.localizedDescription
        }
    }
}

private struct ChoiceRow: View {
    let title: String
    let systemImage: String
    let values: [String]
    let labels: [String]
    let selection: String?
    let select: (String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 11) {
            Label(title, systemImage: systemImage)
                .font(.subheadline.bold())
                .foregroundStyle(BSKTheme.secondary)
            HStack(spacing: 7) {
                ForEach(values.indices, id: \.self) { index in
                    choiceButton(value: values[index], label: labels[index])
                }
            }
        }
    }

    @ViewBuilder
    private func choiceButton(value: String, label: String) -> some View {
        if selection == value {
            Button(label) { select(value) }
                .font(.caption.bold())
                .buttonStyle(.borderedProminent)
                .tint(BSKTheme.accent)
                .frame(maxWidth: .infinity)
                .controlSize(.large)
        } else {
            Button(label) { select(value) }
                .font(.caption.bold())
                .buttonStyle(.bordered)
                .frame(maxWidth: .infinity)
                .controlSize(.large)
                .tint(BSKTheme.secondary)
        }
    }
}
