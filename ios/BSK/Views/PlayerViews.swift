import SwiftUI

struct PlayerList: View {
    @EnvironmentObject private var model: AppModel
    @Binding var selection: Int?

    var body: some View {
        List(model.players, selection: $selection) { player in
            NavigationLink(value: player.id) {
                HStack(spacing: 12) {
                    Text(player.name.prefix(1))
                        .font(.headline)
                        .frame(width: 38, height: 38)
                        .background(Color.accentColor.opacity(0.16), in: Circle())
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

    var body: some View {
        ScrollView {
            if let detail {
                VStack(alignment: .leading, spacing: 24) {
                    HStack(alignment: .top, spacing: 16) {
                        Text(detail.name.prefix(1))
                            .font(.largeTitle.bold())
                            .frame(width: 72, height: 72)
                            .background(Color.accentColor.opacity(0.18), in: Circle())
                        VStack(alignment: .leading, spacing: 5) {
                            Text(detail.name).font(.largeTitle.bold())
                            Text([detail.primaryPosition, detail.position].filter { !$0.isEmpty }.joined(separator: " · "))
                                .foregroundStyle(.secondary)
                        }
                    }

                    SectionTitle("Aktuellt fokus")
                    if detail.activeGoals.isEmpty {
                        Text("Inget aktivt fokus.").foregroundStyle(.secondary)
                    } else {
                        ForEach(detail.activeGoals) { goal in
                            VStack(alignment: .leading, spacing: 6) {
                                Text(goal.title).font(.headline)
                                if !goal.evidenceHint.isEmpty { Text(goal.evidenceHint).foregroundStyle(.secondary) }
                            }
                            .padding()
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 16))
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
                        .padding(.vertical, 6)
                        Divider()
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
        .navigationTitle(detail?.name ?? "Spelare")
        .task(id: playerID) {
            detail = nil
            loadError = nil
            do { detail = try await model.playerDetail(id: playerID) }
            catch { loadError = error.localizedDescription }
        }
    }

    private func evidenceLabel(_ value: String) -> String {
        switch value {
        case "shown": return "Visade färdigheten"
        case "practicing": return "Tränar på färdigheten"
        default: return "Behöver följas upp"
        }
    }
}

private struct SectionTitle: View {
    let title: String
    init(_ title: String) { self.title = title }
    var body: some View { Text(title).font(.title2.bold()) }
}
