import SwiftUI

struct Practice: Decodable {
    let today: String
    let canTrain, canPlayers, canEdit, canPrivate: Bool
    let plans: [PracticePlan]
    let players: [DevelopmentPlayer]
}
struct PracticePlan: Decodable, Identifiable {
    let id, title, date: String
    let blocks: [Exercise]
    struct Exercise: Decodable, Identifiable { let id, title, notes: String; let minutes: Int }
    var countLabel: String { "\(blocks.count) " + (blocks.count == 1 ? "övning" : "övningar") }
    var duration: Int { blocks.reduce(0) { $0 + $1.minutes } }
}
struct DevelopmentPlayer: Decodable, Identifiable {
    let id: Int
    let name: String
    let checkpoint, conversation, followup: String?
}

struct PracticeView: View {
    @ObservedObject var browser: BrowserModel
    @State private var search = ""
    @State private var selectedPlan: String?
    @State private var exercise = 0
    private var development: Bool { browser.currentPath == "/utveckling" }
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                HStack {
                    VStack(alignment: .leading, spacing: 9) {
                        Text(development ? "VARJE SPELARES NÄSTA STEG" : "FRÅN IDÉ TILL TRÄNINGSPLAN").font(.system(size: 10, weight: .semibold)).tracking(2).foregroundStyle(Studio.muted)
                        Text(development ? "Utveckling börjar med att se." : "En tydlig plan. Mer tid på planen.").font(.system(size: 32, design: .serif))
                    }
                    Spacer()
                    Button { browser.refreshPractice() } label: { Image(systemName: "arrow.clockwise") }.help("Hämta senast sparade information")
                }
                if browser.practiceLoading { ProgressView("Hämtar sparad information…") }
                if let error = browser.practiceError { Text(error).foregroundStyle(Studio.muted) }
                if let data = browser.practice {
                    if development && data.canPlayers { players(data) } else if !development && data.canTrain { training(data) } else { Text("Du saknar behörighet till den här arbetsytan.") }
                }
            }.padding(36).frame(maxWidth: 1200, alignment: .leading).frame(maxWidth: .infinity)
        }.background(Studio.paper).foregroundStyle(Studio.ink)
    }
    @ViewBuilder private func training(_ data: Practice) -> some View {
        HStack {
            Text("Dina sparade pass").font(.system(size: 22, design: .serif))
            Spacer()
            Button("Planera nytt pass") { browser.open("/traning/nytt") }.buttonStyle(.borderedProminent).tint(Studio.forest)
        }
        Text("Planera i redigeraren. Genomför ett sparat pass övning för övning. Följ sedan upp spelarnas lärande.").font(.system(size: 13)).foregroundStyle(Studio.muted)
        if let plan = data.plans.first(where: { $0.id == selectedPlan }) {
            VStack(alignment: .leading, spacing: 20) {
                HStack { Text(plan.title).font(.system(size: 26, design: .serif)); Spacer(); Button("Stäng passet") { selectedPlan = nil } }
                Text("Sparad version · \(plan.duration) minuter · \(plan.countLabel)").foregroundStyle(Studio.muted)
                if plan.blocks.indices.contains(exercise) {
                    let block = plan.blocks[exercise]
                    Text("ÖVNING \(exercise + 1) AV \(plan.blocks.count) · \(block.minutes) MIN").font(.system(size: 11, weight: .semibold)).tracking(1.5)
                    Text(block.title).font(.system(size: 30, design: .serif))
                    Text(block.notes.isEmpty ? "Inga instruktioner har sparats för övningen." : block.notes).font(.system(size: 16)).textSelection(.enabled)
                    HStack {
                        Button("Föregående") { exercise -= 1 }.disabled(exercise == 0)
                        Button("Nästa övning") { exercise += 1 }.disabled(exercise + 1 >= plan.blocks.count)
                        Spacer()
                        Button("Öppna ritning och redigerare") { browser.open("/traning/\(plan.id)") }
                    }
                } else { Text("Passet saknar övningar. Lägg till dem i redigeraren.") }
                Divider()
                Button("Följ upp i spelarutveckling") { browser.open("/utveckling") }.disabled(!data.canPlayers)
                Text("Övningsvalet gäller bara den här vyn. Ingen närvaro eller genomförandestatus registreras.").font(.system(size: 11)).foregroundStyle(Studio.muted)
            }.practicePanel()
        }
        if data.plans.isEmpty { Text("Inga sparade pass ännu. Börja med att planera ditt första pass.").practicePanel() }
        ForEach(data.plans) { plan in
            HStack(spacing: 20) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(plan.title).font(.system(size: 20, design: .serif))
                    Text("\(plan.date.isEmpty ? "Utan datum" : plan.date) · \(plan.duration) min · \(plan.countLabel)").font(.system(size: 12)).foregroundStyle(Studio.muted)
                }
                Spacer()
                Button("Planera") { browser.open("/traning/\(plan.id)") }
                Button("Genomför") { selectedPlan = plan.id; exercise = 0 }.buttonStyle(.borderedProminent).tint(Studio.forest)
            }.practicePanel()
        }
    }
    @ViewBuilder private func players(_ data: Practice) -> some View {
        Text("Läs utvecklingsbilden → gör en avstämning → samtala → följ upp").font(.system(size: 13)).foregroundStyle(Studio.muted)
        TextField("Sök spelare", text: $search).textFieldStyle(.roundedBorder).frame(maxWidth: 380)
        if data.canPrivate {
            let due = data.players.filter { $0.followup.map { $0 <= data.today } ?? false }
            if !due.isEmpty { Label("\(due.count) spelare har ett uppföljningsdatum som har passerat eller infaller idag", systemImage: "calendar").font(.system(size: 12)).foregroundStyle(Studio.muted) }
        }
        let visible = data.players.filter { search.isEmpty || $0.name.localizedCaseInsensitiveContains(search) }
        if visible.isEmpty { Text("Inga spelare matchar sökningen.").practicePanel() }
        ForEach(visible) { player in
            VStack(alignment: .leading, spacing: 16) {
                HStack { Text(player.name).font(.system(size: 23, design: .serif)); Spacer(); Button("Läs utvecklingsbilden") { browser.open("/spelare/\(player.id)/utveckling") } }
                if data.canPrivate {
                    HStack(spacing: 25) {
                        fact("Senaste avstämning", player.checkpoint)
                        fact("Senaste samtal", player.conversation)
                        fact("Uppföljningsdatum", player.followup)
                    }
                }
                HStack {
                    if data.canEdit {
                        Button("Gör avstämning") { browser.open("/spelare/\(player.id)/utveckling/avstamning") }
                        Button("Förbered samtal") { browser.open("/spelare/\(player.id)?samtal=forbered#samtal") }
                    }
                    Spacer()
                    Button("Öppna profil och historik") { browser.open("/spelare/\(player.id)") }
                }
            }.practicePanel()
        }
    }
    private func fact(_ title: String, _ date: String?) -> some View {
        VStack(alignment: .leading, spacing: 5) { Text(title).font(.system(size: 10)).foregroundStyle(Studio.muted); Text(date ?? "Inte registrerat").font(.system(size: 12)) }
    }
}
private extension View {
    func practicePanel() -> some View {
        padding(24).frame(maxWidth: .infinity, alignment: .leading)
            .background(Studio.line.opacity(0.16), in: RoundedRectangle(cornerRadius: 15))
            .overlay(RoundedRectangle(cornerRadius: 15).strokeBorder(Studio.line))
    }
}

