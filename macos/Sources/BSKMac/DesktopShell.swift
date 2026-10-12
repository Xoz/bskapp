import SwiftUI
import AppKit
import WebKit

enum Studio {
    static let control = Color(white: 0.36)
    static let paper = Color(white: 0.105)
    static let surface = Color(white: 0.14)
    static let sidebar = Color(white: 0.12)
    static let ink = Color(white: 0.92)
    static let muted = Color(white: 0.62)
    static let accent = Color(white: 0.78)
    static let line = Color(white: 0.24)
}

struct Destination: Identifiable {
    let path: String
    let title: String
    let symbol: String
    var id: String { path }
    static let workspace = [
        Destination(path: "/idag", title: "Förberedelser", symbol: "rectangle.stack"),
        Destination(path: "/uppfoljning", title: "Uppföljning", symbol: "checklist"),
        Destination(path: "/samtal", title: "Spelarsamtal", symbol: "bubble.left.and.bubble.right")
    ]
    static let insights = [
        Destination(path: "/traning", title: "Träningspass", symbol: "figure.soccer"),
        Destination(path: "/matcher", title: "Matcher", symbol: "sportscourt"),
        Destination(path: "/spelare", title: "Spelare", symbol: "person.2"),
        Destination(path: "/utveckling", title: "Utveckling", symbol: "chart.xyaxis.line"),
        Destination(path: "/statistik", title: "Statistik", symbol: "chart.bar.xaxis")
    ]
    static let tools = [
        Destination(path: "/administration", title: "Administration", symbol: "slider.horizontal.3"),
        Destination(path: "/installningar", title: "Inställningar", symbol: "gearshape"),
        Destination(path: "/guide", title: "Guide", symbol: "book.closed")
    ]
}

@main
struct BSKMacApp: App {
    @NSApplicationDelegateAdaptor(MacAppDelegate.self) private var appDelegate
    @StateObject private var browser = BrowserModel()
    var body: some Scene {
        WindowGroup {
            DesktopShell(browser: browser)
                .background(NativeWindowGuard(browser: browser))
                .onAppear { appDelegate.browser = browser }
                .frame(minWidth: browser.nativeEditor?.route.kind == "training" ? 1000 : 880, minHeight: 620)
                .preferredColorScheme(.dark)
                .environment(\.locale, Locale(identifier: "sv_SE"))
        }
        .windowStyle(.titleBar)
        .windowToolbarStyle(.unified)
        .defaultSize(width: 1380, height: 900)
        .commands {
            CommandGroup(replacing: .newItem) { }
            CommandMenu("Arbetsyta") {
                ForEach(Array(Destination.workspace.enumerated()), id: \.element.id) { index, destination in
                    Button(destination.title) { browser.open(destination.path) }
                        .keyboardShortcut(KeyEquivalent(Character(String(index + 1))))
                        .disabled(!canOpen(destination, browser))
                }
                Divider()
                Button("Utveckling") { browser.open("/utveckling") }.keyboardShortcut("5")
                    .disabled(!browser.availablePaths.contains("/spelare"))
                Button("Uppdatera") { browser.reload() }.keyboardShortcut("r")
                Button("Tillbaka") { browser.goBack() }.keyboardShortcut("[", modifiers: .command)
                    .disabled(!browser.canGoBack && browser.nativeEditor == nil && browser.nativeWorkday == nil)
                Button("Framåt") { browser.webView.goForward() }.keyboardShortcut("]", modifiers: .command)
                    .disabled(!browser.canGoForward || browser.nativeEditor != nil || browser.nativeWorkday != nil)
                Divider()
                Button("Sök och gå till…") { browser.commandPalette=true }.keyboardShortcut("k")
                Button("Offline och synk") { OfflineStore.shared.panel=true }.keyboardShortcut("o",modifiers:[.command,.shift])
                Button("Verktyg och konto") { browser.showAccount() }.disabled(!browser.signedIn)
            }
        }
    }
}

@MainActor
func canOpen(_ destination: Destination, _ browser: BrowserModel) -> Bool {
    if destination.path == "/idag" { return browser.availablePaths.contains("/matcher") || browser.availablePaths.contains("/traning") || browser.availablePaths.contains("/spelare") }
    if ["/uppfoljning", "/samtal"].contains(destination.path) { return browser.availablePaths.contains("/spelare") }
    if destination.path == "/utveckling" { return browser.availablePaths.contains("/spelare") }
    return browser.availablePaths.contains(destination.path)
}

