import AuthenticationServices
import CryptoKit
import Foundation
import Security
import UIKit

@MainActor
final class NativeAuthService: NSObject, ASWebAuthenticationPresentationContextProviding {
    private let api: APIClient
    private let store: KeychainStore
    private var webSession: ASWebAuthenticationSession?

    init(api: APIClient, store: KeychainStore) {
        self.api = api
        self.store = store
    }

    func signIn() async throws -> AuthExchange {
        let pkce = try PKCEPair.create()
        struct StartBody: Encodable { let codeChallenge: String }
        let start: AuthStart = try await api.postPublic(path: "/auth/google/start", body: StartBody(codeChallenge: pkce.challenge))
        let callback = try await authenticate(at: start.authorizationUrl)
        guard callback.scheme == "se.bsk2014.app", callback.host == "auth", callback.path == "/callback" else {
            throw AuthError.invalidCallback
        }
        if let error = callback.queryValue("error") { throw AuthError.oauth(error) }
        guard let code = callback.queryValue("code") else { throw AuthError.invalidCallback }

        struct ExchangeBody: Encodable {
            let code: String
            let codeVerifier: String
            let deviceId: String
            let deviceName: String
        }
        let exchange: AuthExchange = try await api.postPublic(
            path: "/auth/exchange",
            body: ExchangeBody(
                code: code,
                codeVerifier: pkce.verifier,
                deviceId: try store.deviceId(),
                deviceName: UIDevice.current.name
            )
        )
        try await api.saveExchange(exchange)
        return exchange
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        return scenes.flatMap(\.windows).first(where: \.isKeyWindow) ?? ASPresentationAnchor()
    }

    private func authenticate(at url: URL) async throws -> URL {
        try await withCheckedThrowingContinuation { continuation in
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: "se.bsk2014.app") { callback, error in
                self.webSession = nil
                if let callback {
                    continuation.resume(returning: callback)
                } else {
                    continuation.resume(throwing: error ?? AuthError.invalidCallback)
                }
            }
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false
            webSession = session
            if !session.start() {
                webSession = nil
                continuation.resume(throwing: AuthError.couldNotStart)
            }
        }
    }
}

private struct PKCEPair {
    let verifier: String
    let challenge: String

    static func create() throws -> PKCEPair {
        var bytes = [UInt8](repeating: 0, count: 32)
        guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess else {
            throw AuthError.randomFailed
        }
        let verifier = Data(bytes).base64URLEncodedString()
        let challenge = Data(SHA256.hash(data: Data(verifier.utf8))).base64URLEncodedString()
        return PKCEPair(verifier: verifier, challenge: challenge)
    }
}

private enum AuthError: LocalizedError {
    case randomFailed
    case invalidCallback
    case couldNotStart
    case oauth(String)

    var errorDescription: String? {
        switch self {
        case .randomFailed: return "Kunde inte skapa en säker inloggning."
        case .invalidCallback: return "Inloggningen gav ett ogiltigt svar."
        case .couldNotStart: return "Kunde inte öppna Google-inloggningen."
        case .oauth: return "Google-inloggningen avbröts eller nekades."
        }
    }
}

private extension Data {
    func base64URLEncodedString() -> String {
        base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}

private extension URL {
    func queryValue(_ name: String) -> String? {
        URLComponents(url: self, resolvingAgainstBaseURL: false)?.queryItems?.first(where: { $0.name == name })?.value
    }
}
