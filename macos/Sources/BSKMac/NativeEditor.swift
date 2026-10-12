import SwiftUI
import WebKit

enum NativeRoute: Equatable, Identifiable {
    case training(String), checkpoint(Int), conversation(Int)
    var kind: String { switch self { case .training: "training"; case .checkpoint: "checkpoint"; case .conversation: "conversation" } }
    var key: String { switch self { case .training(let id): id; case .checkpoint(let id), .conversation(let id): String(id) } }
    var id: String { kind + ":" + key }
    var destination: String { kind == "training" ? "/traning" : "/spelare/\(key)" }
    var title: String { switch self { case .training: "Redigera träningspass"; case .checkpoint: "Utvecklingsavstämning"; case .conversation: "Spelarsamtal" } }
    static func parse(_ url: URL) -> NativeRoute? {
        let parts = url.path.split(separator: "/")
        if parts.count == 2, parts[0] == "traning", parts[1] == "nytt" || UUID(uuidString: String(parts[1])) != nil { return .training(String(parts[1])) }
        guard parts.count >= 2, parts[0] == "spelare", let id = Int(parts[1]), id > 0 else { return nil }
        if parts.count == 4, parts[2] == "utveckling", parts[3] == "avstamning" { return .checkpoint(id) }
        if parts.count == 2, URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.contains(where: { $0.name == "samtal" && $0.value == "forbered" }) == true { return .conversation(id) }
        return nil
    }
}
struct NativePlan: Codable, Equatable {
    var version = 1
    var title = "Nytt träningspass"
    var date = ""
    var blocks: [NativeBlock] = []
}
struct NativeBlock: Codable, Equatable, Identifiable {
    var id = UUID().uuidString
    var minutes = 10
    var diagram = NativeDiagram()
}
struct NativeDiagram: Codable, Equatable {
    var version = 1
    var title = "Ny övning"
    var notes = ""
    var objects: [NativeObject] = []
}
struct NativeObject: Codable, Equatable, Identifiable {
    var id = UUID().uuidString.replacingOccurrences(of: "-", with: "")
    var type: String
    var x: Double
    var y: Double
    var color = "#ffd23f"
    var label = ""
    var size = 1.0
    var x2: Double?
    var y2: Double?
    var cx: Double?
    var cy: Double?
    var arrow: Bool { ["pass", "run", "dribble"].contains(type) }
}
struct NativeBank: Decodable, Identifiable {
    let id, category, players, area, time, focus: String
    let model: NativeDiagram
}
struct NativeTrainingLoad: Decodable { let scope: String; let id: String; let revision: Int; let document: NativePlan; let bank: [NativeBank] }
struct NativeSkill: Codable, Identifiable { let id, category, title, criterion, advice: String; let level: Int }
struct NativeCategory: Codable, Identifiable { let id, name: String }
struct NativePreparation: Codable { let checkpointId: String?; let summary: String; let focus: [Focus]
    struct Focus: Codable { let id, title, criterion: String }
}
struct NativeDevelopment: Codable {
    let scope: String
    let playerId: Int
    let name, coach, today, version: String
    let categories: [NativeCategory]
    let skills: [NativeSkill]
    let statuses: [String: String]
    let focus: [String]
    let strengths, focusNote, wellbeing: String
    let preparation: NativePreparation
}
struct NativeSaveResult: Decodable { let revision: Int?; let saved: Bool?; let error: String?; let queued: Bool? }
struct NativeAPIError: LocalizedError { let message: String; var status: Int? = nil; var errorDescription: String? { message } }

