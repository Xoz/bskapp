import SwiftUI
import AppKit

struct OfflineConflictReview:View {
    @ObservedObject var browser:BrowserModel
    let command:OfflineStore.Command
    @Environment(\.dismiss) private var dismiss
    @State private var latest:String?
    @State private var localDetails:String?
    @State private var replacement:Data?
    @State private var failure:String?
    @State private var busy=false
    var body:some View {
        VStack(alignment:.leading,spacing:18){
            Text("Granska innan du synkar").font(.system(size:27,design:.serif))
            Text(command.title).font(.headline)
            ScrollView{VStack(alignment:.leading,spacing:18){
                VStack(alignment:.leading,spacing:8){Text("Ditt lokala utkast").font(.headline);Text(localDetails ?? command.summary).textSelection(.enabled)}.editorPanel()
                if let latest{VStack(alignment:.leading,spacing:8){Text("Senaste sparade underlaget").font(.headline);Text(latest).textSelection(.enabled)}.editorPanel()}
                if let failure{Text(failure).foregroundStyle(.red)}
                if busy{ProgressView("Hämtar senaste versionen…")}
            }}
            Text("Behåll utkastet uppdaterar underlaget för ditt sparförsök. Servern kontrollerar åter behörighet, spelarval och eventuella nya ändringar. Inget skrivs innan du väljer Synka.").font(.caption).foregroundStyle(Studio.muted)
            HStack{Button("Stäng"){dismiss()};Spacer();Button("Lämna mitt lokala sparförsök…"){discard()};Button("Behåll utkastet och synka…"){submit()}.disabled(replacement==nil || busy)}
        }.padding(26).frame(width:760,height:620).background(Studio.paper).task{await load()}
    }
    private func load() async {
        busy=true;defer{busy=false}
        do {
            var body=command.fields
            let kind=body["kind"] as? String ?? ""
            let query:String
            if let id=body["matchId"] as? Int{query="?kind=match&id=\(id)"}
            else if let id=body["playerId"] as? Int{query="?kind=\(kind)&id=\(id)"}
            else if let id=body["id"] as? String{query="?kind=training&id=\(id)"}
            else{throw NativeAPIError(message:"Underlaget kunde inte identifieras.")}
            let data=try await browser.desktopRequest(query,endpoint:command.endpoint,liveOnly:true)
            guard let fresh=try JSONSerialization.jsonObject(with:data) as? [String:Any] else{throw NativeAPIError(message:"Kunde inte läsa senaste versionen.")}
            body["commandId"]=UUID().uuidString
            if let versions=fresh["versions"] as? [String:String] {
                body["version"]=versions[kind]
                if let plan=fresh["plan"] as? [String:Any]{body["revision"]=plan["revision"]}
                let candidates=fresh["candidates"] as? [[String:Any]] ?? []
                let names=candidates.filter{$0["selected"] as? Bool == true}.compactMap{$0["name"] as? String}
                let plan=fresh["plan"] as? [String:Any];let document=plan?["document"] as? [String:Any];let ideas=document?["ideas"] as? [String:String] ?? [:]
                latest="Laguppställning: "+names.joined(separator:", ")+"\nMatchidé:\n"+ideas.values.filter{!$0.isEmpty}.joined(separator:"\n")
                if kind=="evaluation",let e=fresh["evaluation"] as? [String:Any],let m=e["match"] as? [String:Any]{latest="Tränarens reflektion: \(m["coachComment"] as? String ?? "")\nResultat: \(m["ourScore"] ?? "–")–\(m["opponentScore"] ?? "–")"}
            } else if kind=="training"{body["revision"]=fresh["revision"];let doc=fresh["document"] as? [String:Any];latest="\(doc?["title"] as? String ?? "Träningspass") · \((doc?["blocks"] as? [Any])?.count ?? 0) övningar"}
            else if kind=="checkpoint"{
                body["version"]=fresh["version"]
                let statuses=fresh["statuses"] as? [String:String] ?? [:],local=body["statuses"] as? [String:String] ?? [:]
                let skills=fresh["skills"] as? [[String:Any]] ?? []
                latest=skills.compactMap{s -> String? in guard let id=s["id"] as? String,let title=s["title"] as? String,statuses[id] != local[id] else{return nil};return "\(title): nu \(status(statuses[id] ?? "not_started")), utkast \(status(local[id] ?? "not_started"))"}.joined(separator:"\n")
                if latest?.isEmpty == true{latest="Färdigheterna är samma. Datum eller avstämningshistorik har ändrats."}
            } else if kind=="conversation"{let p=fresh["preparation"] as? [String:Any];body["checkpointId"]=p?["checkpointId"] as? String ?? "";latest=p?["summary"] as? String ?? "Nytt samtalsunderlag"}
            localDetails=describe(command.fields,kind:kind,reference:fresh)
            var current=fresh
            if kind=="plan",let plan=fresh["plan"] as? [String:Any]{current["document"]=plan["document"]}
            if kind=="selection"{current["players"]=(fresh["roster"] as? [[String:Any]] ?? []).filter{$0["selection_status"] as? String == "selected"}.map{["playerId":$0["player_id"] ?? 0,"position":$0["selected_position"] ?? ""]}}
            if kind=="evaluation",let e=fresh["evaluation"] as? [String:Any]{current["context"]=e["match"];current["answers"]=(e["players"] as? [[String:Any]] ?? []).map{p in var a=p;a["playerId"]=p["id"];return a}}
            if kind != "conversation"{latest=describe(current,kind:kind,reference:fresh)}
            replacement=try JSONSerialization.data(withJSONObject:body,options:[.sortedKeys])
        }catch{failure=error.localizedDescription}
    }
    private func describe(_ body:[String:Any],kind:String,reference:[String:Any])->String {
        let people=(reference["candidates"] as? [[String:Any]] ?? [])+((reference["evaluation"] as? [String:Any])?["players"] as? [[String:Any]] ?? [])
        func name(_ id:Any?)->String{guard let id=id as? Int else{return "Tom plats"};return people.first{$0["id"] as? Int == id}?["name"] as? String ?? "Spelare \(id)"}
        func text(_ key:String,_ label:String)->String{"\(label): \(body[key] as? String ?? "–")"}
        if kind=="selection"{return (body["players"] as? [[String:Any]] ?? []).map{"\(name($0["playerId"])) · \($0["position"] as? String ?? "")"}.joined(separator:"\n")}
        if let document=body["document"] as? [String:Any]{
            if kind=="training"{return "\(document["title"] as? String ?? "Träningspass") · \(document["date"] as? String ?? "")\n"+(document["blocks"] as? [[String:Any]] ?? []).enumerated().map{i,b in let d=b["diagram"] as? [String:Any];return "Övning \(i+1): \(d?["title"] as? String ?? "") · \(b["minutes"] ?? 0) min\n\(d?["notes"] as? String ?? "")\nRitning: \((d?["objects"] as? [Any])?.count ?? 0) objekt"}.joined(separator:"\n\n")}
            let spots=(document["spots"] as? [[String:Any]] ?? []).enumerated().map{i,p in "Plats \(i+1): \(name(p["playerId"])) · x \(Int((p["x"] as? Double ?? 0)*100))%, y \(Int((p["y"] as? Double ?? 0)*100))%"}
            let ideas=document["ideas"] as? [String:String] ?? [:]
            let labels=["focus":"Vårt viktigaste fokus","attack":"När vi har bollen","defend":"När motståndaren har bollen","transition":"När vi vinner eller tappar bollen"]
            return "Formation: \(document["formation"] as? String ?? "")\n"+spots.joined(separator:"\n")+"\n\n"+ideas.keys.sorted().map{"\(labels[$0] ?? $0): \(ideas[$0] ?? "")"}.joined(separator:"\n")
        }
        if let c=body["context"] as? [String:Any]{return "Resultat: \(c["ourScore"] ?? "–")–\(c["opponentScore"] ?? "–")\n\(c["coachComment"] as? String ?? "")\n\n"+(body["answers"] as? [[String:Any]] ?? []).map{"\(name($0["playerId"])) · bedömning \($0["rating"] ?? "–")\n\($0["ratingComment"] as? String ?? "")"}.joined(separator:"\n\n")}
        if kind=="checkpoint"{
            let statuses=body["statuses"] as? [String:String] ?? [:],focus=Set(body["focus"] as? [String] ?? [])
            return [text("date","Datum"),text("coach","Tränare"),text("strengths","Styrkor"),text("focusNote","Fokusanteckning"),text("wellbeing","Trygghet")].joined(separator:"\n")+"\n\n"+(reference["skills"] as? [[String:Any]] ?? []).map{s in let id=s["id"] as? String ?? "";return "\(s["title"] as? String ?? id): \(status(statuses[id] ?? "not_started"))\(focus.contains(id) ? " · fokus":"")"}.joined(separator:"\n")
        }
        return [text("date","Datum"),text("outcome","Utfall"),text("note","Tränarens anteckning"),text("perspective","Spelarens perspektiv"),text("agreement","Överenskommelse"),text("followup","Uppföljning")].joined(separator:"\n\n")
    }
    private func status(_ s:String)->String{["done":"klar","almost":"nästan klar","training":"tränar på","not_started":"ej påbörjad"][s] ?? s}
    private func submit(){guard let replacement else{return};let alert=NSAlert();alert.messageText="Synka ditt granskade utkast?";alert.informativeText="Ditt utkast kan ersätta de skillnader som visas i senaste underlaget. Övriga ändringar som tillkommer innan synk stoppar sparandet igen.";alert.addButton(withTitle:"Stanna");alert.addButton(withTitle:"Synka mitt utkast");guard alert.runModal() == .alertSecondButtonReturn else{return};Task{do{try OfflineStore.shared.replace(command.id,body:replacement);await browser.syncOffline();dismiss()}catch{failure=error.localizedDescription}}}
    private func discard(){let alert=NSAlert();alert.messageText="Lämna detta lokala sparförsök?";alert.informativeText="Den sparade serverversionen behålls. Det lokala utkastet tas bort.";alert.addButton(withTitle:"Stanna");alert.addButton(withTitle:"Lämna utkastet");if alert.runModal() == .alertSecondButtonReturn{do{try OfflineStore.shared.remove(command.id);if let id=command.draftId{OfflineStore.shared.clearDraft(id)};dismiss()}catch{failure=error.localizedDescription}}}
}
