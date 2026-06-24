import AuthenticationServices
import SwiftUI

/// The sign-in surface: native Apple, native Google, and magic-link email.
/// Used both as the signed-out Profile state and as a sheet gating Add/vote.
struct SignInView: View {
    @EnvironmentObject var session: Session
    @Environment(\.dismiss) private var dismiss

    /// Optional copy explaining why sign-in is being asked for right now.
    var reason: String?
    /// Whether to show a "later" button (when presented as a gating sheet).
    var dismissable = false

    @State private var email = ""
    @State private var magicSent = false
    @State private var working = false
    @State private var error: String?

    private var emailValid: Bool {
        let t = email.trimmingCharacters(in: .whitespaces)
        return t.contains("@") && t.contains(".") && t.count >= 5
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                header

                if magicSent {
                    magicSentCard
                } else {
                    providerButtons
                    orDivider
                    magicLinkForm
                }

                if let error {
                    Text(error).font(.footnote).foregroundStyle(Brand.terra)
                        .multilineTextAlignment(.center)
                }

                if dismissable {
                    Button("Later") { dismiss() }
                        .font(.subheadline).foregroundStyle(Brand.ink2).padding(.top, 4)
                }
            }
            .padding(24)
            .frame(maxWidth: .infinity)
        }
        .background(Brand.sand)
        .onChange(of: session.isAuthenticated) { _, authed in
            if authed { dismiss() }
        }
    }

    private var header: some View {
        VStack(spacing: 10) {
            Image(systemName: "pawprint.circle.fill")
                .font(.system(size: 60)).foregroundStyle(Brand.moss)
            Text("Inloggen").font(.title2.bold()).foregroundStyle(Brand.ink)
            Text(reason ?? "Log in om hondenplekken toe te voegen, te bevestigen en je honden te beheren.")
                .font(.subheadline).foregroundStyle(Brand.ink2)
                .multilineTextAlignment(.center)
        }
        .padding(.top, 8)
    }

    private var providerButtons: some View {
        VStack(spacing: 12) {
            SignInWithAppleButton(.signIn) { request in
                request.requestedScopes = [.fullName, .email]
            } onCompletion: { result in
                handleApple(result)
            }
            .signInWithAppleButtonStyle(.black)
            .frame(height: 50)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .disabled(working)

            if AuthService.googleAvailable {
                Button { handleGoogle() } label: {
                    HStack(spacing: 10) {
                        Image(systemName: "globe").font(.headline)
                        Text("Verder met Google").font(.headline)
                    }
                    .frame(maxWidth: .infinity).frame(height: 50)
                    .background(.white, in: RoundedRectangle(cornerRadius: 12))
                    .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(Brand.ink2.opacity(0.25)))
                    .foregroundStyle(Brand.ink)
                }
                .disabled(working)
            }
        }
    }

    private var orDivider: some View {
        HStack {
            line; Text("of").font(.caption).foregroundStyle(Brand.ink2); line
        }
    }
    private var line: some View { Rectangle().fill(Brand.ink2.opacity(0.2)).frame(height: 1) }

    private var magicLinkForm: some View {
        VStack(spacing: 12) {
            TextField("jij@email.nl", text: $email)
                .textContentType(.emailAddress)
                .keyboardType(.emailAddress)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .padding(14)
                .background(.white, in: RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(Brand.ink2.opacity(0.2)))

            Button { sendMagicLink() } label: {
                HStack {
                    if working { ProgressView().tint(.white) }
                    Text("Stuur inloglink").font(.headline)
                }
                .frame(maxWidth: .infinity).frame(height: 50)
            }
            .buttonStyle(.borderedProminent)
            .tint(Brand.moss)
            .disabled(!emailValid || working)
        }
    }

    private var magicSentCard: some View {
        VStack(spacing: 12) {
            Image(systemName: "envelope.badge.fill")
                .font(.system(size: 44)).foregroundStyle(Brand.moss)
            Text("Check je inbox").font(.headline).foregroundStyle(Brand.ink)
            Text("We hebben een inloglink gestuurd naar \(email). Open de link op deze telefoon, dan ben je ingelogd.")
                .font(.subheadline).foregroundStyle(Brand.ink2)
                .multilineTextAlignment(.center)
            Button("Ander e-mailadres") { magicSent = false; error = nil }
                .font(.subheadline).foregroundStyle(Brand.moss).padding(.top, 4)
        }
        .padding(.vertical, 12)
    }

    // MARK: - Actions

    private func handleApple(_ result: Result<ASAuthorization, Error>) {
        error = nil
        switch result {
        case .success(let auth):
            working = true
            Task {
                do {
                    let t = try await AuthService.exchangeApple(auth)
                    session.signIn(token: t.token, expiresAt: t.expiresAt)
                } catch {
                    self.error = (error as? LocalizedError)?.errorDescription ?? "Inloggen mislukt."
                }
                working = false
            }
        case .failure(let err):
            if (err as? ASAuthorizationError)?.code == .canceled { return }
            error = "Apple inloggen mislukt."
        }
    }

    private func handleGoogle() {
        error = nil
        working = true
        Task {
            do {
                let t = try await AuthService.signInWithGoogle()
                session.signIn(token: t.token, expiresAt: t.expiresAt)
            } catch AuthService.AuthError.cancelled {
                // user backed out
            } catch {
                self.error = (error as? LocalizedError)?.errorDescription ?? "Google inloggen mislukt."
            }
            working = false
        }
    }

    private func sendMagicLink() {
        error = nil
        working = true
        let address = email.trimmingCharacters(in: .whitespaces)
        Task {
            do {
                try await AuthService.requestMagicLink(email: address)
                magicSent = true
            } catch let e as APIError where e.status == 429 {
                self.error = "Te veel pogingen. Probeer het straks opnieuw."
            } catch {
                self.error = "Kon de link niet versturen. Controleer je e-mailadres."
            }
            working = false
        }
    }
}
