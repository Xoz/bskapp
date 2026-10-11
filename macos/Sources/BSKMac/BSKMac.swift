import SwiftUI
import WebKit
import AuthenticationServices
import CryptoKit
import Security

@main
struct BSKMacApp: App {
    @StateObject private var browser = BrowserModel()

    var body: some Scene {
        WindowGroup {
            NavigationSplitView {
                VStack(alignment: .leading, spacing: 20) {
                    Label("Bollstanäs SK", systemImage: "sportscourt.fill")
                        .font(.headline).padding(.top, 20)
                    Button { browser.open("/idag") } label: {
                        Label("BSK", systemImage: "soccerball").frame(maxWidth: .infinity, alignment: .leading)
                    }
                    Button { browser.open("/utveckling/") } label: {
                        Label("Spelarutveckling", systemImage: "chart.line.uptrend.xyaxis").frame(maxWidth: .infinity, alignment: .leading)
                    }
                    Spacer()
                    Text("Samma uppgifter som på webben")
                        .font(.caption).foregroundStyle(.secondary)
                    Button { Task { await browser.signIn() } } label: {
                        Label("Logga in med Google", systemImage: "person.crop.circle")
                    }.disabled(browser.signingIn)
                }.buttonStyle(.plain).padding().navigationSplitViewColumnWidth(220)
            } detail: {
                ZStack(alignment: .top) {
                    BrowserView(model: browser)
                    if browser.loading || browser.signingIn {
                        ProgressView().controlSize(.small).padding(10)
                            .background(.regularMaterial, in: Capsule()).padding()
                    }
                    if let error = browser.error {
                        VStack(spacing: 10) {
                            Text(error).multilineTextAlignment(.center)
                            HStack {
                                Button("Försök igen") { browser.error = nil; browser.webView.reload() }
                                Button("Öppna webben") { NSWorkspace.shared.open(browser.webView.url ?? BrowserModel.baseURL) }
                                Button("Stäng") { browser.error = nil }
                            }
                        }.padding().background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))
                            .padding(30)
                    }
                }
                .toolbar {
                    ToolbarItemGroup {
                        Button { browser.webView.goBack() } label: { Image(systemName: "chevron.left") }
                            .disabled(!browser.canGoBack).help("Tillbaka")
                        Button { browser.webView.goForward() } label: { Image(systemName: "chevron.right") }
                            .disabled(!browser.canGoForward).help("Framåt")
                        Button { browser.webView.reload() } label: { Image(systemName: "arrow.clockwise") }
                            .help("Hämta senaste uppgifterna").keyboardShortcut("r")
                    }
                }
            }.frame(minWidth: 900, minHeight: 620)
        }.defaultSize(width: 1280, height: 840)
        .commands {
            CommandGroup(replacing: .newItem) { }
            CommandMenu("BSK") {
                Button("BSK") { browser.open("/idag") }.keyboardShortcut("1")
                Button("Spelarutveckling") { browser.open("/utveckling/") }.keyboardShortcut("2")
                Divider()
                Button("Logga in med Google") { Task { await browser.signIn() } }.disabled(browser.signingIn)
            }
        }
    }
}

struct BrowserView: NSViewRepresentable {
    @ObservedObject var model: BrowserModel
    func makeNSView(context: Context) -> WKWebView { model.webView }
    func updateNSView(_ view: WKWebView, context: Context) { }
}