extension BrowserModel {
    func desktopRequest(_ query: String, body: Data? = nil, endpoint: String = "editor", liveOnly: Bool = false) async throws -> Data {
        guard signedIn else { throw NativeAPIError(message: "Logga in igen för att fortsätta.") }
        let store=OfflineStore.shared
        let identityRequest=endpoint=="workday" && query=="?kind=session"
        if !identityRequest,!store.offline,(store.session==nil || validatedOfflineScope != store.session?.scope){
            guard await establishOfflineIdentity() else{throw NativeAPIError(message:"Anslut och verifiera inloggningen innan du fortsätter.",status:403)}
        }
        let requestScope=store.session?.scope
        let cachePath=endpoint+query
        if store.offline && !liveOnly {
            if body == nil,let entry=store.cached(cachePath){return entry.data}
            if let body{try store.enqueue(endpoint:endpoint,body:body,title:pageTitle,draftId:nativeEditor?.draftIdentity ?? nativeWorkday?.draftIdentity);return Data("{\"queued\":true}".utf8)}
            throw NativeAPIError(message:"Detta underlag är inte nedladdat. Anslut och ladda ned det före avfärd.")
        }
        do {
        let result = try await webView.callAsyncJavaScript("""
            if (location.origin !== origin) throw new Error('origin');
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 20000);
            try {
            const response = await fetch('/api/desktop/' + endpoint + query, {
              signal: controller.signal,
              method: body ? 'POST' : 'GET', credentials:'same-origin', cache:'no-store', redirect:'error',
              headers: body ? {'Content-Type':'application/json'} : {}, body: body || undefined
            });
            return JSON.stringify({status:response.status, text:await response.text()});
            } finally { clearTimeout(timer); }
            """, arguments: ["endpoint": endpoint, "origin": Self.baseURL.absoluteString, "query": query, "body": body.flatMap { String(data: $0, encoding: .utf8) } ?? ""], in: nil, contentWorld: .page)
        struct Envelope: Decodable { let status: Int; let text: String }
        guard signedIn, (identityRequest || requestScope==store.session?.scope), let json = result as? String else { throw NativeAPIError(message: "Sessionen har avslutats.") }
        let envelope = try JSONDecoder().decode(Envelope.self, from: Data(json.utf8))
        guard (200..<300).contains(envelope.status) else {
            let error = try? JSONDecoder().decode(NativeSaveResult.self, from: Data(envelope.text.utf8))
            throw NativeAPIError(message: error?.error ?? "Kunde inte läsa eller spara. Kontrollera din behörighet och anslutning.", status: envelope.status)
        }
        let data=Data(envelope.text.utf8)
        if body == nil,!identityRequest {try store.cache(path:cachePath,data:data)}
        return data
        } catch {
            guard signedIn,identityRequest || requestScope==store.session?.scope else{throw NativeAPIError(message:"Sessionen har ändrats. Logga in igen.",status:403)}
            let status=(error as? NativeAPIError)?.status
            if !liveOnly && (status == nil || (status ?? 0)>=500) {
                store.offline=true
                if let body {try store.enqueue(endpoint:endpoint,body:body,title:pageTitle,draftId:nativeEditor?.draftIdentity ?? nativeWorkday?.draftIdentity);return Data("{\"queued\":true}".utf8)}
                if let entry=store.cached(cachePath){return entry.data}
            }
            throw error
        }
    }
}

