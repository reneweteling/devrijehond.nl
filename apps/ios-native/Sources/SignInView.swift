import AuthenticationServices
import SwiftUI

/// The sign-in surface: native Apple, native Google, and magic-link email.
/// Used both as the signed-out Profile state and as a sheet gating Add/vote.
struct SignInView: View {
    @EnvironmentObject var session: Session
    @Environment(\.dismiss) private var dismiss

    /// Optional copy explaining why sign-in is being asked for right now.
    var reason: String?
    /// Whether to show a "later" affordance (when presented as a gating sheet).
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
        ZStack(alignment: .topTrailing) {
            Brand.sand.ignoresSafeArea()
            Image("Logo")
                .resizable().scaledToFit().frame(width: 360)
                .opacity(0.05).offset(x: 70, y: 20)
                .ignoresSafeArea().accessibilityHidden(true)

            ScrollView {
                VStack(spacing: DVH.s5) {
                    hero
                    if magicSent {
                        magicSentCard
                    } else {
                        VStack(spacing: DVH.s4) {
                            providerButtons
                            orDivider
                            magicLinkForm
                        }
                        .dvhCard(padding: DVH.s5)
                    }

                    if let error {
                        Text(error).font(.dvhCaption).foregroundStyle(Brand.rust)
                            .multilineTextAlignment(.center)
                    }

                    Text("Door in te loggen ga je akkoord met onze [voorwaarden](https://devrijehond.nl/terms) en [privacybeleid](https://devrijehond.nl/privacy).")
                    .font(.system(size: 11, design: .rounded))
                    .foregroundStyle(Brand.ink2.opacity(0.8))
                    .tint(Brand.moss)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, DVH.s6)
                    .padding(.top, DVH.s1)
                }
                .padding(.horizontal, DVH.s5)
                .padding(.top, dismissable ? DVH.s8 : DVH.s6)
                .padding(.bottom, DVH.s8)
            }

            if dismissable {
                Button { dismiss() } label: {
                    Image(systemName: "xmark")
                        .font(.headline)
                        .foregroundStyle(Brand.ink2)
                        .padding(10)
                        .background(Brand.cream, in: Circle())
                        .overlay(Circle().strokeBorder(Brand.ink.opacity(0.08)))
                }
                .padding(DVH.s4)
            }
        }
        .onChange(of: session.isAuthenticated) { _, authed in
            if authed { dismiss() }
        }
    }

    // MARK: - Hero

    private var hero: some View {
        VStack(spacing: DVH.s4) {
            Image("Logo")
                .resizable()
                .scaledToFit()
                .frame(width: 180, height: 150)
            VStack(spacing: DVH.s2) {
                Text("Welkom")
                    .font(.dvhDisplay(30)).foregroundStyle(Brand.ink)
                Text(reason ?? "Log in om plekken toe te voegen, te bevestigen en je honden te beheren.")
                    .font(.dvhCallout).foregroundStyle(Brand.ink2)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, DVH.s4)
            }
        }
    }

    // MARK: - Providers

    private var providerButtons: some View {
        VStack(spacing: DVH.s3) {
            // Custom Apple button (bigger logo + Dutch label) over the native flow.
            Button { handleApple() } label: {
                HStack(spacing: DVH.s2) {
                    Image(systemName: "applelogo").font(.system(size: 22, weight: .medium))
                    Text("Doorgaan met Apple").font(.dvhHeadline)
                }
                .frame(maxWidth: .infinity)
                .frame(height: DVH.controlHeight)
                .background(Color.black, in: RoundedRectangle(cornerRadius: DVH.rMd))
                .foregroundStyle(.white)
            }
            .buttonStyle(.plain)
            .disabled(working)

            if AuthService.googleAvailable {
                Button { handleGoogle() } label: {
                    HStack(spacing: DVH.s2) {
                        GoogleGlyph(size: 20)
                        Text("Verder met Google").font(.dvhHeadline)
                    }
                }
                .buttonStyle(.dvhSecondary)
                .disabled(working)
            }
        }
    }

    private var orDivider: some View {
        HStack(spacing: DVH.s3) {
            line; Text("of met e-mail").font(.dvhCaption).foregroundStyle(Brand.ink2); line
        }
    }
    private var line: some View { Rectangle().fill(Brand.ink.opacity(0.1)).frame(height: 1) }

    private var magicLinkForm: some View {
        VStack(spacing: DVH.s3) {
            ZStack(alignment: .leading) {
                if email.isEmpty {
                    Text("jij@email.nl").foregroundStyle(Brand.ink2)
                }
                TextField("", text: $email)
                    .foregroundStyle(Brand.ink)
                    .tint(Brand.moss)
                    .textContentType(.emailAddress)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
            }
            .font(.dvhBody)
            .padding(.horizontal, DVH.s4)
            .frame(height: DVH.controlHeight)
            .background(Brand.cream, in: RoundedRectangle(cornerRadius: DVH.rMd))
            .overlay(RoundedRectangle(cornerRadius: DVH.rMd).strokeBorder(Brand.ink.opacity(0.12)))

            Button { sendMagicLink() } label: {
                HStack(spacing: DVH.s2) {
                    if working { ProgressView().tint(.white) }
                    Text("Stuur inloglink")
                }
            }
            .buttonStyle(.dvhPrimary)
            .disabled(!emailValid || working)
            .opacity(emailValid ? 1 : 0.55)
        }
    }

    private var magicSentCard: some View {
        VStack(spacing: DVH.s3) {
            ZStack {
                Circle().fill(Brand.mossSoft).frame(width: 76, height: 76)
                Image(systemName: "envelope.badge.fill")
                    .font(.system(size: 32)).foregroundStyle(Brand.moss)
            }
            Text("Check je inbox").font(.dvhTitle).foregroundStyle(Brand.ink)
            Text("We hebben een inloglink gestuurd naar \(email). Open hem op deze telefoon, dan ben je ingelogd.")
                .font(.dvhCallout).foregroundStyle(Brand.ink2)
                .multilineTextAlignment(.center)
            Button("Ander e-mailadres") { magicSent = false; error = nil }
                .font(.dvhCallout.weight(.semibold)).foregroundStyle(Brand.moss).padding(.top, DVH.s1)
        }
        .dvhCard(padding: DVH.s6)
    }

    // MARK: - Actions

    private func handleApple() {
        error = nil
        working = true
        Task {
            do {
                let t = try await AuthService.signInWithApple()
                session.signIn(token: t.token, expiresAt: t.expiresAt)
            } catch AuthService.AuthError.cancelled {
                // user backed out
            } catch {
                self.error = (error as? LocalizedError)?.errorDescription ?? "Apple inloggen mislukt."
            }
            working = false
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

/// A small, recognizable four-color Google "G" built from SwiftUI shapes (no
/// asset / SVG dependency), matching the Expo app's hand-built mark.
/// The official Google "G" (four-colour SVG asset in the catalog).
struct GoogleGlyph: View {
    var size: CGFloat = 18
    var body: some View {
        Image("GoogleLogo")
            .resizable()
            .scaledToFit()
            .frame(width: size, height: size)
    }
}
