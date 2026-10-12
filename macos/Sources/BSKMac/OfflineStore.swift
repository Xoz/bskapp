import Foundation
import CryptoKit
import SwiftUI

@MainActor
final class OfflineStore:ObservableObject {
    static let shared:OfflineStore = {
        #if DEBUG
        if CommandLine.arguments.first?.contains(".xctest") == true{return OfflineStore(root:FileManager.default.temporaryDirectory.appendingPathComponent("BSKOfflineTests-\(ProcessInfo.processInfo.processIdentifier)"))}
        #endif
        let identity=(Bundle.main.bundleIdentifier ?? "se.bsk2014.mac")+":"+BrowserModel.baseURL.absoluteString
        let namespace=SHA256.hash(data:Data(identity.utf8)).map{String(format:"%02x",$0)}.joined()
        let root=FileManager.default.urls(for:.applicationSupportDirectory,in:.userDomainMask)[0].appendingPathComponent("BSKOffline").appendingPathComponent(namespace,isDirectory:true)
        return OfflineStore(root:root)
    }()
    struct Session:Codable{let scope,name:String;let paths:[String];let verified:Date}
    struct Entry:Codable{let scope,path:String;let data:Data;let fetched:Date}
    struct Command:Codable,Identifiable{let id,scope,endpoint,title:String;let body:Data;let created:Date;let draftId:String?;var error:String?;var conflict:Bool;var status:Int? = nil}
    @Published private(set) var session:Session?
    @Published private(set) var queue:[Command]=[]
    @Published var offline=false
    @Published var manualOffline=false
    @Published var syncing=false
    @Published var message:String?
    @Published var panel=false
    private let root:URL
    private let key:SymmetricKey
    private let keyReady:Bool
    init(root:URL?=nil) {
        let base=root ?? FileManager.default.urls(for:.applicationSupportDirectory,in:.userDomainMask)[0].appendingPathComponent("BSKOffline",isDirectory:true)
        self.root=base
        try? FileManager.default.createDirectory(at:base,withIntermediateDirectories:true,attributes:[.posixPermissions:0o700])
        let keyURL=base.appendingPathComponent("device.key")
        if let data=try? Data(contentsOf:keyURL),data.count==32{key=SymmetricKey(data:data);keyReady=true}
        else{let generated=SymmetricKey(size:.bits256);key=generated;let data=generated.withUnsafeBytes{Data($0)};do{try data.write(to:keyURL,options:.atomic);try FileManager.default.setAttributes([.posixPermissions:0o600],ofItemAtPath:keyURL.path);keyReady=true}catch{keyReady=false}}
        session=read("session",as:Session.self)
        queue=read("queue",as:[Command].self) ?? []
    }
    private func url(_ id:String)->URL {root.appendingPathComponent(SHA256.hash(data:Data(id.utf8)).map{String(format:"%02x",$0)}.joined()+".sealed")}
    private func read<T:Decodable>(_ id:String,as:T.Type)->T? {
        guard let data=try? Data(contentsOf:url(id)),let box=try? AES.GCM.SealedBox(combined:data),let plain=try? AES.GCM.open(box,using:key) else{return nil}
        return try? JSONDecoder().decode(T.self,from:plain)
    }
    private func write<T:Encodable>(_ value:T,_ id:String) throws {
        guard keyReady else{throw NativeAPIError(message:"Kunde inte skapa beständig krypterad lagring. Kontrollera att det finns ledigt utrymme på denna Mac.")}
        let data=try JSONEncoder().encode(value)
        guard let sealed=try AES.GCM.seal(data,using:key).combined else{throw CocoaError(.fileWriteUnknown)}
        let destination=url(id);try sealed.write(to:destination,options:.atomic);try FileManager.default.setAttributes([.posixPermissions:0o600],ofItemAtPath:destination.path)
    }
    func draft(_ id:String)->Data?{read("draft:"+id,as:Data.self)}
    func saveDraft(_ data:Data,id:String) throws{try write(data,"draft:"+id)}
    func clearDraft(_ id:String){try? FileManager.default.removeItem(at:url("draft:"+id))}
    func authenticate(scope:String,name:String,paths:Set<String>) throws {
        let value=Session(scope:scope,name:name,paths:Array(paths),verified:Date())
        try write(value,"session");session=value;offline=false
    }
    func lock(){session=nil;offline=false;try? FileManager.default.removeItem(at:url("session"))}
    var canResume:Bool {guard let session else{return false};return (0..<7*86400).contains(Date().timeIntervalSince(session.verified))}
    var pending:[Command]{queue.filter{$0.scope==session?.scope}}
    func cache(path:String,data:Data) throws {
        guard let session else{return}
        try write(Entry(scope:session.scope,path:path,data:data,fetched:Date()),session.scope+":"+path)
    }
    func cached(_ path:String)->Entry? {
        guard canResume,let session,let entry=read(session.scope+":"+path,as:Entry.self),entry.scope==session.scope,Date().timeIntervalSince(entry.fetched)<7*86400 else{return nil}
        return entry
    }
    func enqueue(endpoint:String,body:Data,title:String,draftId:String?=nil) throws {
        guard canResume,let session else{throw NativeAPIError(message:"Ladda ned underlag medan du är inloggad innan du arbetar offline.")}
        let object=try JSONSerialization.jsonObject(with:body) as? [String:Any]
        let id=(object?["commandId"] as? String) ?? SHA256.hash(data:body).map{String(format:"%02x",$0)}.joined()
        if let prior=queue.first(where:{$0.scope==session.scope && $0.id==id}){guard prior.body==body else{throw NativeAPIError(message:"Sparförsöket finns redan med annat innehåll.")};return}
        var next=queue;next.append(Command(id:id,scope:session.scope,endpoint:endpoint,title:title,body:body,created:Date(),draftId:draftId,error:nil,conflict:false));try write(next,"queue");queue=next
    }
    func replace(_ id:String,body:Data) throws{guard let session,let index=queue.firstIndex(where:{$0.id==id && $0.scope==session.scope}) else{return};var next=queue;let old=next[index];let object=try JSONSerialization.jsonObject(with:body) as? [String:Any];let newId=object?["commandId"] as? String ?? UUID().uuidString;next[index]=Command(id:newId,scope:old.scope,endpoint:old.endpoint,title:old.title,body:body,created:Date(),draftId:old.draftId,error:nil,conflict:false);try write(next,"queue");queue=next}
    func remove(_ id:String) throws {let next=queue.filter{!($0.id==id && $0.scope==session?.scope)};try write(next,"queue");queue=next}
    func mark(_ id:String,error:String,conflict:Bool,status:Int?=nil) throws {var next=queue;if let i=next.firstIndex(where:{$0.id==id && $0.scope==session?.scope}){next[i].error=error;next[i].conflict=conflict;next[i].status=status};try write(next,"queue");queue=next}
}
struct OfflinePanel:View {
    @ObservedObject var browser:BrowserModel
    @ObservedObject var store=OfflineStore.shared
    @State private var reviewing:OfflineStore.Command?
    var body:some View{
        VStack(alignment:.leading,spacing:20){
            HStack{Text("Redo även utan nät").font(.system(size:28,design:.default));Spacer();Button("Stäng"){store.panel=false}}
            Text("Ladda ned före träningen eller matchen. Underlaget lagras krypterat på denna Mac och kan öppnas offline i upp till sju dagar. Utloggning låser offlineåtkomsten.").font(.callout).foregroundStyle(Studio.muted)
            Toggle("Arbeta med nedladdat underlag offline",isOn:Binding(get:{store.offline},set:{store.offline=$0;store.manualOffline=$0})).disabled(!store.canResume)
            HStack{Button("Ladda ned arbetsunderlag"){Task{await browser.prepareOffline()}}.disabled(store.syncing || store.offline);Button("Synka väntande ändringar"){Task{await browser.syncOffline()}}.disabled(store.syncing || store.pending.isEmpty)}
            if store.syncing{ProgressView()}
            if let message=store.message{Text(message).font(.callout).textSelection(.enabled)}
            Text("Väntar på synk · \(store.pending.count)").font(.headline)
            if store.pending.isEmpty{ContentUnavailableView("Allt är i fas",systemImage:"checkmark.circle",description:Text("Inga lokalt sparade ändringar väntar på synk."))}
            ScrollView{VStack(alignment:.leading,spacing:12){ForEach(store.pending){command in VStack(alignment:.leading,spacing:8){Text(command.title).font(.headline);Text(command.created.formatted()).font(.caption);if let error=command.error{Text(error).font(.callout)};if command.conflict{Text("Utkastet har behållits. Öppna underlaget och jämför innan du väljer vad du vill behålla.").font(.caption)};Text(command.summary).font(.callout).textSelection(.enabled);if command.conflict{Button("Granska och lös konflikt"){reviewing=command}};if command.status==400 || command.status==422{Button("Återgå till utkastet och rätta fälten"){do{try store.remove(command.id);store.panel=false;if let path=command.path{browser.open(path)}}catch{store.message=error.localizedDescription}}};Button("Öppna underlaget"){store.panel=false;if let path=command.path{browser.open(path)}}}.editorPanel()}}}
        }.padding(28).frame(width:680,height:600).background(Studio.paper).sheet(item:$reviewing){OfflineConflictReview(browser:browser,command:$0)}
    }
}
extension BrowserModel {
    @discardableResult
    func establishOfflineIdentity() async -> Bool {
        struct Identity:Decodable{let scope:String}
        func identify() async throws {
            let data=try await desktopRequest("?kind=session",endpoint:"workday",liveOnly:true)
            let identity=try JSONDecoder().decode(Identity.self,from:data)
            try OfflineStore.shared.authenticate(scope:identity.scope,name:userName,paths:availablePaths)
            validatedOfflineScope=identity.scope
        }
        do{try await identify();return true}catch{
            guard signedIn,(error as? NativeAPIError)?.status==nil else{return false}
            // A cold offline start has no loaded document from which to use the
            // HttpOnly session. Reopen the ordinary same-origin login/session path.
            let path=Self.baseURL.scheme=="http" ? "/api/auth/dev":"/idag"
            webView.load(URLRequest(url:URL(string:path,relativeTo:Self.baseURL)!))
            for _ in 0..<80{
                if Task.isCancelled{return false}
                try? await Task.sleep(for:.milliseconds(250))
                if !webView.isLoading{break}
            }
            do{try await identify();return true}catch{return false}
        }
    }
    func resumeOffline() -> Bool {
        let store=OfflineStore.shared
        guard store.canResume,let session=store.session else{return false}
        if signedIn{store.offline=true;error=nil;return true}
        signedIn=true;userName=session.name;availablePaths=Set(session.paths);store.offline=true;error=nil;currentPath="/idag";refreshWorkspace();return true
    }
    func prepareOffline() async {
        let store=OfflineStore.shared;guard !store.syncing else{return};store.syncing=true;store.message="Laddar ned…";defer{store.syncing=false}
        do{
            await establishOfflineIdentity()
            let workspaceData=try await desktopRequest("",endpoint:"workspace",liveOnly:true)
            self.workspace=try JSONDecoder().decode(Workspace.self,from:workspaceData)
            let data=try await desktopRequest("",endpoint:"practice",liveOnly:true)
            let practice=try JSONDecoder().decode(Practice.self,from:data)
            self.practice=practice
            var total=0
            for player in practice.players where practice.canPrivate {
                _=try await desktopRequest("?kind=player&id=\(player.id)",endpoint:"workday",liveOnly:true)
                for kind in (practice.canEdit ? ["checkpoint","conversation"]:[]){_=try await desktopRequest("?kind=\(kind)&id=\(player.id)",liveOnly:true)}
                total+=1
            }
            for plan in practice.plans where practice.canTrain{_=try await desktopRequest("?kind=training&id=\(plan.id)",liveOnly:true)}
            if practice.canTrain{_=try await desktopRequest("?kind=training&id=nytt",liveOnly:true)}
            for match in workspace?.matches ?? []{_=try await desktopRequest("?kind=match&id=\(match.id)",endpoint:"workday",liveOnly:true)}
            store.message="Nedladdat: \(total) spelarprofiler, \(practice.plans.count) träningspass och arbetsveckans matcher. Redo offline."
        }catch{store.message="Nedladdningen är inte komplett: \(error.localizedDescription). Endast tidigare hämtat underlag finns offline."}
    }
    func syncOffline() async {
        let store=OfflineStore.shared;guard !store.syncing else{return};store.syncing=true;defer{store.syncing=false}
        let connected=await establishOfflineIdentity()
        guard connected,!store.offline else{store.message="Anslut och logga in innan du synkar.";return}
        var refreshPath:String?
        for command in store.pending where !command.conflict {
            do{
                _=try await desktopRequest("",body:command.body,endpoint:command.endpoint,liveOnly:true)
                let fields=command.fields
                let query:String
                if let id=fields["matchId"] as? Int{query="?kind=match&id=\(id)"}
                else if let id=fields["playerId"] as? Int{query="?kind=\(fields["kind"] as? String ?? "")&id=\(id)"}
                else{query="?kind=training&id=\(fields["id"] as? String ?? "")"}
                _=try? await desktopRequest(query,endpoint:command.endpoint,liveOnly:true)
                if let id=fields["playerId"] as? Int{_=try? await desktopRequest("?kind=player&id=\(id)",endpoint:"workday",liveOnly:true)}
                if (nativeEditor?.queued==true && nativeEditor?.draftIdentity==command.draftId) || (nativeWorkday?.queued==true && nativeWorkday?.draftIdentity==command.draftId){refreshPath=command.path;if let id=fields["id"] as? String{refreshPath="/traning/\(id)"}}
                try store.remove(command.id);if let draftId=command.draftId{store.clearDraft(draftId)}
            }
            catch{let status=(error as? NativeAPIError)?.status;try? store.mark(command.id,error:error.localizedDescription,conflict:status==409,status:status);if status==nil || status==401 || status==403 || (status ?? 0)>=500{break}}
        }
        store.message=store.pending.isEmpty ? "Alla lokala ändringar är synkade.":"\(store.pending.count) sparförsök återstår. Granska eventuella konflikter."
        refreshWorkspace();if let refreshPath{open(refreshPath)}
    }
}

