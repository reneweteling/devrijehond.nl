import Foundation

/// Holds the signed-in bearer token (persisted in the Keychain) and the cached
/// profile, and exposes them to the API client + screens. Anonymous until a
/// token is set. The token is a signed BetterAuth session token.
@MainActor
final class Session: ObservableObject {
    @Published private(set) var token: String?
    @Published private(set) var profile: MeProfile?
    @Published private(set) var hydrating = false
    /// A transient message to surface to the user (e.g. a failed magic link).
    @Published var authNotice: String?

    /// Currently-selected tab (0 = Kaart). Bound by RootView so other screens can
    /// switch tabs, e.g. "Bekijk op kaart" from a spot detail.
    @Published var selectedTab: Int = UserDefaults.standard.integer(forKey: "startTab")
    /// When set, the map centers on this spot then clears it. Used to jump from a
    /// list/detail to the map.
    @Published var mapFocus: SpotSummary?
    /// When set, RootView presents the spot detail over the current tab. Set by the
    /// Universal Link router after fetching the linked spot; cleared when the sheet
    /// closes. See `DeepLink` in App.swift.
    @Published var deepLinkedSpot: SpotSummary?

    private let tokenKey = "nl.devrijehond.native.token"
    private let expiresKey = "nl.devrijehond.native.expiresAt"

    /// DEBUG-only: inject a fake signed-in profile via the `-mockAuth` launch
    /// argument so the authenticated screens can be driven in the simulator
    /// without a real Apple/Google/magic-link round trip. Never set in release.
    private(set) var mockMode = false

    init() {
        #if DEBUG
        if CommandLine.arguments.contains("-mockAuth") {
            mockMode = true
            token = "mock-token"
            profile = MeProfile.mock
            return
        }
        #endif
        token = Keychain.read(tokenKey)
    }

    var isAuthenticated: Bool { token != nil }

    var userId: String? { profile?.id }

    func signIn(token: String, expiresAt: String?) {
        Keychain.set(token, for: tokenKey)
        if let expiresAt { Keychain.set(expiresAt, for: expiresKey) }
        self.token = token
        Task { await hydrate() }
    }

    func signOut() {
        Keychain.delete(tokenKey)
        Keychain.delete(expiresKey)
        token = nil
        profile = nil
    }

    /// Drop to anonymous if an authed request came back 401 (token dead
    /// server-side). Returns true when it acted, so callers can adjust their UI.
    @discardableResult
    func signOutIfUnauthorized(_ error: Error) -> Bool {
        if mockMode { return false }
        let is401: Bool
        switch error {
        case let APIError.server(_, _, status): is401 = status == 401
        case APIError.badStatus(401): is401 = true
        default: is401 = false
        }
        if is401 {
            signOut()
            authNotice = "Je sessie is verlopen. Log opnieuw in."
        }
        return is401
    }

    /// Fetch the profile for the current token. A 401 means the token is dead
    /// server-side (e.g. expired, or a DB reseed), so drop to anonymous. Other
    /// failures (offline) keep the session so the user stays logged in.
    /// Apply a freshly-fetched/updated profile to the cache immediately, so the
    /// UI reflects a just-saved avatar/dog without waiting for a re-fetch.
    func setProfile(_ p: MeProfile) {
        profile = p
    }

    func hydrate() async {
        if mockMode { return }
        guard let token else { return }
        hydrating = true
        defer { hydrating = false }
        do {
            profile = try await APIClient.me(token: token)
        } catch let APIError.server(_, _, status) where status == 401 {
            signOut()
        } catch APIError.badStatus(401) {
            signOut()
        } catch {
            // Offline or transient: keep the token, try again next launch.
        }
    }
}
