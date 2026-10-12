import SwiftUI

struct Workspace: Decodable {
    let today: String
    let matches: [WorkflowMatch]
    let training: [TrainingSummary]
    let canTrain: Bool
    let canPlayers: Bool
}
struct TrainingSummary: Decodable, Identifiable {
    let id: String
    let title: String
    let date: String
}
struct WorkflowAction: Decodable { let title: String; let path: String }
enum WorkflowStage: String, Decodable, CaseIterable, Identifiable {
    case prepare, perform, review
    var id: String { rawValue }
    var title: String { switch self { case .prepare: "Förbered"; case .perform: "Genomför"; case .review: "Följ upp" } }
    var symbol: String { switch self { case .prepare: "square.and.pencil"; case .perform: "sportscourt"; case .review: "leaf" } }
    var detail: String { switch self {
    case .prepare: "Sätt laget och ge spelarna en tydlig idé."
    case .perform: "Ha matchplanen och truppen nära till hands."
    case .review: "Ta med lärdomarna till nästa träning och samtal."
    } }
}
struct WorkflowMatch: Decodable, Identifiable {
    let id: Int
    let title: String
    let date: String
    let time: String?
    let location: String
    let team: String
    let stage: WorkflowStage
    let planSaved: Bool
    let selected: Int
    let accepted: Int
    let evaluated: Int
    let total: Int
    let preparation: String
    let actions: Actions
    let next: WorkflowAction
    struct Actions: Decodable {
        let prepare: [WorkflowAction]; let perform: [WorkflowAction]; let review: [WorkflowAction]
        subscript(stage: WorkflowStage) -> [WorkflowAction] {
            switch stage { case .prepare: prepare; case .perform: perform; case .review: review }
        }
    }
    static func matchID(in path: String) -> Int? {
        let parts = path.split(separator: "/")
        guard parts.count >= 2, parts[0] == "matcher", let id = Int(parts[1]), id > 0 else { return nil }
        return id
    }
    var subtitle: String { [team, date, time ?? "", location].filter { !$0.isEmpty }.joined(separator: " · ") }
    var reviewStatus: String {
        total > 0 ? "\(evaluated) av \(total) spelare hanterade" : "Öppna matchen för uppföljning"
    }
}

