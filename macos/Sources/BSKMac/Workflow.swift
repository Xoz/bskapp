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
    @ObservedObject var browser:BrowserModel
    @State private var selected:Int?
    private var reviewing:Bool { browser.currentPath=="/uppfoljning" }
    private var matches:[WorkflowMatch] { (browser.workspace?.matches ?? []).filter{reviewing ? $0.stage == .review:$0.stage != .review} }
    var body:some View {
        HSplitView {
            VStack(spacing:0) {
                HStack { Text(reviewing ? "Senaste matcher":"Kommande matcher").font(.headline); Spacer(); if browser.workspaceLoading{ProgressView().controlSize(.mini)} }.padding(16)
                Divider()
                List(selection:$selected) {
                    ForEach(matches){match in
                        VStack(alignment:.leading,spacing:5) {
                            Text(match.title).fontWeight(.medium)
                            Text([match.date,match.team].joined(separator:" · ")).font(.caption).foregroundStyle(Studio.muted)
                            if reviewing {Text(match.reviewStatus).font(.caption).foregroundStyle(Studio.muted)}
                        }.padding(.vertical,5).tag(match.id)
                    }
                }.listStyle(.inset).scrollContentBackground(.hidden)
                if matches.isEmpty { Text(reviewing ? "Inga matcher från de senaste sju dagarna.":"Inga kommande matcher.").font(.callout).foregroundStyle(Studio.muted).padding() }
                Divider()
                Button("Alla matcher"){browser.open("/matcher")}.buttonStyle(.borderless).padding(12)
            }.frame(minWidth:240,idealWidth:285,maxWidth:360).background(Studio.surface)
            ScrollView {
                VStack(alignment:.leading,spacing:24) {
                    HStack { Text(reviewing ? "Uppföljning":"Förberedelser").font(.title2).fontWeight(.semibold); Spacer() }
                    if let error=browser.workspaceError { Label(error,systemImage:"wifi.exclamationmark").font(.callout);Button("Försök igen"){browser.refreshWorkspace()} }
                    if let match=matches.first(where:{$0.id==selected}) {
                        VStack(alignment:.leading,spacing:12) {
                            Text(match.title).font(.title3).fontWeight(.semibold)
                            Text(match.subtitle).font(.callout).foregroundStyle(Studio.muted)
                            Divider()
                            if reviewing {
                                Label(match.reviewStatus,systemImage:"checklist")
                                ProgressView(value:Double(match.evaluated),total:Double(max(match.total,1))).tint(Studio.accent)
                                Button("Öppna utvärdering"){browser.open("/matcher/\(match.id)/utvardera")}
                            } else {
                                LabeledContent("Laguppställning",value:"\(match.selected) uttagna")
                                LabeledContent("Ja-svar",value:"\(match.accepted) spelare")
                                LabeledContent("Matchplan",value:match.planSaved ? "Sparad":"Återstår")
                                HStack { Button("Laguppställning"){browser.open("/matcher/\(match.id)/laguttagning")};Button("Matchplan"){browser.open("/matcher/\(match.id)")} }
                            }
                        }.editorPanel()
                    } else {
                        Label(reviewing ? "Välj en match för att utvärdera och följa upp.":"Välj en match för att förbereda laget och matchplanen.",systemImage:reviewing ? "checklist":"rectangle.stack").foregroundStyle(Studio.muted).font(.callout)
                    }
                    if reviewing { followup } else { preparation }
                }.padding(24).frame(maxWidth:880,alignment:.leading).frame(maxWidth:.infinity)
            }.frame(minWidth:360)
        }.background(Studio.paper).onAppear{selected=matches.first?.id}.onChange(of:matches.map(\.id)){_,ids in if !ids.contains(selected ?? -1){selected=ids.first}}
    }
    private var preparation:some View {
        VStack(alignment:.leading,spacing:18) {
            if browser.practice?.canTrain == true {
                HStack { Text("Träningsplanering").font(.headline);Spacer();Button("Nytt pass",systemImage:"plus"){browser.open("/traning/nytt")} }
                if let plans=browser.practice?.plans, !plans.isEmpty {
                    ForEach(plans.prefix(5)){plan in
                        Button{browser.open("/traning/\(plan.id)")}label:{HStack{VStack(alignment:.leading,spacing:4){Text(plan.title);Text("\(plan.date.isEmpty ? "Utan datum":plan.date) · \(plan.duration) min").font(.caption).foregroundStyle(Studio.muted)};Spacer();Image(systemName:"chevron.right")}}.buttonStyle(.plain).padding(.vertical,7)
                        Divider()
                    }
                } else {Text("Skapa ett pass eller välj övningar i träningsbiblioteket.").font(.callout).foregroundStyle(Studio.muted)}
                Button("Öppna träningspass"){browser.open("/traning")}.buttonStyle(.borderless)
            }
            if browser.practice?.canPlayers == true {
                Divider();Text("Inför spelarsamtalet").font(.headline)
                Text("Läs utvecklingsbilden och tidigare överenskommelser innan ni träffas.").font(.callout).foregroundStyle(Studio.muted)
                Button("Välj spelare för samtal"){browser.open("/samtal")}
            }
            Divider()
            HStack { Label("Offlineunderlag",systemImage:"arrow.down.circle");Spacer();Button("Granska nedladdning och synk"){OfflineStore.shared.panel=true} }.font(.callout)
        }
    }
    private var followup:some View {
        VStack(alignment:.leading,spacing:16) {
            Text("Spelarnas nästa steg").font(.headline)
            if let practice=browser.practice,practice.canPrivate {
                let due=practice.players.filter{$0.followup.map{$0<=practice.today} ?? false}
                if due.isEmpty {Text("Inga samtalsuppföljningar har förfallit.").font(.callout).foregroundStyle(Studio.muted)}
                ForEach(due){player in
                    HStack {VStack(alignment:.leading,spacing:4){Text(player.name);Text("Följ upp \(player.followup ?? "")").font(.caption).foregroundStyle(Studio.muted)};Spacer();Button("Visa samtal"){browser.open("/spelare/\(player.id)?omrade=samtal")}}
                    Divider()
                }
            }
            HStack {Button("Gör en avstämning"){browser.open("/utveckling")};Button("Spelarsamtal"){browser.open("/samtal")}}
            Text("Efter träningen: stäm av de färdigheter du har underlag för och välj nästa fokus.").font(.callout).foregroundStyle(Studio.muted)
        }
    }
}

struct MatchWorkflowBar: View {
    @ObservedObject var browser: BrowserModel
    let match: WorkflowMatch
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .firstTextBaseline) {
                Text(match.title).font(.system(size: 22, weight: .regular, design: .default)).lineLimit(1)
                Spacer()
                Text(match.subtitle).font(.system(size: 10)).foregroundStyle(Studio.muted).lineLimit(1)
                if browser.workspaceLoading { ProgressView().controlSize(.mini) }
            }
            HStack(spacing: 8) {
                ForEach(Array(WorkflowStage.allCases.enumerated()), id: \.element.id) { index, stage in
                    Button { browser.chooseWorkflowStage(stage) } label: {
                        HStack(spacing: 8) {
                            Text(String(index + 1)).font(.system(size: 10, weight: .semibold)).frame(width: 20, height: 20).background(Studio.line.opacity(0.5), in: Circle())
                            Text(stage.title).font(.system(size: 12, weight: .medium))
                        }.padding(.horizontal, 14).padding(.vertical, 8)
                            .background(browser.workflowStage == stage ? Studio.control : .clear, in: RoundedRectangle(cornerRadius: 9))
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
