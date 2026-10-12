import SwiftUI
import AppKit
import WebKit

enum Studio {
    static let forest = Color(red: 0.067, green: 0.157, blue: 0.133)
    static let paper = adaptive(light: (0.969, 0.965, 0.949), dark: (0.094, 0.137, 0.122))
    static let ink = adaptive(light: (0.13, 0.19, 0.16), dark: (0.91, 0.93, 0.89))
    static let muted = adaptive(light: (0.44, 0.48, 0.44), dark: (0.61, 0.67, 0.59))
    static let gold = Color(red: 0.81, green: 0.72, blue: 0.49)
    static let line = adaptive(light: (0.87, 0.88, 0.85), dark: (0.20, 0.27, 0.23))
    private static func adaptive(light: (Double, Double, Double), dark: (Double, Double, Double)) -> Color {
        Color(nsColor: NSColor(name: nil) { appearance in
            let values = appearance.bestMatch(from: [.aqua, .darkAqua]) == .darkAqua ? dark : light
            return NSColor(red: values.0, green: values.1, blue: values.2, alpha: 1)
        })
    }
}

struct Destination: Identifiable {
    let path: String
    let title: String
    let symbol: String
    var id: String { path }
    static let workspace = [
        Destination(path: "/idag", title: "Arbetsbord", symbol: "square.grid.2x2"),
        Destination(path: "/spelare", title: "Spelare", symbol: "person.2"),
        Destination(path: "/matcher", title: "Matcher", symbol: "sportscourt"),
        Destination(path: "/traning", title: "Träning", symbol: "figure.soccer")
    ]
    static let insights = [
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
                .frame(minWidth: 880, minHeight: 620)
                .preferredColorScheme(browser.darkAppearance ? .dark : .light)
                .environment(\.locale, Locale(identifier: "sv_SE"))
        }
        .windowStyle(.hiddenTitleBar)
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
                Button("Tillbaka") { browser.webView.goBack() }.keyboardShortcut("[", modifiers: .command)
                    .disabled(!browser.canGoBack)
                Button("Framåt") { browser.webView.goForward() }.keyboardShortcut("]", modifiers: .command)
                    .disabled(!browser.canGoForward)
                Divider()
                Button("Verktyg och konto") { browser.showAccount() }.disabled(!browser.signedIn)
            }
        }
    }
}

@MainActor
private func canOpen(_ destination: Destination, _ browser: BrowserModel) -> Bool {
    if destination.path == "/utveckling" { return browser.availablePaths.contains("/spelare") }
    return browser.availablePaths.contains(destination.path)
}

struct DesktopShell: View {
    @ObservedObject var browser: BrowserModel
    @State private var sidebarVisible = true
    @State private var accountMenuOpen = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var body: some View {
        HStack(spacing: 0) {
            if sidebarVisible {
                sidebar.frame(width: 238).transition(.move(edge: .leading).combined(with: .opacity))
            }
            VStack(spacing: 0) {
                topbar
                if let match = browser.currentWorkflowMatch { MatchWorkflowBar(browser: browser, match: match) }
                if browser.signedIn { PracticeWorkflowBar(browser: browser) }
                ZStack(alignment: .top) {
                    BrowserView(model: browser).opacity((browser.showWorkbench || browser.showPractice) ? 0 : 1).accessibilityHidden(browser.showWorkbench || browser.showPractice)
                    if browser.showWorkbench { WorkbenchView(browser: browser) }
                    if browser.showPractice { PracticeView(browser: browser).id(browser.currentPath) }
                    if browser.loading {
                        GeometryReader { proxy in
                            Rectangle().fill(Studio.gold)
                                .frame(width: proxy.size.width * max(browser.progress, 0.04), height: 2)
                                .animation(.easeOut(duration: 0.3), value: browser.progress)
                        }.frame(height: 2).accessibilityHidden(true)
                    }
                    if browser.signingIn { signInOverlay }
                    if let error = browser.error { errorCard(error).padding(28) }
                }
                footer
            }.background(Studio.paper)
        }
        .background(Studio.paper)
        .tint(Studio.forest)
    }