struct WorkbenchView: View {
    @ObservedObject var browser: BrowserModel
    private let columns = [GridItem(.adaptive(minimum: 295), spacing: 18, alignment: .top)]
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 30) {
                VStack(alignment: .leading, spacing: 12) {
                    Text("DITT ARBETSBORD").font(.system(size: 10, weight: .semibold)).tracking(2.5).foregroundStyle(Studio.muted)
                    HStack(alignment: .firstTextBaseline) {
                        Text("Nära laget. Redo för veckan.").font(.system(size: 36, weight: .regular, design: .serif)).foregroundStyle(Studio.ink)
                        Spacer()
                        if browser.workspaceLoading { ProgressView().controlSize(.small) }
                    }
                    Text("Förbered nästa aktivitet, genomför med en tydlig plan och följ upp spelarnas utveckling.")
                        .font(.system(size: 13)).foregroundStyle(Studio.muted).fixedSize(horizontal: false, vertical: true)
                }
                if let failure = browser.workspaceError {
                    VStack(alignment: .leading, spacing: 12) {
                        Label("Arbetsbordet kunde inte uppdateras", systemImage: "wifi.exclamationmark").font(.headline)
                        Text(failure).font(.system(size: 13)).foregroundStyle(Studio.muted)
                        Button("Försök igen") { browser.refreshWorkspace() }.buttonStyle(.bordered)
                    }.padding(22).frame(maxWidth: .infinity, alignment: .leading).background(Studio.line.opacity(0.3), in: RoundedRectangle(cornerRadius: 14))
                }
                if let workspace = browser.workspace {
                    let pending = workspace.matches.filter { $0.stage == .review && $0.total > 0 && $0.evaluated < $0.total }
                    if !pending.isEmpty {
                        sectionHeading("Ta med lärdomarna vidare", subtitle: "Matcher från de senaste sju dagarna som har utvärderingar kvar.")
                        LazyVGrid(columns: columns, spacing: 18) { ForEach(pending.prefix(3)) { match in matchCard(match, review: true) } }
                    }
                    let upcoming = workspace.matches.filter { $0.stage != .review }
                    sectionHeading("Nästa på planen", subtitle: "Kommande matcher i de lag du har tillgång till.")
                    if upcoming.isEmpty {
                        emptyCard("Inga kommande matcher", detail: "Du kan fortfarande planera träning eller följa upp spelarnas utveckling.")
                    } else {
                        LazyVGrid(columns: columns, spacing: 18) { ForEach(upcoming) { match in matchCard(match) } }
                    }
                    HStack(alignment: .top, spacing: 18) {
                        if workspace.canTrain {
                            VStack(alignment: .leading, spacing: 16) {
                                Label("Nästa träning börjar här", systemImage: "figure.soccer").font(.system(size: 18, weight: .regular, design: .serif))
                                Text("Samla övningar och ritningar till ett pass som går att använda på planen.").font(.system(size: 12)).foregroundStyle(Studio.muted)
                                ForEach(workspace.training) { plan in
                                    Button { browser.open("/traning/\(plan.id)") } label: {
                                        HStack { Text(plan.title).lineLimit(1); Spacer(); Text(plan.date.isEmpty ? "Utan datum" : plan.date).foregroundStyle(Studio.muted); Image(systemName: "arrow.up.right") }
                                    }.buttonStyle(.plain).font(.system(size: 12)).padding(.vertical, 5)
                                }
                                Button("Planera träningspass") { browser.open("/traning/nytt") }.buttonStyle(.bordered)
                            }.workbenchPanel()
                        }
                        if workspace.canPlayers {
                            VStack(alignment: .leading, spacing: 16) {
                                Label("Se varje spelares nästa steg", systemImage: "leaf").font(.system(size: 18, weight: .regular, design: .serif))
                                Text("Följ utvecklingsbilden och förbered nästa samtal. Låt spelarnas fokus vägleda planeringen.").font(.system(size: 12)).foregroundStyle(Studio.muted)
                                Button("Öppna spelarutveckling") { browser.open("/utveckling") }.buttonStyle(.bordered)
                                Button("Till spelarregistret") { browser.open("/spelare") }.buttonStyle(.plain).font(.system(size: 12)).foregroundStyle(Studio.muted)
                            }.workbenchPanel()
                        }
                    }
                    HStack {
                        Text("Sparad information från lagets gemensamma databas").font(.system(size: 10)).foregroundStyle(Studio.muted)
                        Spacer()
                        Button("Alla matcher och historik") { browser.open("/matcher") }.buttonStyle(.plain).font(.system(size: 12, weight: .medium))
                    }
                } else if browser.workspaceError == nil {
                    ProgressView("Hämtar din arbetsvecka…").padding(40).frame(maxWidth: .infinity)
                }
            }.padding(36).frame(maxWidth: 1250, alignment: .leading).frame(maxWidth: .infinity)
        }.background(Studio.paper)
    }
    private func sectionHeading(_ title: String, subtitle: String) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(title).font(.system(size: 24, weight: .regular, design: .serif)).foregroundStyle(Studio.ink)
            Text(subtitle).font(.system(size: 12)).foregroundStyle(Studio.muted)
        }
    }
    private func emptyCard(_ title: String, detail: String) -> some View {
        VStack(alignment: .leading, spacing: 9) { Text(title).font(.system(size: 15, weight: .medium)); Text(detail).font(.system(size: 12)).foregroundStyle(Studio.muted) }.workbenchPanel()
    }
    private func matchCard(_ match: WorkflowMatch, review: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack {
                Label(match.stage.title, systemImage: match.stage.symbol).font(.system(size: 10, weight: .semibold)).textCase(.uppercase).tracking(1.3)
                Spacer(); Text(match.team).font(.system(size: 10)).foregroundStyle(Studio.muted)
            }.foregroundStyle(Studio.ink)
            VStack(alignment: .leading, spacing: 8) {
                Text(match.title).font(.system(size: 22, weight: .regular, design: .serif)).fixedSize(horizontal: false, vertical: true)
                Text([match.date, match.time ?? "", match.location].filter { !$0.isEmpty }.joined(separator: " · ")).font(.system(size: 11)).foregroundStyle(Studio.muted)
            }
            Rectangle().fill(Studio.line).frame(height: 1)
            if review {
                Text(match.reviewStatus).font(.system(size: 12)).foregroundStyle(Studio.muted)
                ProgressView(value: Double(match.evaluated), total: Double(max(match.total, 1))).tint(Studio.forest)
            } else {
                Label("\(match.selected) uttagna · \(match.accepted) tackat ja", systemImage: "person.2").font(.system(size: 12)).foregroundStyle(Studio.muted)
                Label(match.planSaved ? "Matchplan sparad" : "Matchplan återstår att spara", systemImage: match.planSaved ? "checkmark.circle" : "circle").font(.system(size: 12)).foregroundStyle(Studio.muted)
            }
            HStack {
                Button(match.next.title) { browser.open(match.next.path) }.buttonStyle(.borderedProminent).tint(Studio.forest)
                Spacer(minLength: 4)
                Button { browser.open("/matcher/\(match.id)") } label: { Image(systemName: "arrow.up.right") }.buttonStyle(.plain).help("Öppna matchens arbetsflöde")
            }.font(.system(size: 12))
        }.workbenchPanel()
    }
}

