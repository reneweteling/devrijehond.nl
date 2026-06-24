import AuthenticationServices
import Foundation
import UIKit

#if canImport(GoogleSignIn)
import GoogleSignIn
#endif

/// The sign-in flows. Apple + Google produce an idToken that we exchange at the
/// native bridge for a BetterAuth bearer; magic-link goes through the email +
/// deep-link round trip. All return an `AuthToken` the Session persists.
enum AuthService {
    enum AuthError: LocalizedError {
        case cancelled
        case noToken
        case googleUnavailable
        case message(String)

        var errorDescription: String? {
            switch self {
            case .cancelled: return "Geannuleerd."
            case .noToken: return "Geen token ontvangen."
            case .googleUnavailable: return "Google inloggen is in deze build niet beschikbaar."
            case .message(let m): return m
            }
        }
    }

    // MARK: - Apple

    @MainActor private static let appleController = AppleSignInController()

    /// Run Sign in with Apple via our custom button and exchange for a bearer.
    @MainActor
    static func signInWithApple() async throws -> AuthToken {
        do {
            let auth = try await appleController.signIn()
            return try await exchangeApple(auth)
        } catch let e as ASAuthorizationError where e.code == .canceled {
            throw AuthError.cancelled
        }
    }

    /// Exchange the Apple identityToken for a bearer.
    static func exchangeApple(_ authorization: ASAuthorization) async throws -> AuthToken {
        guard
            let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
            let tokenData = credential.identityToken,
            let idToken = String(data: tokenData, encoding: .utf8), !idToken.isEmpty
        else { throw AuthError.noToken }
        return try await APIClient.exchangeIdToken(provider: "apple-native", idToken: idToken)
    }

    // MARK: - Google

    static var googleAvailable: Bool {
        #if canImport(GoogleSignIn)
        return true
        #else
        return false
        #endif
    }

    @MainActor
    static func signInWithGoogle() async throws -> AuthToken {
        #if canImport(GoogleSignIn)
        guard let presenter = topViewController() else { throw AuthError.googleUnavailable }
        // Force the account chooser each time (no silent re-use of a stale session).
        GIDSignIn.sharedInstance.signOut()
        let result: GIDSignInResult
        do {
            result = try await GIDSignIn.sharedInstance.signIn(withPresenting: presenter)
        } catch {
            let code = (error as NSError).code
            if code == GIDSignInError.canceled.rawValue { throw AuthError.cancelled }
            throw AuthError.message(error.localizedDescription)
        }
        guard let idToken = result.user.idToken?.tokenString else { throw AuthError.noToken }
        return try await APIClient.exchangeIdToken(provider: "google-native", idToken: idToken)
        #else
        throw AuthError.googleUnavailable
        #endif
    }

    @MainActor
    private static func topViewController() -> UIViewController? {
        let scene = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first { $0.activationState == .foregroundActive } ?? UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }.first
        var top = scene?.keyWindow?.rootViewController
            ?? scene?.windows.first?.rootViewController
        while let presented = top?.presentedViewController { top = presented }
        return top
    }

    // MARK: - Magic link

    static func requestMagicLink(email: String) async throws {
        try await APIClient.requestMagicLink(email: email)
    }

    static func verifyMagicLink(token: String) async throws -> AuthToken {
        try await APIClient.verifyMagicLink(token: token)
    }
}
