import SwiftUI

#if canImport(GoogleSignIn)
import GoogleSignIn
#endif

@main
struct DeVrijeHondNativeApp: App {
    @StateObject private var session = Session()
    @State private var booted = false

    var body: some Scene {
        WindowGroup {
            ZStack {
                RootView()
                    .environmentObject(session)
                    .tint(Brand.moss)

                if !booted {
                    SplashView().transition(.opacity)
                }
            }
            .preferredColorScheme(.light)
            .task { await boot() }
            .onOpenURL { handle($0) }
        }
    }

    private func boot() async {
        await session.hydrate()
        // Keep the brand splash up briefly even when boot is instant (anonymous).
        try? await Task.sleep(nanoseconds: 650_000_000)
        withAnimation(.easeOut(duration: 0.35)) { booted = true }
    }

    @MainActor
    private func handle(_ url: URL) {
        #if canImport(GoogleSignIn)
        if GIDSignIn.sharedInstance.handle(url) { return }
        #endif
        // Magic-link landing: vrijehond://verify?token=...
        guard url.scheme == "vrijehond" else { return }
        let comps = URLComponents(url: url, resolvingAgainstBaseURL: false)
        guard let token = comps?.queryItems?.first(where: { $0.name == "token" })?.value,
              !token.isEmpty else { return }
        Task { @MainActor in
            do {
                let auth = try await AuthService.verifyMagicLink(token: token)
                session.signIn(token: auth.token, expiresAt: auth.expiresAt)
            } catch {
                session.authNotice = "Deze inloglink is verlopen of al gebruikt. Vraag een nieuwe aan."
            }
        }
    }
}
