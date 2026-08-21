import Foundation
import Security

struct KeychainStore: Sendable {
    private let service = "se.bsk2014.app"
    private let tokenAccount = "mobile-session"
    private let deviceAccount = "device-id"

    func saveTokens(_ tokens: TokenPair) throws {
        try save(JSONEncoder().encode(tokens), account: tokenAccount)
    }

    func loadTokens() throws -> TokenPair? {
        guard let data = try load(account: tokenAccount) else { return nil }
        return try JSONDecoder().decode(TokenPair.self, from: data)
    }

    func deleteTokens() throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: tokenAccount,
        ]
        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else { throw KeychainError.status(status) }
    }

    func deviceId() throws -> String {
        if let data = try load(account: deviceAccount), let value = String(data: data, encoding: .utf8) {
            return value
        }
        let value = UUID().uuidString.lowercased()
        try save(Data(value.utf8), account: deviceAccount)
        return value
    }

    private func save(_ data: Data, account: String) throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        let attributes: [String: Any] = [
            kSecValueData as String: data,
            // Sessionen måste kunna återställas efter en bakgrundsstart när
            // telefonen har låsts, men får aldrig lämna den här enheten.
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
        ]
        let update = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if update == errSecItemNotFound {
            var insert = query
            attributes.forEach { insert[$0.key] = $0.value }
            let status = SecItemAdd(insert as CFDictionary, nil)
            guard status == errSecSuccess else { throw KeychainError.status(status) }
        } else if update != errSecSuccess {
            throw KeychainError.status(update)
        }
    }

    private func load(account: String) throws -> Data? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = item as? Data else { throw KeychainError.status(status) }
        return data
    }
}

enum KeychainError: Error {
    case status(OSStatus)
}