struct MatchWorkflowBar: View {
    @ObservedObject var browser: BrowserModel
    let match: WorkflowMatch
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .firstTextBaseline) {
                Text(match.title).font(.system(size: 22, weight: .regular, design: .serif)).lineLimit(1)
                Spacer()
                Text(match.subtitle).font(.system(size: 10)).foregroundStyle(Studio.muted).lineLimit(1)
                if browser.workspaceLoading { ProgressView().controlSize(.mini) }
            }
            HStack(spacing: 8) {
                ForEach(Array(WorkflowStage.allCases.enumerated()), id: \.element.id) { index, stage in
                    Button { browser.workflowStage = stage } label: {
                        HStack(spacing: 8) {
                            Text(String(index + 1)).font(.system(size: 10, weight: .semibold)).frame(width: 20, height: 20).background(Studio.line.opacity(0.5), in: Circle())
                            Text(stage.title).font(.system(size: 12, weight: .medium))
                        }.padding(.horizontal, 14).padding(.vertical, 8)
                            .background(browser.workflowStage == stage ? Studio.forest : .clear, in: RoundedRectangle(cornerRadius: 9))
                            .foregroundStyle(browser.workflowStage == stage ? Color.white : Studio.muted)
                    }.buttonStyle(.plain).accessibilityAddTraits(browser.workflowStage == stage ? [.isSelected] : [])
                }
                Spacer()
                Text(browser.workflowStage == .review ? match.reviewStatus : match.preparation).font(.system(size: 10)).foregroundStyle(Studio.muted).lineLimit(1)
            }
            HStack(spacing: 14) {
                Text(browser.workflowStage.detail).font(.system(size: 11)).foregroundStyle(Studio.muted)
                Spacer(minLength: 0)
                ForEach(Array(match.actions[browser.workflowStage].enumerated()), id: \.offset) { _, action in
                    Button(action.title) { browser.open(action.path) }.buttonStyle(.borderless).font(.system(size: 11, weight: .medium))
                }
            }
        }.padding(.horizontal, 28).padding(.vertical, 18).foregroundStyle(Studio.ink)
            .background(Studio.paper).overlay(alignment: .bottom) { Rectangle().fill(Studio.line).frame(height: 1) }
    }
}
private extension View {
    func workbenchPanel() -> some View {
        self.padding(23).frame(maxWidth: .infinity, alignment: .leading).foregroundStyle(Studio.ink)
            .background(Studio.line.opacity(0.16), in: RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Studio.line.opacity(0.8)))
    }
}
