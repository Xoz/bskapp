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

struct PracticeView:View {
    @ObservedObject var browser:BrowserModel
    @State private var search=""
    @State private var player:Int?
    @State private var plan:String?
    private var training:Bool {browser.currentPath=="/traning"}
    private var conversations:Bool {browser.currentPath=="/samtal"}
    private var players:[DevelopmentPlayer] {(browser.practice?.players ?? []).filter{search.isEmpty || $0.name.localizedCaseInsensitiveContains(search)}}
    private var plans:[PracticePlan] {(browser.practice?.plans ?? []).filter{search.isEmpty || $0.title.localizedCaseInsensitiveContains(search)}}
    var body:some View {
        HSplitView {
            VStack(spacing:0) {
                HStack {Text(training ? "Träningspass":conversations ? "Spelarsamtal":"Spelare").font(.headline);Spacer();if browser.practiceLoading{ProgressView().controlSize(.mini)}}.padding(16)
                TextField(training ? "Sök pass":"Sök spelare",text:$search).textFieldStyle(.roundedBorder).padding(.horizontal,12).padding(.bottom,12)
                Divider()
                if training {
                    List(selection:$plan){ForEach(plans){p in VStack(alignment:.leading,spacing:5){Text(p.title).fontWeight(.medium);Text("\(p.date.isEmpty ? "Utan datum":p.date) · \(p.duration) min").font(.caption).foregroundStyle(Studio.muted)}.padding(.vertical,5).tag(p.id)}}.listStyle(.inset).scrollContentBackground(.hidden)
                } else {
                    List(selection:$player){ForEach(players){p in VStack(alignment:.leading,spacing:5){Text(p.name).fontWeight(.medium);if browser.practice?.canPrivate==true {Text(conversations ? "Samtal: \(p.conversation ?? "Inte registrerat")":"Avstämning: \(p.checkpoint ?? "Inte registrerat")").font(.caption).foregroundStyle(Studio.muted);if let date=p.followup,conversations{Text("Följ upp \(date)").font(.caption).foregroundStyle(Studio.muted)}}}.padding(.vertical,5).tag(p.id)}}.listStyle(.inset).scrollContentBackground(.hidden)
                }
                Divider()
                HStack {Text("\(training ? plans.count:players.count) \(training ? "pass":"spelare")").font(.caption).foregroundStyle(Studio.muted);Spacer();if training{Button("Nytt pass",systemImage:"plus"){browser.open("/traning/nytt")}}}.padding(12)
            }.frame(minWidth:235,idealWidth:270,maxWidth:340).background(Studio.surface)
            Group {
                if let error=browser.practiceError {ContentUnavailableView("Underlaget kunde inte hämtas",systemImage:"wifi.exclamationmark",description:Text(error))}
                else if training { trainingDetail }
                else if let player,players.contains(where:{$0.id==player}) { NativePlayerInspector(browser:browser,playerID:player,initialTab:conversations ? "conversations":"development").id("\(player):\(conversations)") }
                else {ContentUnavailableView(search.isEmpty ? "Välj en spelare":"Inga spelare matchar sökningen",systemImage:conversations ? "bubble.left.and.bubble.right":"person",description:Text(conversations ? "Utvecklingsbild, tidigare samtal och nästa överenskommelse.":"Läs utvecklingen och gör en avstämning."))}
            }.frame(minWidth:380,maxWidth:.infinity,maxHeight:.infinity)
        }.background(Studio.paper).foregroundStyle(Studio.ink)
        .onAppear{player=players.first(where:{$0.id==browser.selectedPlayerID})?.id ?? players.first?.id;plan=plans.first(where:{$0.id==browser.selectedTrainingID})?.id ?? plans.first?.id}
        .onChange(of:player){_,id in browser.selectedPlayerID=id}
        .onChange(of:plan){_,id in browser.selectedTrainingID=id}
        .onChange(of:players.map(\.id)){_,ids in if !ids.contains(player ?? -1){player=ids.first}}
        .onChange(of:plans.map(\.id)){_,ids in if !ids.contains(plan ?? ""){plan=ids.first}}
    }
    @ViewBuilder private var trainingDetail:some View {
        if let p=plans.first(where:{$0.id==plan}) {
            ScrollView {VStack(alignment:.leading,spacing:20){
                HStack {VStack(alignment:.leading,spacing:6){Text(p.title).font(.title2).fontWeight(.semibold);Text("\(p.date.isEmpty ? "Utan datum":p.date) · \(p.duration) min · \(p.countLabel)").font(.callout).foregroundStyle(Studio.muted)};Spacer();Button("Redigera pass"){browser.open("/traning/\(p.id)")}}
                Divider()
                Text("Passöversikt").font(.headline)
                ForEach(Array(p.blocks.enumerated()),id:\.element.id){index,b in HStack(alignment:.top,spacing:14){Text("\(index+1)").monospacedDigit().foregroundStyle(Studio.muted).frame(width:20);VStack(alignment:.leading,spacing:8){HStack{Text(b.title).fontWeight(.medium);Spacer();Text("\(b.minutes) min").foregroundStyle(Studio.muted)};if !b.notes.isEmpty{Text(b.notes).font(.callout).foregroundStyle(Studio.muted).textSelection(.enabled)}}}.padding(.vertical,8);Divider()}
                if p.blocks.isEmpty{Text("Passet saknar övningar. Öppna redigeraren för att lägga till dem.").foregroundStyle(Studio.muted)}
                if browser.practice?.canPlayers==true{Button("Följ upp spelarnas utveckling"){browser.open("/utveckling")}.buttonStyle(.borderless)}
            }.padding(24).frame(maxWidth:900,alignment:.leading).frame(maxWidth:.infinity)}
        } else {ContentUnavailableView("Dina träningspass",systemImage:"rectangle.stack",description:Text("Skapa ett nytt pass eller välj ett sparat pass för att granska och redigera."))}
    }
}

struct NativePlayerInspector:View {
    @ObservedObject var browser:BrowserModel
    @StateObject private var session:WorkdaySession
    let initialTab:String
    init(browser:BrowserModel,playerID:Int,initialTab:String){self.browser=browser;self.initialTab=initialTab;_session=StateObject(wrappedValue:WorkdaySession(.player(playerID)))}
    var body:some View {
        VStack(spacing:0) {
            if let profile=session.profile{NativePlayerProfile(browser:browser,data:profile,initialTab:initialTab)}
            else if let error=session.error{VStack(spacing:14){ContentUnavailableView("Underlaget är inte tillgängligt",systemImage:"wifi.exclamationmark",description:Text(error));Button("Försök igen"){Task{await session.load(browser)}}}}
            else{ProgressView("Hämtar spelarunderlag…")}
        }.frame(maxWidth:.infinity,maxHeight:.infinity).task(id:browser.practiceRevision){await session.load(browser)}
    }
}

struct PracticeWorkflowBar:View {
    @ObservedObject var browser:BrowserModel
    var body:some View {EmptyView()}
}