    private var sidebar: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 12) {
                if let image = NSImage(contentsOf: Bundle.main.url(forResource: "ClubCrest", withExtension: "png") ?? URL(fileURLWithPath: "/nonexistent")) {
                    Image(nsImage: image).resizable().scaledToFit().frame(width: 36, height: 42)
                } else { Image(systemName: "sportscourt").font(.system(size: 26)).foregroundStyle(Studio.gold) }
                VStack(alignment: .leading, spacing: 4) {
                    Text("BOLLSTANÄS").font(.system(size: 12, weight: .semibold)).tracking(2.1)
                    Text("Fotboll · F2014").font(.system(size: 11)).foregroundStyle(.white.opacity(0.48))
                }
            }.foregroundStyle(.white.opacity(0.92)).padding(.horizontal, 24).padding(.top, 54).padding(.bottom, 32)
            Rectangle().fill(.white.opacity(0.10)).frame(height: 1).padding(.horizontal, 24)
            ScrollView {
                VStack(alignment: .leading, spacing: 26) {
                    if browser.signedIn {
                        navigationGroup("ARBETA", destinations: Destination.workspace)
                        if browser.availablePaths.contains("/mina-spelare") && !browser.availablePaths.contains("/spelare") {
                            navigationRow(Destination(path: "/mina-spelare", title: "Mina spelare", symbol: "person.2"))
                        }
                        navigationGroup("FÖLJ UPP", destinations: Destination.insights)
                        navigationGroup("KLUBBEN", destinations: Destination.tools)
                    } else {
                        VStack(alignment: .leading, spacing: 14) {
                            sectionLabel("DIN ARBETSYTA")
                            Text("Närmare laget.\nVarje dag.")
                                .font(.system(size: 29, weight: .regular, design: .serif)).lineSpacing(3)
                                .foregroundStyle(.white.opacity(0.9))
                            Text("Matcher, spelarutveckling och samtal. Samlat på din Mac.")
                                .font(.system(size: 12)).lineSpacing(5).foregroundStyle(.white.opacity(0.5))
                        }.padding(.horizontal, 12)
                    }
                }.padding(.horizontal, 12).padding(.top, 28)
            }.scrollIndicators(.hidden)
            Spacer(minLength: 20)
            VStack(alignment: .leading, spacing: 18) {
                HStack(spacing: 7) {
                    Circle().fill(Studio.gold).frame(width: 5, height: 5)
                    Text("BOLLSTANÄS SPORTKLUBB").font(.system(size: 8, weight: .medium)).tracking(1.2)
                }.foregroundStyle(.white.opacity(0.4))
                Rectangle().fill(.white.opacity(0.1)).frame(height: 1)
                if browser.signedIn {
                    Button { accountMenuOpen.toggle() } label: { accountLabel }
                        .buttonStyle(.plain).accessibilityLabel("Konto: " + (browser.userName.isEmpty ? "Mitt konto" : browser.userName))
                        .help("Verktyg, konto och utloggning")
                        .popover(isPresented: $accountMenuOpen, arrowEdge: .top) {
                            VStack(alignment: .leading, spacing: 8) {
                                Text(browser.userName.isEmpty ? "Mitt konto" : browser.userName)
                                    .font(.system(size: 14, weight: .semibold)).padding(.bottom, 7)
                                Button {
                                    accountMenuOpen = false
                                    browser.showAccount()
                                } label: { Label("Verktyg och konto", systemImage: "slider.horizontal.3").frame(maxWidth: .infinity, alignment: .leading) }
                                .buttonStyle(.borderless).padding(.vertical, 7)
                                Divider()
                                Button {
                                    accountMenuOpen = false
                                    browser.signOut()
                                } label: { Label("Logga ut", systemImage: "rectangle.portrait.and.arrow.right").frame(maxWidth: .infinity, alignment: .leading) }
                                .buttonStyle(.borderless).padding(.vertical, 7)
                            }.font(.system(size: 12)).padding(20).frame(width: 230)
                                .foregroundStyle(Studio.ink).background(Studio.paper)
                        }
                } else {
                    Button { Task { await browser.signIn() } } label: { accountLabel }
                        .buttonStyle(.plain).disabled(browser.signingIn).help("Logga in med Google")
                }
            }.padding(.horizontal, 24).padding(.bottom, 24)
        }
        .background(LinearGradient(colors: [Studio.forest, Color(red: 0.047, green: 0.114, blue: 0.098)], startPoint: .topLeading, endPoint: .bottomTrailing))
    }

    private var accountLabel: some View {
        HStack(spacing: 10) {
            ZStack {
                RoundedRectangle(cornerRadius: 12).fill(.white.opacity(0.08))
                if browser.signedIn {
                    Text(browser.userName.isEmpty ? "B" : browser.userName.prefix(1).uppercased())
                        .font(.system(size: 15, weight: .medium, design: .serif))
                } else { Image(systemName: "person.crop.circle").font(.system(size: 17)) }
            }.frame(width: 36, height: 38).foregroundStyle(Studio.gold)
            VStack(alignment: .leading, spacing: 3) {
                Text(browser.signedIn ? (browser.userName.isEmpty ? "Mitt konto" : browser.userName) : "Logga in")
                    .font(.system(size: 12, weight: .medium)).foregroundStyle(.white.opacity(0.92))
                Text(browser.signedIn ? "Verktyg och konto" : "Med ditt Google-konto")
                    .font(.system(size: 10)).foregroundStyle(.white.opacity(0.43))
            }
            Spacer()
            Image(systemName: "ellipsis").foregroundStyle(.white.opacity(0.5))
        }.contentShape(Rectangle())
    }

    private func sectionLabel(_ title: String) -> some View {
        Text(title).font(.system(size: 9, weight: .medium)).tracking(1.8).foregroundStyle(.white.opacity(0.35))
    }
    @ViewBuilder private func navigationGroup(_ title: String, destinations: [Destination]) -> some View {
        let visible = destinations.filter { canOpen($0, browser) }
        if !visible.isEmpty {
            VStack(alignment: .leading, spacing: 7) {
                sectionLabel(title).padding(.leading, 14).padding(.bottom, 5)
                ForEach(visible) { destination in navigationRow(destination) }
            }
        }
    }
    private func navigationRow(_ destination: Destination) -> some View {
        let active = browser.currentPath == destination.path || browser.currentPath.hasPrefix(destination.path + "/")
        return Button { browser.open(destination.path) } label: {
            HStack(spacing: 12) {
                Image(systemName: destination.symbol).font(.system(size: 16, weight: .regular)).frame(width: 21)
                Text(destination.title).font(.system(size: 13, weight: active ? .semibold : .regular))
                Spacer()
                if active { Circle().fill(Studio.gold).frame(width: 4, height: 4) }
            }
            .foregroundStyle(active ? Color.white : Color.white.opacity(0.57))
            .padding(.horizontal, 14).frame(height: 43)
            .background(active ? Color.white.opacity(0.09) : .clear, in: RoundedRectangle(cornerRadius: 9))
            .contentShape(RoundedRectangle(cornerRadius: 9))
        }
        .buttonStyle(SidebarButtonStyle())
        .accessibilityLabel(destination.title)
        .accessibilityAddTraits(active ? [.isSelected] : [])
    }

    private var topbar: some View {
        HStack(spacing: 16) {
            if !sidebarVisible { Spacer().frame(width: 55) }
            Button { withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.2)) { sidebarVisible.toggle() } } label: {
                Image(systemName: "sidebar.left")
            }.buttonStyle(ChromeButtonStyle()).help("Visa eller dölj sidomenyn")
            HStack(spacing: 4) {
                Button { browser.webView.goBack() } label: { Image(systemName: "chevron.left") }
                    .disabled(!browser.canGoBack)
                Button { browser.webView.goForward() } label: { Image(systemName: "chevron.right") }
                    .disabled(!browser.canGoForward)
            }.buttonStyle(ChromeButtonStyle())
            Rectangle().fill(Studio.line).frame(width: 1, height: 17)
            Text("Arbetsyta").foregroundStyle(Studio.muted)
            Image(systemName: "chevron.right").font(.system(size: 8)).foregroundStyle(Studio.muted.opacity(0.7))
            Text(browser.showWorkbench ? "Arbetsbord" : (browser.pageTitle.isEmpty ? "BSK" : browser.pageTitle)).foregroundStyle(Studio.ink).lineLimit(1)
            Spacer(minLength: 10)
            Text(Date.now, format: .dateTime.day().month(.abbreviated).locale(Locale(identifier: "sv_SE")))
                .font(.system(size: 11)).foregroundStyle(Studio.muted)
            Button { browser.reload() } label: { Image(systemName: "arrow.clockwise") }
                .buttonStyle(ChromeButtonStyle()).help("Uppdatera · ⌘R")
        }
        .font(.system(size: 11, weight: .medium))
        .padding(.horizontal, 24).frame(height: 66)
        .background(Studio.paper)
        .overlay(alignment: .bottom) { Rectangle().fill(Studio.line.opacity(0.7)).frame(height: 1) }
    }
    private var footer: some View {
        HStack(spacing: 6) {
            Image(systemName: "lock.shield").font(.system(size: 9))
            Text("BSK · Din gemensamma arbetsyta").font(.system(size: 10))
            Spacer()
            if browser.error != nil { Text("Anslutning saknas") }
            else if browser.loading { Text("Hämtar…") }
            else if browser.signedIn { Text("Ansluten till " + (BrowserModel.baseURL.host ?? "BSK")) }
            else { Text("Bollstanäs SK") }
        }
        .font(.system(size: 10)).foregroundStyle(Studio.muted.opacity(0.85))
        .padding(.horizontal, 28).frame(height: 30)
        .overlay(alignment: .top) { Rectangle().fill(Studio.line.opacity(0.6)).frame(height: 1) }
        .accessibilityElement(children: .combine)
    }
    private var signInOverlay: some View {
        HStack(spacing: 12) {
            ProgressView().controlSize(.small)
            Text("Slutför inloggningen i Google-fönstret").font(.system(size: 12))
        }.padding(18).background(.regularMaterial, in: RoundedRectangle(cornerRadius: 14)).padding(.top, 22)
    }
    private func errorCard(_ message: String) -> some View {
        VStack(alignment: .leading, spacing: 15) {
            Label("Anslutningen avbröts", systemImage: "wifi.exclamationmark").font(.system(size: 16, weight: .semibold))
            Text(message).font(.system(size: 13)).foregroundStyle(Studio.muted).fixedSize(horizontal: false, vertical: true)
            HStack {
                Button("Försök igen") { browser.reload() }.buttonStyle(.borderedProminent)
                Button("Öppna i webbläsaren") { NSWorkspace.shared.open(browser.webView.url ?? BrowserModel.baseURL) }.buttonStyle(.bordered)
                Spacer()
                Button { browser.error = nil } label: { Image(systemName: "xmark") }.buttonStyle(.plain).help("Stäng meddelandet")
            }
        }.padding(24).frame(maxWidth: 520).background(.regularMaterial, in: RoundedRectangle(cornerRadius: 18))
            .overlay(RoundedRectangle(cornerRadius: 18).strokeBorder(Studio.line)).shadow(color: .black.opacity(0.06), radius: 24, y: 10)
    }
}

private struct SidebarButtonStyle: ButtonStyle {
    @State private var hovering = false
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.opacity(configuration.isPressed ? 0.65 : 1)
            .background(hovering ? Color.white.opacity(0.04) : .clear, in: RoundedRectangle(cornerRadius: 9))
            .onHover { hovering = $0 }
    }
}
private struct ChromeButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var enabled
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.font(.system(size: 12, weight: .medium))
            .foregroundStyle(Studio.ink.opacity(enabled ? 0.7 : 0.2)).frame(width: 28, height: 28)
            .background(configuration.isPressed ? Studio.line : .clear, in: RoundedRectangle(cornerRadius: 7))
    }
}
struct BrowserView: NSViewRepresentable {
    @ObservedObject var model: BrowserModel
    func makeNSView(context: Context) -> WKWebView { model.webView }
    func updateNSView(_ view: WKWebView, context: Context) { }
}

@MainActor
final class MacAppDelegate: NSObject, NSApplicationDelegate {
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
}
