import SwiftUI
import UIKit

#if canImport(GoogleSignIn)
import GoogleSignIn
#endif

#if canImport(Sentry)
import Sentry
#endif

#if canImport(FirebaseCore)
import FirebaseCore
#endif

@main
struct DeVrijeHondNativeApp: App {
    @StateObject private var session = Session()
    @State private var booted = false

    init() {
        Self.startFirebase()
        Self.startSentry()
        Self.configureNavigationBar()
    }

    /// Google Analytics for iOS via Firebase. Only configures when the
    /// GoogleService-Info.plist is bundled, so the app still runs without it.
    private static func startFirebase() {
        #if canImport(FirebaseCore)
        if Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") != nil {
            FirebaseApp.configure()
        }
        #endif
    }

    private static func startSentry() {
        #if canImport(Sentry)
        SentrySDK.start { options in
            options.dsn =
                "https://c14ccbeda0b8c5f43c9a352f2c730ec7@o157871.ingest.us.sentry.io/4511620103602176"
            #if DEBUG
            options.environment = "debug"
            #else
            options.environment = "production"
            #endif
            options.tracesSampleRate = 0.2
            options.enableMetricKit = true
        }
        #endif
    }

    /// Uniform nav titles app-wide: the brand rounded font, sized close to the
    /// in-content titles (the user name), and the system material that frosts the
    /// content scrolling under it. Transparent at the top, frosted once scrolled.
    private static func configureNavigationBar() {
        func rounded(_ size: CGFloat, _ weight: UIFont.Weight) -> UIFont {
            let base = UIFont.systemFont(ofSize: size, weight: weight)
            guard let d = base.fontDescriptor.withDesign(.rounded) else { return base }
            return UIFont(descriptor: d, size: size)
        }
        let green = UIColor(Brand.mossDark)
        let large = rounded(24, .bold)
        let inline = rounded(20, .bold)

        let standard = UINavigationBarAppearance()
        standard.configureWithDefaultBackground() // material -> frosts on scroll
        let scrollEdge = UINavigationBarAppearance()
        scrollEdge.configureWithTransparentBackground() // clear over the sand at rest
        for a in [standard, scrollEdge] {
            a.largeTitleTextAttributes = [.font: large, .foregroundColor: green]
            a.titleTextAttributes = [.font: inline, .foregroundColor: green]
        }
        let bar = UINavigationBar.appearance()
        bar.standardAppearance = standard
        bar.compactAppearance = standard
        bar.scrollEdgeAppearance = scrollEdge
    }

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
        // Keep the brand splash up long enough to actually see the logo animation
        // settle (the spring runs ~0.6s) before fading out.
        try? await Task.sleep(nanoseconds: 1_600_000_000)
        withAnimation(.easeOut(duration: 0.4)) { booted = true }
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
