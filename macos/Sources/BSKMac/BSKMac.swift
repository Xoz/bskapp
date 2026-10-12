import SwiftUI
import WebKit
import AuthenticationServices
import CryptoKit
import Security

@MainActor
final class BrowserModel: NSObject, ObservableObject, WKNavigationDelegate, WKUIDelegate,
    ASWebAuthenticationPresentationContextProviding, WKDownloadDelegate, WKScriptMessageHandler {
    static let baseURL: URL = {
        #if DEBUG
        // A separate debug bundle may target synthetic localhost data only.
        if let value = Bundle.main.object(forInfoDictionaryKey: "BSKQABaseURL") as? String,
           let url = URL(string: value), url.scheme == "http", ["127.0.0.1", "localhost"].contains(url.host ?? "") {
            return url
        }
        #endif
        return URL(string: "https://bsk2014.se")!
    }()
    @Published var loading = false
    @Published var signingIn = false
    @Published var canGoBack = false
    @Published var canGoForward = false
    @Published var error: String?
    @Published var currentPath = "/idag"
    @Published var pageTitle = "Idag"
    @Published var userName = ""
    @Published var signedIn = false
    @Published var availablePaths: Set<String> = []
    @Published var progress: Double = 0
    @Published var hasLoaded = false
    @Published var darkAppearance = false
    @Published var workspace: Workspace?
    @Published var workspaceLoading = false
    @Published var workspaceError: String?
    @Published var workflowStage: WorkflowStage = .prepare
    private var workspaceTask: Task<Void, Never>?
    private var workspaceGeneration = UUID()
    private var workflowMatchID: Int?
    private var lastReportedPlanSaved = false
    private var lastReportedPath = ""
    var showWorkbench: Bool { signedIn && currentPath == "/idag" && availablePaths.contains("/matcher") }
    var currentWorkflowMatch: WorkflowMatch? {
        guard signedIn, let id = WorkflowMatch.matchID(in: currentPath) else { return nil }
        return workspace?.matches.first { $0.id == id }
    }
    let webView: WKWebView
    private var authSession: ASWebAuthenticationSession?
    private var observations: [NSKeyValueObservation] = []
    private var downloads: [WKDownload] = []
    private let network = URLSession(configuration: .ephemeral)

    init(loadInitialPage: Bool = true, dataStore: WKWebsiteDataStore = .default()) {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = Self.baseURL.scheme == "http" ? .nonPersistent() : dataStore
        if let theme = Bundle.main.url(forResource: "DesktopTheme", withExtension: "css"),
           let script = Bundle.main.url(forResource: "DesktopBridge", withExtension: "js"),
           let css = try? String(contentsOf: theme, encoding: .utf8),
           let bundledJS = try? String(contentsOf: script, encoding: .utf8),
           let json = try? JSONSerialization.data(withJSONObject: [css]),
           let encoded = String(data: json, encoding: .utf8) {
            var js = bundledJS
            #if DEBUG
            if Self.baseURL.scheme == "http" {
                js = js.replacingOccurrences(of: "https://bsk2014.se", with: Self.baseURL.absoluteString)
            }
            #endif
            let source = "window.__bskDesktopCSS = " + encoded + "[0];\n" + js
            configuration.userContentController.addUserScript(WKUserScript(source: source, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
        webView = WKWebView(frame: .zero, configuration: configuration)
        super.init()
        configuration.userContentController.add(WeakScriptHandler(self), name: "bskDesktop")
        webView.underPageBackgroundColor = NSColor(red: 0.969, green: 0.965, blue: 0.949, alpha: 1)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        observations = [
            webView.observe(\.estimatedProgress, options: [.new]) { [weak self] view, _ in
                Task { @MainActor in self?.progress = view.estimatedProgress }
            },
            webView.observe(\.url, options: [.new]) { [weak self] view, _ in
                Task { @MainActor in
                    guard let url = view.url, url.host == Self.baseURL.host else { return }
                    self?.currentPath = url.path
                    self?.setWorkflowStage(for: url.path)
                }
            },
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
        if loadInitialPage { open(Self.baseURL.scheme == "http" ? "/api/auth/dev" : "/idag") }
    }

    func open(_ path: String) {
        guard let url = URL(string: path, relativeTo: Self.baseURL)?.absoluteURL,
              url.scheme == Self.baseURL.scheme, url.host == Self.baseURL.host, url.port == Self.baseURL.port else { return }
        error = nil
        webView.load(URLRequest(url: url))
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame,
              message.frameInfo.securityOrigin.host == Self.baseURL.host,
              message.frameInfo.securityOrigin.protocol == Self.baseURL.scheme,
              let body = message.body as? [String: Any] else { return }
        if let path = body["path"] as? String { currentPath = String(path.prefix(300)) }
        if let title = body["title"] as? String { pageTitle = String(title.prefix(100)) }
        if let user = body["user"] as? String { userName = String(user.prefix(80)) }
        let previouslySignedIn = signedIn
        signedIn = body["signedIn"] as? Bool ?? false
        darkAppearance = body["dark"] as? Bool ?? false
        availablePaths = Set((body["paths"] as? [String] ?? []).filter { $0.hasPrefix("/") && !$0.hasPrefix("//") })
        hasLoaded = true
        let planSaved = body["planSaved"] as? Bool ?? false
        let pathChanged = currentPath != lastReportedPath
        lastReportedPath = currentPath
        if signedIn && previouslySignedIn && (pathChanged || (planSaved && !lastReportedPlanSaved)) { refreshWorkspace() }
        lastReportedPlanSaved = planSaved
        if !signedIn {
            workflowMatchID = nil
            workspaceGeneration = UUID(); workspaceTask?.cancel(); workspace = nil
            workspaceError = nil; workspaceLoading = false
        } else if !previouslySignedIn { refreshWorkspace() }
    }

    func setWorkflowStage(for path: String) {
        let id = WorkflowMatch.matchID(in: path)
        if id != workflowMatchID {
            workflowMatchID = id
            workflowStage = currentWorkflowMatch?.stage ?? .prepare
        }
        if path.hasSuffix("/utvardera") { workflowStage = .review }
        else if path.hasSuffix("/live") || path.hasSuffix("/observera") { workflowStage = .perform }
        else if path.hasSuffix("/laguttagning") || path.hasSuffix("/matchutrymme") { workflowStage = .prepare }
    }

    func refreshWorkspace() {
        guard signedIn, availablePaths.contains("/matcher") else { return }
        workspaceTask?.cancel()
        let generation = UUID(); workspaceGeneration = generation
        workspaceLoading = true; workspaceError = nil
        let matchID = WorkflowMatch.matchID(in: currentPath)
        workspaceTask = Task { @MainActor [weak self] in
            guard let self else { return }
            do {
                let path = "/api/desktop/workspace" + (matchID.map { "?match=\($0)" } ?? "")
                let result = try await webView.callAsyncJavaScript("""
                    if (location.origin !== origin) throw new Error('origin');
                    const response = await fetch(path, {cache: 'no-store', credentials: 'same-origin', redirect: 'error'});
                    if (!response.ok) throw new Error('HTTP ' + response.status);
                    return await response.text();
                    """, arguments: ["path": path, "origin": Self.baseURL.absoluteString], in: nil, contentWorld: .page)
                guard !Task.isCancelled, generation == workspaceGeneration, signedIn,
                      let json = result as? String else { return }
                workspace = try JSONDecoder().decode(Workspace.self, from: Data(json.utf8))
                workspaceLoading = false
                setWorkflowStage(for: currentPath)
                if currentWorkflowMatch != nil {
                    webView.evaluateJavaScript("document.documentElement.dataset.bskWorkflow = 'true'", completionHandler: nil)
                }
            } catch {
                guard !Task.isCancelled, generation == workspaceGeneration, signedIn else { return }
                workspace = nil; workspaceLoading = false
                webView.evaluateJavaScript("document.documentElement.dataset.bskWorkflow = 'false'", completionHandler: nil)
                workspaceError = "Kontrollera anslutningen och försök igen. Du kan fortfarande öppna lagets övriga vyer i sidomenyn."
            }
        }
    }

    func reload() {
        error = nil
        if webView.url != nil { webView.reload() }
        else { open(Self.baseURL.scheme == "http" ? "/api/auth/dev" : "/idag") }
    }

    func signOut() {
        workspaceGeneration = UUID(); workspaceTask?.cancel(); workspace = nil
        webView.evaluateJavaScript("document.querySelector('.bsk-header-actions form')?.requestSubmit()", completionHandler: nil)
    }

    func showAccount() {
        webView.evaluateJavaScript("document.querySelector('[aria-label=\"Öppna verktyg och konto\"]')?.click()", completionHandler: nil)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        hasLoaded = true
        refreshWorkspace()
    }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping @MainActor @Sendable (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { decisionHandler(.cancel); return }
        if url.scheme == Self.baseURL.scheme, url.host == Self.baseURL.host, url.port == Self.baseURL.port {
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
        if let url = action.request.url, url.scheme == Self.baseURL.scheme, url.host == Self.baseURL.host, url.port == Self.baseURL.port {
            webView.load(action.request)
        } else if let url = action.request.url, ["https", "http", "mailto"].contains(url.scheme ?? "") {
            NSWorkspace.shared.open(url)
        }
        return nil
    }

    // WebKit does not present JavaScript dialogs automatically in a native app.
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping @MainActor () -> Void) {
        let alert = webAlert(message)
        alert.addButton(withTitle: "OK")
        present(alert, for: webView) { _ in completionHandler() }
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping @MainActor (Bool) -> Void) {
        let alert = webAlert(message)
        alert.addButton(withTitle: "Fortsätt")
        alert.addButton(withTitle: "Avbryt")
        alert.buttons.last?.keyEquivalent = "\u{1b}"
        present(alert, for: webView) { completionHandler($0 == .alertFirstButtonReturn) }
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String,
                 defaultText: String?, initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping @MainActor (String?) -> Void) {
        let alert = webAlert(prompt)
        let input = NSTextField(string: defaultText ?? "")
        input.frame = NSRect(x: 0, y: 0, width: 300, height: 24)
        alert.accessoryView = input
        alert.addButton(withTitle: "OK")
        alert.addButton(withTitle: "Avbryt")
        alert.buttons.last?.keyEquivalent = "\u{1b}"
        present(alert, for: webView) { completionHandler($0 == .alertFirstButtonReturn ? input.stringValue : nil) }
    }

    private func webAlert(_ message: String) -> NSAlert {
        let alert = NSAlert()
        alert.messageText = "BSK"
        alert.informativeText = message
        return alert
    }

    private func present(_ alert: NSAlert, for webView: WKWebView,
                         completion: @escaping @MainActor (NSApplication.ModalResponse) -> Void) {
        guard let window = webView.window else { completion(.alertSecondButtonReturn); return }
        alert.beginSheetModal(for: window, completionHandler: completion)
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
        decisionHandler(Self.shouldDownload(response.response, canShowMIMEType: response.canShowMIMEType) ? .download : .allow)
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
    static func shouldDownload(_ response: URLResponse, canShowMIMEType: Bool) -> Bool {
        let disposition = (response as? HTTPURLResponse)?.value(forHTTPHeaderField: "Content-Disposition") ?? ""
        return !canShowMIMEType || disposition.split(separator: ";", maxSplits: 1).first?.trimmingCharacters(in: .whitespaces).lowercased() == "attachment"
    }
    func downloadDidFinish(_ download: WKDownload) { downloads.removeAll { $0 === download } }
    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        downloads.removeAll { $0 === download }
        guard (error as NSError).code != NSURLErrorCancelled else { return }
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
        NSApplication.shared.activate(ignoringOtherApps: true)
        return try await withCheckedThrowingContinuation { continuation in
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: "se.bsk2014.app") { callback, error in
                Task { @MainActor in self.authSession = nil }
                if let callback { continuation.resume(returning: callback) }
                else { continuation.resume(throwing: error ?? LoginError.failed) }
            }
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = true
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

@MainActor
private final class WeakScriptHandler: NSObject, WKScriptMessageHandler {
    weak var owner: BrowserModel?
    init(_ owner: BrowserModel) { self.owner = owner }
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        owner?.userContentController(controller, didReceive: message)
    }
}