@MainActor
final class NativeEditorSession: ObservableObject {
    let route: NativeRoute
    private let transport: ((String, Data?) async throws -> Data)?
    @Published var loaded = false
    @Published var busy = false
    @Published var saved = false
    @Published var error: String?
    @Published var uncertain = false
    @Published var queued = false
    @Published var conflict = false
    @Published var plan = NativePlan()
    @Published var bank: [NativeBank] = []
    @Published var development: NativeDevelopment?
    @Published var statuses: [String: String] = [:]
    @Published var focus: Set<String> = []
    @Published var date = ""
    @Published var coach = ""
    @Published var strengths = ""
    @Published var focusNote = ""
    @Published var wellbeing = ""
    @Published var outcome = ""
    @Published var note = ""
    @Published var perspective = ""
    @Published var agreement = ""
    @Published var followup = ""
    private var commandID = UUID().uuidString
    private var planID = ""
    private var revision = 0
    private var cacheKey: String?
    var draftIdentity:String?{cacheKey}
    private struct CachedDraft: Codable { let updated: Date; let body: Data; let development: NativeDevelopment?; let pending: Bool }
    @Published var notice: String?
    private let offlineStore:OfflineStore
    private var planHistory:[NativePlan]=[]
    private var planCursor = -1
    private var replayingPlan = false
    var canUndoPlan:Bool{planCursor>0 && !locked}
    var canRedoPlan:Bool{planCursor>=0 && planCursor<planHistory.count-1 && !locked}
    func rememberPlan(_ old:NativePlan,_ new:NativePlan){guard loaded,!busy else{return};if replayingPlan{replayingPlan=false;return};if planCursor>=0 && planHistory[planCursor]==new{return};if planHistory.isEmpty{planHistory=[old];planCursor=0};planHistory=Array(planHistory.prefix(planCursor+1));planHistory.append(new);if planHistory.count>100{planHistory.removeFirst()};planCursor=planHistory.count-1}
    func undoPlan(){guard canUndoPlan else{return};replayingPlan=true;planCursor-=1;plan=planHistory[planCursor]}
    func redoPlan(){guard canRedoPlan else{return};replayingPlan=true;planCursor+=1;plan=planHistory[planCursor]}
    struct DevelopmentEdit:Equatable {
        var statuses:[String:String];var focus:Set<String>
        var date,coach,strengths,focusNote,wellbeing,outcome,note,perspective,agreement,followup:String
    }
    var developmentEdit:DevelopmentEdit{DevelopmentEdit(statuses:statuses,focus:focus,date:date,coach:coach,strengths:strengths,focusNote:focusNote,wellbeing:wellbeing,outcome:outcome,note:note,perspective:perspective,agreement:agreement,followup:followup)}
    private var developmentHistory:[DevelopmentEdit]=[]
    private var developmentCursor=0
    var canUndoDevelopment:Bool{!locked && developmentCursor>0}
    var canRedoDevelopment:Bool{!locked && developmentCursor<developmentHistory.count-1}
    func rememberDevelopment(){guard loaded,!busy,route.kind != "training" else{return};if developmentHistory.isEmpty{developmentHistory=[developmentEdit];developmentCursor=0;return};guard developmentHistory[developmentCursor] != developmentEdit else{return};developmentHistory=Array(developmentHistory.prefix(developmentCursor+1));developmentHistory.append(developmentEdit);if developmentHistory.count>100{developmentHistory.removeFirst()};developmentCursor=developmentHistory.count-1}
    private func restoreDevelopmentEdit(_ state:DevelopmentEdit){statuses=state.statuses;focus=state.focus;date=state.date;coach=state.coach;strengths=state.strengths;focusNote=state.focusNote;wellbeing=state.wellbeing;outcome=state.outcome;note=state.note;perspective=state.perspective;agreement=state.agreement;followup=state.followup}
    func undoDevelopment(){guard canUndoDevelopment else{return};developmentCursor-=1;restoreDevelopmentEdit(developmentHistory[developmentCursor])}
    func redoDevelopment(){guard canRedoDevelopment else{return};developmentCursor+=1;restoreDevelopmentEdit(developmentHistory[developmentCursor])}
    private var baseline: Data?
    private var pending: Data?
    private var generation = UUID()
    var dirty: Bool { !queued && loaded && (pending != nil || uncertain || payload() != baseline) }
    var locked: Bool { busy || uncertain || queued }
    init(_ route: NativeRoute, offlineStore:OfflineStore = .shared, transport: ((String, Data?) async throws -> Data)? = nil) { self.route = route; self.transport = transport; self.offlineStore=offlineStore }
    func invalidate() { generation = UUID(); loaded = false; busy = false; development = nil; bank = []; plan = NativePlan(); baseline = nil; pending = nil; statuses = [:]; focus = []; strengths = ""; focusNote = ""; wellbeing = ""; note = ""; perspective = ""; agreement = "" }
    func payload() -> Data? {
        var value: [String: Any] = ["kind": route.kind]
        if route.kind == "training" {
            guard let json = try? JSONEncoder().encode(plan), let document = try? JSONSerialization.jsonObject(with: json) else { return nil }
            value.merge(["id": planID, "revision": revision, "document": document]) { _, new in new }
        } else {
            guard let development else { return nil }
            value.merge(["playerId": development.playerId, "commandId": commandID, "date": date]) { _, new in new }
            if route.kind == "checkpoint" {
                value.merge(["version": development.version, "coach": coach, "statuses": statuses, "focus": focus.sorted(), "strengths": strengths, "focusNote": focusNote, "wellbeing": wellbeing]) { _, new in new }
            } else {
                value.merge(["checkpointId": development.preparation.checkpointId ?? "", "outcome": outcome, "note": note, "perspective": perspective, "agreement": agreement, "followup": followup]) { _, new in new }
            }
        }
        return try? JSONSerialization.data(withJSONObject: value, options: [.sortedKeys])
    }
    func load(_ browser: BrowserModel) async {
        let token = UUID(); generation = token
        busy = true; error = nil
        do {
            let query = "?kind=\(route.kind)&id=\(route.key)"
            let data: Data
            if let transport { data = try await transport(query, nil) } else { data = try await browser.desktopRequest(query) }
            guard generation == token, !Task.isCancelled, browser.signedIn else { return }
            if route.kind == "training" {
                let value = try JSONDecoder().decode(NativeTrainingLoad.self, from: data)
                cacheKey = "bsk.nativeDraft:\(value.scope):\(route.id)"
                planID = route.key == "nytt" ? UUID().uuidString : value.id; revision = value.revision; plan = value.document; bank = value.bank
            } else {
                let value = try JSONDecoder().decode(NativeDevelopment.self, from: data)
                cacheKey = "bsk.nativeDraft:\(value.scope):\(route.id)"
                development = value; statuses = Dictionary(uniqueKeysWithValues: value.skills.map { ($0.id, value.statuses[$0.id] ?? "not_started") })
                focus = Set(value.focus); date = value.today; coach = value.coach
                strengths = value.strengths; focusNote = value.focusNote; wellbeing = value.wellbeing
            }
            planHistory=[];planCursor = -1;replayingPlan=false
            loaded = true; saved = false; uncertain = false; pending = nil; baseline = payload(); restoreDraft();planHistory=[plan];planCursor=0;developmentHistory=[developmentEdit];developmentCursor=0
        } catch {
            guard generation == token, !Task.isCancelled else { return }
            self.error = error.localizedDescription
        }
        if generation == token { busy = false }
    }
    func clearDraft() { if let cacheKey { offlineStore.clearDraft(cacheKey) } }
    func storeDraft() {
        guard loaded, let cacheKey else { return }
        guard dirty || queued, let body = pending ?? payload() else { clearDraft(); return }
        let cached = CachedDraft(updated: Date(), body: body, development: development, pending: pending != nil || uncertain)
        if let data = try? JSONEncoder().encode(cached) { try? offlineStore.saveDraft(data,id:cacheKey) }
    }
    private func restoreDraft() {
        guard let cacheKey, let data = offlineStore.draft(cacheKey),
              let cached = try? JSONDecoder().decode(CachedDraft.self, from: data),
              Date().timeIntervalSince(cached.updated) >= 0, Date().timeIntervalSince(cached.updated) < 7 * 86400,
              let body = try? JSONSerialization.jsonObject(with: cached.body) as? [String: Any] else { clearDraft(); return }
        if route.kind == "training" {
            guard let document = body["document"], let json = try? JSONSerialization.data(withJSONObject: document),
                  let restored = try? JSONDecoder().decode(NativePlan.self, from: json), restored.valid,
                  let id = body["id"] as? String, UUID(uuidString: id) != nil, let revision = body["revision"] as? Int else { clearDraft(); return }
            plan = restored; planID = id; self.revision = revision
        } else {
            guard let restored = cached.development, restored.scope == development?.scope, restored.playerId == development?.playerId,
                  let id = body["commandId"] as? String, UUID(uuidString: id) != nil else { clearDraft(); return }
            development = restored; commandID = id; date = body["date"] as? String ?? date
            if route.kind == "checkpoint" {
                statuses = body["statuses"] as? [String: String] ?? statuses; focus = Set(body["focus"] as? [String] ?? [])
                coach = body["coach"] as? String ?? coach; strengths = body["strengths"] as? String ?? ""; focusNote = body["focusNote"] as? String ?? ""; wellbeing = body["wellbeing"] as? String ?? ""
            } else {
                outcome = body["outcome"] as? String ?? ""; note = body["note"] as? String ?? ""; perspective = body["perspective"] as? String ?? ""; agreement = body["agreement"] as? String ?? ""; followup = body["followup"] as? String ?? ""
            }
        }
        queued=offlineStore.pending.contains{$0.body==cached.body};uncertain = cached.pending && !queued; pending = cached.pending ? cached.body : nil
        notice = queued ? "Sparat på denna Mac. Väntar på synk.":"Ditt lokala utkast är återställt. Kontrollera innehållet innan du sparar."
    }
    func saveAsNew() {
        guard !busy, !uncertain else { return }
        planID = UUID().uuidString; revision = 0; pending = nil; conflict = false; saved = false; error = nil
    }
    func save(_ browser: BrowserModel) async {
        guard loaded, !busy else { return }
        if route.kind == "training" && !plan.valid { error = "Kontrollera namn, datum, minuter och ritningarnas fält."; return }
        guard let body = pending ?? payload() else { error = "Kontrollera fältens innehåll innan du sparar."; return }
        let token = generation
        busy = true; error = nil; pending = body
        do {
            let data: Data
            if let transport { data = try await transport("", body) } else { data = try await browser.desktopRequest("", body: body) }
            guard generation == token, browser.signedIn else { return }
            let result = try JSONDecoder().decode(NativeSaveResult.self, from: data)
            if result.queued == true {queued=true;uncertain=false;pending=body;notice="Sparat på denna Mac. Väntar på synk.";busy=false;storeDraft();return}
            guard result.saved == true || result.revision != nil else { throw NativeAPIError(message: "Servern bekräftade inte sparandet.") }
            if let newRevision = result.revision { revision = newRevision }
            saved = true; uncertain = false; conflict = false; pending = nil; baseline = payload(); clearDraft(); notice = nil
        } catch {
            guard generation == token else { return }
            self.error = error.localizedDescription
            // A transport failure may hide a successful write. Freeze its exact payload
            // and retry the same command rather than introducing duplicates or edits.
            conflict = (error as? NativeAPIError)?.status == 409
            let status = (error as? NativeAPIError)?.status
            uncertain = status == nil || (status ?? 0) >= 500
            if !uncertain { pending = nil }
        }
        if generation == token { busy = false }
    }
}