struct DesktopShell: View {
    @ObservedObject var browser: BrowserModel
    @ObservedObject private var offlineStore = OfflineStore.shared
    @State private var sidebarVisible = true
    @State private var accountMenuOpen = false
    private var native: Bool { browser.showWorkbench || browser.showPractice || browser.showMatchDirectory || browser.nativeEditor != nil || browser.nativeWorkday != nil }
    var body: some View {
        HSplitView {
            if sidebarVisible { sidebar.frame(minWidth:190,idealWidth:210,maxWidth:260) }
            VStack(spacing:0) {
                if !native && browser.signedIn {
                    HStack { Label("Klubbverktyg",systemImage:"globe"); Spacer(); Text("Kräver uppkoppling").foregroundStyle(Studio.muted) }.font(.caption).padding(10)
                }
                ZStack(alignment:.top) {
                    BrowserView(model:browser).opacity(native ? 0:1).accessibilityHidden(native)
                    if browser.showWorkbench { WorkbenchView(browser:browser) }
                    if browser.showPractice { PracticeView(browser:browser).id(browser.currentPath) }
                    if browser.showMatchDirectory { NativeMatchDirectory(browser:browser) }
                    if let page=browser.nativeWorkday { NativeWorkdayView(browser:browser,session:page).id(ObjectIdentifier(page)) }
                    if let editor=browser.nativeEditor { NativeEditorView(browser:browser,session:editor).id(ObjectIdentifier(editor)) }
                    if browser.loading { ProgressView().controlSize(.small).padding(12) }
                    if browser.signingIn { Label("Slutför inloggningen i Google-fönstret",systemImage:"person.crop.circle").padding().background(.regularMaterial,in:RoundedRectangle(cornerRadius:8)) }
                    if let error=browser.error {
                        VStack(alignment:.leading,spacing:12) {
                            Label("Anslutningen avbröts",systemImage:"wifi.exclamationmark").font(.headline)
                            Text(error).font(.callout).textSelection(.enabled)
                            HStack { Button("Försök igen"){browser.reload()}; Button("Stäng"){browser.error=nil} }
                        }.padding(20).frame(maxWidth:460).background(.regularMaterial,in:RoundedRectangle(cornerRadius:10)).padding()
                    }
                }.frame(maxWidth:.infinity,maxHeight:.infinity)
                OfflineStatusBar(browser:browser)
            }.frame(minWidth:620).background(Studio.paper)
        }
        .foregroundStyle(Studio.ink).background(Studio.paper).tint(Studio.accent)
        .navigationTitle(browser.showWorkbench ? (browser.currentPath=="/uppfoljning" ? "Uppföljning":"Förberedelser"):(browser.pageTitle.isEmpty ? "BSK":browser.pageTitle))
        .toolbar {
            ToolbarItem(placement:.navigation) { Button{sidebarVisible.toggle()}label:{Image(systemName:"sidebar.left")}.help("Visa eller dölj sidofältet") }
            ToolbarItemGroup(placement:.navigation) {
                Button{browser.goBack()}label:{Image(systemName:"chevron.left")}.disabled(!browser.canGoBack && browser.nativeEditor==nil && browser.nativeWorkday==nil).help("Tillbaka")
            }
            ToolbarItemGroup(placement:.primaryAction) {
                Button{browser.commandPalette=true}label:{Image(systemName:"magnifyingglass")}.disabled(!browser.signedIn).help("Sök och gå till · ⌘K")
                Button{browser.reload()}label:{Image(systemName:"arrow.clockwise")}.help("Uppdatera · ⌘R")
            }
        }
        .sheet(isPresented:$browser.commandPalette){NativeCommandPalette(browser:browser)}
        .sheet(isPresented:$offlineStore.panel){OfflinePanel(browser:browser)}
        .task{while !Task.isCancelled{try? await Task.sleep(for:.seconds(30));if browser.signedIn,offlineStore.offline,!offlineStore.manualOffline,!offlineStore.syncing{browser.webView.reload();await browser.establishOfflineIdentity();if !offlineStore.offline{await browser.syncOffline()}}}}
    }
    private var sidebar: some View {
        VStack(spacing:0) {
            HStack(spacing:8) { Image(systemName:"sportscourt"); Text("BSK").font(.headline); Text("F2014").foregroundStyle(Studio.muted); Spacer() }.padding(16)
            List {
                if browser.signedIn {
                    Section("Arbetsflöden") { ForEach(Destination.workspace.filter{canOpen($0,browser)}){row($0)} }
                    Section("Bibliotek") { ForEach(Destination.insights.filter{canOpen($0,browser)}){row($0)} }
                    if browser.availablePaths.contains("/mina-spelare") && !browser.availablePaths.contains("/spelare") {row(Destination(path:"/mina-spelare",title:"Mina spelare",symbol:"person.2"))}
                    Section("Klubbverktyg") { ForEach(Destination.tools.filter{canOpen($0,browser)}){row($0)} }
                } else {
                    Text("Förberedelser, uppföljning och spelarsamtal.").font(.callout).foregroundStyle(Studio.muted)
                    Button("Logga in med Google"){Task{await browser.signIn()}}.disabled(browser.signingIn)
                }
            }.listStyle(.sidebar).scrollContentBackground(.hidden)
            Divider()
            Menu {
                Button("Verktyg och konto"){browser.showAccount()}
                Button("Offline och synk"){offlineStore.panel=true}
                Divider()
                Button("Logga ut"){browser.signOut()}
            } label: {
                HStack { Image(systemName:"person.crop.circle"); Text(browser.userName.isEmpty ? "Mitt konto":browser.userName); Spacer() }.font(.callout)
            }.menuStyle(.borderlessButton).padding(14).disabled(!browser.signedIn)
        }.background(Studio.sidebar)
    }
    private func row(_ destination:Destination)->some View {
        let active=browser.currentPath==destination.path || browser.currentPath.hasPrefix(destination.path+"/")
        return Button{browser.open(destination.path)}label:{Label(destination.title,systemImage:destination.symbol).frame(maxWidth:.infinity,alignment:.leading).padding(.vertical,3).contentShape(Rectangle())}
            .buttonStyle(.plain).listRowBackground(active ? Studio.line:Color.clear).accessibilityAddTraits(active ? [.isSelected]:[])
    }
}

struct BrowserView: NSViewRepresentable {
    @ObservedObject var model: BrowserModel
    func makeNSView(context: Context) -> WKWebView { model.webView }
    func updateNSView(_ view: WKWebView, context: Context) { }
}

@MainActor
final class MacAppDelegate: NSObject, NSApplicationDelegate {
    weak var browser: BrowserModel?
    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        if browser?.hasConfirmedClose == true { return .terminateNow }
        return browser?.confirmLeavingEditor() == false ? .terminateCancel : .terminateNow
    }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
}