struct PracticeWorkflowBar: View {
    @ObservedObject var browser: BrowserModel
    private var training: Bool { browser.currentPath.hasPrefix("/traning/") }
    private var playerID: Int? {
        let parts = browser.currentPath.split(separator: "/")
        guard parts.count >= 2, parts[0] == "spelare", let id = Int(parts[1]), id > 0 else { return nil }
        return id
    }
    var body: some View {
        if training || playerID != nil {
            HStack(spacing: 18) {
                Button { browser.open(training ? "/traning" : "/utveckling") } label: {
                    Label(training ? "Träningsflödet" : "Utvecklingsflödet", systemImage: "arrow.left")
                }.buttonStyle(.plain).font(.system(size: 12, weight: .medium))
                Rectangle().fill(Studio.line).frame(width: 1, height: 22)
                Text(training ? "1 Planera  →  2 Genomför  →  3 Följ upp" : "1 Läs bilden  →  2 Stäm av  →  3 Samtala  →  4 Följ upp")
                    .font(.system(size: 11)).foregroundStyle(Studio.muted)
                Spacer()
            }.padding(.horizontal, 28).padding(.vertical, 15).background(Studio.paper)
                .overlay(alignment: .bottom) { Rectangle().fill(Studio.line).frame(height: 1) }
        }
    }
}