struct NativeEditorView: View {
    @ObservedObject var browser: BrowserModel
    @ObservedObject var session: NativeEditorSession
    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 18) {
                Button { browser.open(browser.editorReturnPath ?? session.route.destination) } label: { Label("Till översikten", systemImage: "arrow.left") }
                Text(session.route.title).font(.system(size: 15, design: .default))
                Spacer()
                if session.route.kind != "training" {Button{session.undoDevelopment()}label:{Image(systemName:"arrow.uturn.backward")}.disabled(!session.canUndoDevelopment).keyboardShortcut("z").help("Ångra ändring");Button{session.redoDevelopment()}label:{Image(systemName:"arrow.uturn.forward")}.disabled(!session.canRedoDevelopment).keyboardShortcut("z",modifiers:[.command,.shift]).help("Gör om ändring")}
                if session.route.kind == "training" {Button{session.undoPlan()}label:{Image(systemName:"arrow.uturn.backward")}.disabled(!session.canUndoPlan).keyboardShortcut("z").help("Ångra ändring");Button{session.redoPlan()}label:{Image(systemName:"arrow.uturn.forward")}.disabled(!session.canRedoPlan).keyboardShortcut("z",modifiers:[.command,.shift]).help("Gör om ändring")}
                if session.saved && !session.dirty { Label("Sparat i lagets databas", systemImage: "checkmark.circle").font(.system(size: 12)).foregroundStyle(Studio.muted) }
                else if session.dirty { Text("Osparat utkast").font(.system(size: 12)).foregroundStyle(Studio.muted) }
                Button(session.busy ? "Sparar…" : session.uncertain ? "Försök spara igen" : "Spara") { Task { await session.save(browser) } }
                    .buttonStyle(.borderedProminent).tint(Studio.control)
                    .disabled(!session.loaded || session.busy || session.queued || (session.saved && !session.dirty) || (session.route.kind == "conversation" && session.outcome.isEmpty))
                    .keyboardShortcut("s")
            }.padding(.horizontal,16).padding(.vertical,10).background(Studio.surface)
            Divider()
            if let notice = session.notice { Text(notice).font(.system(size: 12)).padding(12) }
            if let error = session.error {
                HStack {
                    Text(error).font(.system(size: 12)).textSelection(.enabled)
                    Spacer()
                    if !session.loaded { Button("Försök igen") { Task { await session.load(browser) } } }
                }.padding(16).background(Studio.accent.opacity(0.2))
            }
            if session.conflict {
                HStack {
                    if session.route.kind == "training" { Button("Behåll utkastet som nytt pass") { session.saveAsNew() } }
                    Button("Hämta senaste sparade versionen") { browser.reload() }
                }.padding(12)
            }
            if session.uncertain { Text("Svaret kom inte fram. Försök spara igen med samma innehåll innan du fortsätter.").font(.system(size: 12)).padding(12) }
            if !session.loaded { ProgressView("Hämtar underlaget…").frame(maxWidth: .infinity, maxHeight: .infinity) }
            else if session.route.kind == "training" { NativeTrainingEditor(session: session).disabled(session.locked) }
            else { NativeDevelopmentEditor(session: session,browser:browser).disabled(session.locked || (session.saved && !session.dirty)) }
        }.background(Studio.paper).foregroundStyle(Studio.ink)
            .task(id: session.route.id) { await session.load(browser) }
            .onChange(of:session.plan){old,new in session.rememberPlan(old,new)}
            .onChange(of:session.developmentEdit){_,_ in session.rememberDevelopment()}
            .onChange(of: session.payload()) { _, _ in session.storeDraft() }
            .onChange(of: session.busy) { _, _ in session.storeDraft() }
            .onChange(of: session.uncertain) { _, _ in session.storeDraft() }
    }
}

