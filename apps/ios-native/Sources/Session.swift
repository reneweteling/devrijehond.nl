import Foundation

/// Holds the signed-in bearer token (persisted in the Keychain) and exposes it
/// to the API client + screens. Anonymous until a token is set.
@MainActor
final class Session: ObservableObject {
    @Published private(set) var token: String?
    @Published var profile: MeProfile?

    private let keychainKey = "nl.devrijehond.native.token"

    init() {
        token = Keychain.read(keychainKey)
    }

    var isAuthenticated: Bool { token != nil }

    func signIn(token: String) {
        Keychain.set(token, for: keychainKey)
        self.token = token
    }

    func signOut() {
        Keychain.delete(keychainKey)
        token = nil
        profile = nil
    }
}
