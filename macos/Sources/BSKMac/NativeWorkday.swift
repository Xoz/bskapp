import SwiftUI
import WebKit

enum WorkdayRoute: Equatable, Identifiable {
    case player(Int), match(Int, String)
    var id: String { switch self { case .player(let id): "player:\(id)"; case .match(let id, let tab): "match:\(id):\(tab)" } }
    var key: Int { switch self { case .player(let id), .match(let id, _): id } }
    var kind: String { if case .player = self { "player" } else { "match" } }
    var tab: String { if case .match(_, let tab) = self { tab } else { "profile" } }
    var title: String { kind == "player" ? "Spelarprofil" : "Matcharbete" }
    static func parse(_ url: URL) -> Self? {
        let p = url.path.split(separator: "/")
        guard p.count >= 2, let id = Int(p[1]), id > 0 else { return nil }
        if p[0] == "spelare", p.count == 2 || (p.count == 3 && p[2] == "utveckling") { return .player(id) }
        if p[0] == "matcher" {
            if p.count == 2 { return .match(id, url.fragment == "trupp" ? "squad" : "plan") }
            if p.count == 3, p[2] == "laguttagning" { return .match(id,"selection") }
            if p.count == 3, p[2] == "utvardera" { return .match(id,"evaluation") }
        }
        return nil
    }
}
struct WorkdayProfile: Decodable {
    let scope, fetchedAt: String
    let profile: Player
    let development: Development
    let checkpoints: [Checkpoint]
    let conversations: [Conversation]
    let canEdit: Bool
    struct Player: Decodable { let id:Int;let name:String;let jerseyNumber:Int?;let position:String;let teamNames:[String];let stats:Stats;let matchHistory:[MatchHistory]
        struct Stats:Decodable{let trainingCount,matchCount,callupCount:Int}
        struct MatchHistory:Decodable,Identifiable{let id,date,opponent,sourceTeam:String}
    }
    struct Development:Decodable{let doneCount,activeCount,totalCount:Int;let categories:[Category]
        struct Category:Decodable,Identifiable{let id,name:String;let skills:[Skill]}
        struct Skill:Decodable,Identifiable{let id,title,criterion,advice,status:String;let level:Int;let isFocus:Bool}
    }
    struct Checkpoint:Decodable,Identifiable{let id,date,coach_name,strengths,focus_note,wellbeing_note:String;let changed_count:Int}
    struct Conversation:Decodable,Identifiable{let id,conversation_date,coach_name,coach_summary,player_perspective,agreed_actions:String;let follow_up_on:String?}
}
struct NativeMatchPlan: Codable, Equatable {
    var formation:String
    var spots:[Spot]
    var ideas:[String:String]
    struct Spot:Codable,Equatable{
        var playerId:Int?;var x,y:Double
        enum CodingKeys:String,CodingKey{case playerId,x,y}
        func encode(to encoder:Encoder)throws{var c=encoder.container(keyedBy:CodingKeys.self);if let playerId{try c.encode(playerId,forKey:.playerId)}else{try c.encodeNil(forKey:.playerId)};try c.encode(x,forKey:.x);try c.encode(y,forKey:.y)}
    }
}
struct WorkdayMatch: Codable {
    let scope,fetchedAt,version:String
    let versions:[String:String]?
    let match:Match
    let candidates:[Candidate]
    let roster:[Roster]
    let plan:Plan
    let evaluation:Evaluation?
    let formations:[Formation]
    let ideaFields:[IdeaField]
    let canSelect,canPlan,canEvaluate:Bool
    struct Match:Codable{let id:Int;let opponent,date,home_away,location,level,formation:String;let start_time:String?;let finished,cancelled:Int;let our_score,opponent_score:Int?}
    struct Candidate:Codable,Identifiable{let id:Int;let name,position,reply:String;let selected:Bool}
    struct Roster:Codable,Identifiable{let player_id:Int;let name,selected_position:String;let selection_status,callup_status:String?;var id:Int{player_id}}
    struct Plan:Codable{let revision:Int;let document:NativeMatchPlan}
    struct Formation:Codable,Identifiable{let id,label:String;let slots:[Slot];struct Slot:Codable{let role:String;let x,y:Double}}
    struct IdeaField:Codable,Identifiable{let key,label,placeholder:String;var id:String{key}}
    struct Evaluation:Codable{let match:MatchContext;let players:[Player]
        struct MatchContext:Codable{let ourScore,opponentScore:Int?;let hasLiveData:Bool;let coachComment:String}
        struct Player:Codable,Identifiable{let id:Int;let name:String;let rating:Int?;let ratingComment:String?;let skipped:Bool;let selfComparison,matchImpact:String?;let reasonTag:String?}
    }
}
@MainActor
final class WorkdaySession: ObservableObject {
    let route:WorkdayRoute
    @Published var profile:WorkdayProfile?
    @Published var match:WorkdayMatch?
    @Published var tab:String
    @Published var plan:NativeMatchPlan?
    @Published var selected:Set<Int> = []
    @Published var positions:[Int:String] = [:]
    @Published var ratings:[Int:Int] = [:]
    @Published var comments:[Int:String] = [:]
    @Published var skipped:Set<Int> = []
    @Published var coachComment = ""
    @Published var ourScore = ""
    @Published var opponentScore = ""
    @Published var acknowledged = false
    @Published var busy = false
    @Published var error:String?
    @Published var notice:String?
    @Published var conflict:WorkdayMatch?
    @Published var uncertain = false
    @Published var queued = false
    @Published var fetchedAt:Date?
    struct EditState:Equatable {
        var plan:NativeMatchPlan?;var selected:Set<Int>;var positions:[Int:String];var ratings:[Int:Int];var comments:[Int:String];var skipped:Set<Int>
        var coachComment,ourScore,opponentScore:String;var acknowledged:Bool
    }
    var editState:EditState{EditState(plan:plan,selected:selected,positions:positions,ratings:ratings,comments:comments,skipped:skipped,coachComment:coachComment,ourScore:ourScore,opponentScore:opponentScore,acknowledged:acknowledged)}
    private var history:[EditState]=[]
    private var cursor=0
    var canUndo:Bool{!locked && cursor>0}
    var canRedo:Bool{!locked && cursor<history.count-1}
    func resetHistory(){history=[editState];cursor=0}
    func rememberEdit(){guard !locked,match != nil else{return};if history.isEmpty{resetHistory();return};guard history[cursor] != editState else{return};history=Array(history.prefix(cursor+1));history.append(editState);if history.count>100{history.removeFirst()};cursor=history.count-1}
    private func restoreEdit(_ state:EditState){plan=state.plan;selected=state.selected;positions=state.positions;ratings=state.ratings;comments=state.comments;skipped=state.skipped;coachComment=state.coachComment;ourScore=state.ourScore;opponentScore=state.opponentScore;acknowledged=state.acknowledged}
    func undo(){guard canUndo else{return};cursor-=1;restoreEdit(history[cursor])}
    func redo(){guard canRedo else{return};cursor+=1;restoreEdit(history[cursor])}
    private var generation=UUID()
    private var baseline:Data?
    private var pending:Data?
    private var commandID=UUID().uuidString
    var dirty:Bool { !queued && baseline != nil && (pending != nil || payload() != baseline) }
    var locked:Bool { busy || uncertain || queued }
    init(_ route:WorkdayRoute){self.route=route;tab=route.tab}
    private struct Draft:Codable{let match:WorkdayMatch;let payload:Data;let tab:String;let queued:Bool;let created:Date}
    var draftIdentity:String?{draftKey}
    private var draftKey:String?{match.map{$0.scope+":"+route.kind+":"+String(route.key)+":"+tab}}
    func clearDraft(){if let key=draftKey{OfflineStore.shared.clearDraft(key)}}
    func storeDraft(){guard let match,let key=draftKey,let data=pending ?? payload() else{return};if !dirty && !queued{clearDraft();return};if let draft=try? JSONEncoder().encode(Draft(match:match,payload:data,tab:tab,queued:queued,created:Date())){try? OfflineStore.shared.saveDraft(draft,id:key)}}
    func invalidate(){generation=UUID();profile=nil;match=nil;plan=nil;positions=[:];comments=[:];ratings=[:];coachComment="";baseline=nil;pending=nil}
    func load(_ browser:BrowserModel) async {
        let token=UUID();generation=token;busy=true;error=nil
        do {
            let data=try await browser.workdayRequest("?kind=\(route.kind)&id=\(route.key)")
            guard generation==token,browser.signedIn else{return}
            if route.kind=="player" {profile=try JSONDecoder().decode(WorkdayProfile.self,from:data)}
            else {apply(try JSONDecoder().decode(WorkdayMatch.self,from:data));restoreDraft()}
            let formatter=ISO8601DateFormatter();formatter.formatOptions=[.withInternetDateTime,.withFractionalSeconds];let stamp=profile?.fetchedAt ?? match?.fetchedAt ?? "";fetchedAt=formatter.date(from:stamp) ?? ISO8601DateFormatter().date(from:stamp);resetHistory();if !queued{notice=nil}
        }catch{if generation==token{self.error=error.localizedDescription}}
        if generation==token{busy=false}
    }
    private func apply(_ value:WorkdayMatch){
        notice=nil;match=value;plan=value.plan.document
        selected=Set(value.candidates.filter(\.selected).map(\.id))
        positions=Dictionary(uniqueKeysWithValues:value.candidates.map{p in (p.id,value.roster.first(where:{$0.player_id==p.id})?.selected_position ?? p.position)})
        if let e=value.evaluation{skipped=Set(e.players.filter(\.skipped).map(\.id));ratings=Dictionary(uniqueKeysWithValues:e.players.compactMap{p in p.rating.map{(p.id,$0)}});comments=Dictionary(uniqueKeysWithValues:e.players.map{($0.id,$0.ratingComment ?? "")});coachComment=e.match.coachComment;ourScore=e.match.ourScore.map(String.init) ?? "";opponentScore=e.match.opponentScore.map(String.init) ?? ""}
        pending=nil;uncertain=false;queued=false;conflict=nil;commandID=UUID().uuidString;baseline=payload()
    }
    private func restoreDraft(){
        guard let key=draftKey,let data=OfflineStore.shared.draft(key),let draft=try? JSONDecoder().decode(Draft.self,from:data),Date().timeIntervalSince(draft.created)<7*86400,let b=try? JSONSerialization.jsonObject(with:draft.payload) as? [String:Any],draft.match.scope==match?.scope else{return}
        match=draft.match;tab=draft.tab;commandID=b["commandId"] as? String ?? commandID
        if tab=="selection",let players=b["players"] as? [[String:Any]]{selected=Set(players.compactMap{$0["playerId"] as? Int});positions=Dictionary(uniqueKeysWithValues:players.compactMap{p in guard let id=p["playerId"] as? Int,let position=p["position"] as? String else{return nil};return(id,position)});acknowledged=b["acknowledged"] as? Bool ?? false}
        else if tab=="evaluation"{if let answers=b["answers"] as? [[String:Any]]{skipped=Set(answers.filter{$0["skipped"] as? Bool == true}.compactMap{$0["playerId"] as? Int});ratings=Dictionary(uniqueKeysWithValues:answers.compactMap{a in guard let id=a["playerId"] as? Int,let rating=a["rating"] as? Int else{return nil};return(id,rating)});comments=Dictionary(uniqueKeysWithValues:answers.compactMap{a in guard let id=a["playerId"] as? Int,let comment=a["ratingComment"] as? String else{return nil};return(id,comment)})};if let c=b["context"] as? [String:Any]{coachComment=c["coachComment"] as? String ?? "";ourScore=(c["ourScore"] as? Int).map(String.init) ?? "";opponentScore=(c["opponentScore"] as? Int).map(String.init) ?? ""}}
        else if let document=b["document"],let data=try? JSONSerialization.data(withJSONObject:document){plan=try? JSONDecoder().decode(NativeMatchPlan.self,from:data)}
        queued=OfflineStore.shared.pending.contains{$0.body==draft.payload};pending=queued ? draft.payload:nil;notice=queued ? "Sparat på denna Mac. Väntar på synk.":"Ditt lokala utkast är återställt."
    }
    func payload() -> Data? {
        guard let match else{return nil}
        var b:[String:Any]=["matchId":route.key,"version":match.versions?[tab == "selection" ? "selection":tab == "evaluation" ? "evaluation":"plan"] ?? match.version,"commandId":commandID]
        if tab=="selection" {b["kind"]="selection";b["players"]=selected.sorted().map{["playerId":$0,"position":positions[$0] ?? ""] as [String:Any]};b["acknowledged"]=acknowledged}
        else if tab=="evaluation" {
            b["kind"]="evaluation"
            b["answers"]=match.evaluation?.players.map{p -> [String:Any] in
                var answer:[String:Any]=["playerId":p.id,"ratingComment":comments[p.id] ?? "","selfComparison":p.selfComparison as Any? ?? NSNull(),"matchImpact":p.matchImpact as Any? ?? NSNull(),"reasonTag":p.reasonTag ?? "","skipped":skipped.contains(p.id)]
                if ratings[p.id] != nil || p.rating != nil || skipped.contains(p.id){answer["rating"]=ratings[p.id] as Any? ?? NSNull()}
                return answer
            } ?? []
            b["context"]=["ourScore":Int(ourScore) as Any? ?? NSNull(),"opponentScore":Int(opponentScore) as Any? ?? NSNull(),"coachComment":coachComment]
        } else {b["kind"]="plan";b["revision"]=match.plan.revision;guard let plan,let data=try? JSONEncoder().encode(plan),let document=try? JSONSerialization.jsonObject(with:data) else{return nil};b["document"]=document}
        return try? JSONSerialization.data(withJSONObject:b,options:[.sortedKeys])
    }
    func changeTab(_ value:String){guard !dirty,!busy else{notice="Spara eller lämna utkastet innan du byter steg.";return};storeDraft();tab=value;if let match{apply(match);restoreDraft()};resetHistory()}
    func save(_ browser:BrowserModel) async {
        guard !busy,let body=pending ?? payload() else{return}
        if tab=="evaluation",(!ourScore.isEmpty && Int(ourScore)==nil || !opponentScore.isEmpty && Int(opponentScore)==nil){error="Ange heltal i båda resultatfälten eller lämna båda tomma.";return}
        let token=generation;busy=true;error=nil;pending=body
        do {
            let result=try await browser.workdayRequest("",body:body)
            guard token==generation,browser.signedIn else{return}
            if let value=try? JSONDecoder().decode(NativeSaveResult.self,from:result),value.queued==true{queued=true;uncertain=false;notice="Sparat på denna Mac. Väntar på synk.";busy=false;storeDraft();return}
            guard token==generation else{return}
            pending=nil;uncertain=false;clearDraft();baseline=payload();notice="Sparat i lagets databas"
            await load(browser);notice="Sparat i lagets databas"
        }catch{
            guard token==generation else{return}
            self.error=error.localizedDescription
            let status=(error as? NativeAPIError)?.status;uncertain=status==nil || (status ?? 0)>=500
            if !uncertain{pending=nil}
            if status==409 {
                do{let store=OfflineStore.shared;try store.enqueue(endpoint:"workday",body:body,title:"Matcharbete",draftId:draftIdentity);if let id=(try? JSONSerialization.jsonObject(with:body) as? [String:Any])?["commandId"] as? String{try store.mark(id,error:error.localizedDescription,conflict:true)};queued=true;pending=body;storeDraft();notice="Utkastet är bevarat. Öppna Synk för att jämföra och välja vad du vill behålla."}catch{notice="Ditt utkast finns kvar i formuläret. \(error.localizedDescription)"}
            }
        }
        if generation==token{busy=false}
    }
}
extension BrowserModel {
    func workdayRequest(_ query:String,body:Data?=nil) async throws -> Data {try await desktopRequest(query,body:body,endpoint:"workday")}
}
struct NativeWorkdayView:View{
    @ObservedObject var browser:BrowserModel
    @ObservedObject var session:WorkdaySession
    var body:some View{
        VStack(spacing:0){
            HStack{
                Button("Till översikten"){browser.open(browser.workdayReturnPath ?? (session.route.kind=="player" ? "/utveckling":"/matcher"))}
                Text(session.route.title).font(.system(size:15,design:.default));Spacer()
                if let date=session.fetchedAt {Text("Hämtat \(date.formatted(date:.omitted,time:.shortened))").font(.caption).foregroundStyle(Studio.muted)}
                if session.dirty{Text("Lokalt utkast").font(.caption)}
                if session.match != nil,session.tab != "squad"{Button{session.undo()}label:{Image(systemName:"arrow.uturn.backward")}.disabled(!session.canUndo).keyboardShortcut("z").help("Ångra ändring");Button{session.redo()}label:{Image(systemName:"arrow.uturn.forward")}.disabled(!session.canRedo).keyboardShortcut("z",modifiers:[.command,.shift]).help("Gör om ändring");Button(session.uncertain ? "Försök igen":"Spara"){Task{await session.save(browser)}}.keyboardShortcut("s").disabled(session.busy || session.queued || !session.dirty)}
            }.padding(.horizontal,16).padding(.vertical,10)
            Divider()
            if let error=session.error{HStack{Text(error);Spacer();Button("Försök igen"){Task{await session.load(browser)}}.disabled(session.dirty)}.font(.callout).padding(14).background(Studio.accent.opacity(0.2))}
            if let notice=session.notice{HStack{Text(notice);if session.queued{Button("Granska synk"){OfflineStore.shared.panel=true}}}.font(.callout).padding(10)}
            if let fresh=session.conflict{WorkdayConflictView(session:session,fresh:fresh,browser:browser)}
            if let profile=session.profile{NativePlayerProfile(browser:browser,data:profile,initialTab:browser.profileInitialTab)}
            else if let match=session.match{NativeMatchWorkspace(browser:browser,session:session,data:match)}
            else if session.busy{ProgressView("Hämtar underlaget…").frame(maxWidth:.infinity,maxHeight:.infinity)}
            else{ContentUnavailableView("Underlaget är inte tillgängligt",systemImage:"wifi.exclamationmark",description:Text("Försök igen när du är ansluten."))}
        }.background(Studio.paper).foregroundStyle(Studio.ink).task{await session.load(browser)}
            .onChange(of:session.editState){_,_ in session.rememberEdit();session.storeDraft()}
    }
}
struct WorkdayConflictView:View{
    @ObservedObject var session:WorkdaySession
    let fresh:WorkdayMatch
    @ObservedObject var browser:BrowserModel
    var body:some View{VStack(alignment:.leading,spacing:10){Text("Någon har ändrat matchunderlaget").font(.headline);Text("Ditt utkast finns kvar. Senaste laguppställningen har \(fresh.candidates.filter(\.selected).count) uttagna och matchplan revision \(fresh.plan.revision). Kopiera det du vill behålla innan du hämtar senaste versionen.").textSelection(.enabled);Button("Hämta senaste versionen…"){browser.reload()}}.font(.callout).padding(18).frame(maxWidth:.infinity,alignment:.leading).background(Studio.accent.opacity(0.15))}
}