extension OfflineStore.Command {
    var fields:[String:Any]{(try? JSONSerialization.jsonObject(with:body) as? [String:Any]) ?? [:]}
    var path:String? {
        let b=fields
        if let match=b["matchId"] as? Int {return "/matcher/\(match)" + (b["kind"] as? String == "selection" ? "/laguttagning":b["kind"] as? String == "evaluation" ? "/utvardera":"")}
        if let player=b["playerId"] as? Int {return "/spelare/\(player)" + (b["kind"] as? String == "checkpoint" ? "/utveckling/avstamning":"?samtal=forbered")}
        if let id=b["id"] as? String{return draftId?.hasSuffix("training:nytt")==true ? "/traning/nytt":"/traning/\(id)"};return nil
    }
    var summary:String {
        let b=fields
        if let players=b["players"] as? [[String:Any]]{return "Lokalt utkast: \(players.count) uttagna. " + players.compactMap{$0["position"] as? String}.filter{!$0.isEmpty}.joined(separator:", ")}
        if let document=b["document"] as? [String:Any]{if let title=document["title"] as? String{return title};if let ideas=document["ideas"] as? [String:String]{return "Formation: \(document["formation"] as? String ?? "")\n"+ideas.values.filter{!$0.isEmpty}.joined(separator:"\n")}}
        if let context=b["context"] as? [String:Any]{return "Matchreflektion: \(context["coachComment"] as? String ?? "")"}
        if let focus=b["focus"] as? [String]{return "Avstämning: \(b["date"] as? String ?? "") · \(focus.count) fokus"}
        return "Spelarsamtal: \(b["date"] as? String ?? "")\n\(b["agreement"] as? String ?? "")"
    }
}