@MainActor
final class BrowserModel: NSObject, ObservableObject, WKNavigationDelegate, WKUIDelegate,
    ASWebAuthenticationPresentationContextProviding, WKDownloadDelegate {
    static let baseURL = URL(string: "https://bsk2014.se")!
    @Published var loading = false
    @Published var signingIn = false
    @Published var canGoBack = false
    @Published var canGoForward = false
    @Published var error: String?
    let webView: WKWebView
    private var authSession: ASWebAuthenticationSession?
    private var observations: [NSKeyValueObservation] = []
    private var downloads: [WKDownload] = []
    private let network = URLSession(configuration: .ephemeral)

    override init() {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        webView = WKWebView(frame: .zero, configuration: configuration)
        super.init()
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        observations = [
            webView.observe(\.isLoading, options: [.new]) { [weak self] view, _ in
                Task { @MainActor in self?.loading = view.isLoading }
            },
            webView.observe(\.canGoBack, options: [.new]) { [weak self] view, _ in
                Task { @MainActor in self?.canGoBack = view.canGoBack }
            },
            webView.observe(\.canGoForward, options: [.new]) { [weak self] view, _ in
                Task { @MainActor in self?.canGoForward = view.canGoForward }
            }
        ]
        open("/idag")
    }

    func open(_ path: String) {
        error = nil
        webView.load(URLRequest(url: Self.baseURL.appendingPathComponent(path)))
    }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping @MainActor @Sendable (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { decisionHandler(.cancel); return }
        if url.scheme == "https", url.host == Self.baseURL.host {
            if url.path == "/api/auth/google" {
                decisionHandler(.cancel)
                Task { await signIn() }
            } else if action.shouldPerformDownload {
                decisionHandler(.download)
            } else {
                decisionHandler(.allow)
            }
        } else if action.targetFrame?.isMainFrame == false {
            decisionHandler(.allow)
        } else {
            decisionHandler(.cancel)
            if ["https", "http", "mailto", "tel"].contains(url.scheme ?? "") {
                NSWorkspace.shared.open(url)
            }
        }
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = action.request.url, url.scheme == "https", url.host == Self.baseURL.host {
            webView.load(action.request)
        } else if let url = action.request.url, ["https", "http", "mailto"].contains(url.scheme ?? "") {
            NSWorkspace.shared.open(url)
        }
        return nil
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        report(error)
    }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { report(error) }
    private func report(_ failure: Error) {
        guard (failure as NSError).code != NSURLErrorCancelled else { return }
        error = "Kunde inte ansluta till BSK. Kontrollera internetanslutningen och försök igen."
    }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        error = "Vyn stängdes av macOS. Tryck på Försök igen för att öppna den."
    }

    func webView(_ webView: WKWebView, decidePolicyFor response: WKNavigationResponse,
                 decisionHandler: @escaping @MainActor @Sendable (WKNavigationResponsePolicy) -> Void) {
        decisionHandler(response.canShowMIMEType ? .allow : .download)
    }
    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
        downloads.append(download); download.delegate = self
    }
    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
        downloads.append(download); download.delegate = self
    }
    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse,
                  suggestedFilename: String, completionHandler: @escaping @MainActor @Sendable (URL?) -> Void) {
        let panel = NSSavePanel()
        panel.nameFieldStringValue = suggestedFilename
        panel.begin { result in completionHandler(result == .OK ? panel.url : nil) }
    }
    func downloadDidFinish(_ download: WKDownload) { downloads.removeAll { $0 === download } }
    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        downloads.removeAll { $0 === download }
        self.error = "Filen kunde inte hämtas. Försök igen."
    }
    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping @MainActor @Sendable ([URL]?) -> Void) {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        panel.canChooseDirectories = parameters.allowsDirectories
        panel.begin { result in completionHandler(result == .OK ? panel.urls : nil) }
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        webView.window ?? NSApplication.shared.keyWindow ?? ASPresentationAnchor()
    }

    func signIn() async {
        guard !signingIn else { return }
        signingIn = true; error = nil
        defer { signingIn = false }
        do {
            var random = [UInt8](repeating: 0, count: 32)
            guard SecRandomCopyBytes(kSecRandomDefault, random.count, &random) == errSecSuccess else {
                throw LoginError.failed
            }
            let verifier = Data(random).base64URL
            let challenge = Data(SHA256.hash(data: Data(verifier.utf8))).base64URL
            let (startData, _) = try await post("/api/mobile/v1/auth/google/start", body: ["codeChallenge": challenge])
            let start = try JSONDecoder().decode(StartEnvelope.self, from: startData)
            guard start.data.authorizationUrl.scheme == "https", start.data.authorizationUrl.host == "accounts.google.com" else {
                throw LoginError.failed
            }
            let callback = try await authenticate(start.data.authorizationUrl)
            guard callback.scheme == "se.bsk2014.app", callback.host == "auth", callback.path == "/callback",
                  let code = URLComponents(url: callback, resolvingAgainstBaseURL: false)?.queryItems?.first(where: { $0.name == "code" })?.value else {
                throw LoginError.failed
            }
            let (data, response) = try await post("/api/auth/desktop/exchange", body: ["code": code, "codeVerifier": verifier])
            let result = try JSONDecoder().decode(Exchange.self, from: data)
            let cookies = HTTPCookie.cookies(withResponseHeaderFields: response.allHeaderFields.reduce(into: [String: String]()) {
                if let key = $1.key as? String, let value = $1.value as? String { $0[key] = value }
            }, for: Self.baseURL)
            guard cookies.contains(where: { $0.name == "bsk_session" && $0.isSecure && $0.isHTTPOnly }) else {
                throw LoginError.failed
            }
            // HttpOnly-cookies går direkt till WebKit, aldrig via JavaScript eller filer.
            let store = webView.configuration.websiteDataStore.httpCookieStore
            for cookie in cookies { await store.setCookie(cookie) }
            open(result.destination == "/mina-spelare" ? "/mina-spelare" : "/idag")
        } catch let failure as ASWebAuthenticationSessionError where failure.code == .canceledLogin {
            // Användaren stängde inloggningsfönstret.
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func post(_ path: String, body: [String: String]) async throws -> (Data, HTTPURLResponse) {
        var request = URLRequest(url: Self.baseURL.appendingPathComponent(path))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)
        request.timeoutInterval = 30
        let (data, response) = try await network.data(for: request)
        guard let response = response as? HTTPURLResponse else { throw LoginError.failed }
        if response.statusCode == 404 { throw LoginError.serverUpdate }
        guard response.statusCode == 200 else { throw LoginError.failed }
        return (data, response)
    }

    private func authenticate(_ url: URL) async throws -> URL {
        try await withCheckedThrowingContinuation { continuation in
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: "se.bsk2014.app") { callback, error in
                Task { @MainActor in self.authSession = nil }
                if let callback { continuation.resume(returning: callback) }
                else { continuation.resume(throwing: error ?? LoginError.failed) }
            }
            session.presentationContextProvider = self
            authSession = session
            if !session.start() { authSession = nil; continuation.resume(throwing: LoginError.failed) }
        }
    }
}

private struct StartEnvelope: Decodable {
    struct Payload: Decodable { let authorizationUrl: URL }
    let data: Payload
}
private struct Exchange: Decodable { let destination: String }
private enum LoginError: LocalizedError {
    case failed, serverUpdate
    var errorDescription: String? {
        switch self {
        case .failed: "Inloggningen kunde inte slutföras. Försök igen."
        case .serverUpdate: "Servern behöver uppdateras med stödet för Mac-inloggning. Du kan använda Öppna webben tills dess."
        }
    }
}
private extension Data {
    var base64URL: String {
        base64EncodedString().replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
    }
}