struct NativeWindowGuard: NSViewRepresentable {
    let browser: BrowserModel
    func makeNSView(context: Context) -> GuardView { let view = GuardView(); view.browser = browser; return view }
    func updateNSView(_ view: GuardView, context: Context) { view.browser = browser }
    final class GuardView: NSView {
        weak var browser: BrowserModel?
        private var closeDelegate: CloseDelegate?
        override func viewDidMoveToWindow() {
            super.viewDidMoveToWindow()
            guard let window, closeDelegate == nil else { return }
            let delegate = CloseDelegate(); delegate.browser = browser; delegate.original = window.delegate
            closeDelegate = delegate; window.delegate = delegate
        }
    }
    final class CloseDelegate: NSObject, NSWindowDelegate {
        weak var browser: BrowserModel?
        weak var original: NSWindowDelegate?
        func windowShouldClose(_ sender: NSWindow) -> Bool {
            guard browser?.confirmLeavingEditor() != false else { return false }
            guard original?.windowShouldClose?(sender) != false else { return false }
            browser?.hasConfirmedClose = true
            return true
        }
        override func responds(to aSelector: Selector!) -> Bool { super.responds(to: aSelector) || original?.responds(to: aSelector) == true }
        override func forwardingTarget(for aSelector: Selector!) -> Any? { original?.responds(to: aSelector) == true ? original : super.forwardingTarget(for: aSelector) }
    }
}
