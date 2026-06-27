import SwiftUI
import UIKit

#if canImport(GoogleSignIn)
import GoogleSignIn
#endif

#if canImport(Sentry)
import Sentry
#endif

@main
struct DeVrijeHondNativeApp: App {
    @StateObject private var session = Session()
    @State private var booted = false

    init() {
        Self.startSentry()
        Self.configureNavigationBar()
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
            .onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { activity in
                if let url = activity.webpageURL { openWebLink(url) }
            }
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
        // A Universal Link can also be delivered through onOpenURL (e.g. when the
        // app is opened from another app's web view), so route https URLs here too.
        if url.scheme == "https" || url.scheme == "http" {
            openWebLink(url)
            return
        }
        // Magic-link landing: vrijehond://verify?token=...
        guard url.scheme == "vrijehond" else { return }
        let comps = URLComponents(url: url, resolvingAgainstBaseURL: false)
        guard let token = comps?.queryItems?.first(where: { $0.name == "token" })?.value,
              !token.isEmpty else { return }
        redeemMagicLink(token)
    }

    /// Exchange a magic-link token for a session. Shared by the vrijehond:// deep
    /// link and the https /verify-mobile Universal Link.
    @MainActor
    private func redeemMagicLink(_ token: String) {
        Task { @MainActor in
            do {
                let auth = try await AuthService.verifyMagicLink(token: token)
                session.signIn(token: auth.token, expiresAt: auth.expiresAt)
            } catch {
                session.authNotice = "Deze inloglink is verlopen of al gebruikt. Vraag een nieuwe aan."
            }
        }
    }

    /// A Universal Link to a spot. Production links look like
    /// https://www.devrijehond.nl/plek/<slug> (POI) or /gebied/<slug> (REGION).
    /// We pull the slug from the path, fetch the spot, and present its detail.
    /// Works on both a cold start (the link launches the app) and a warm start.
    @MainActor
    private func openWebLink(_ url: URL) {
        let comps = URLComponents(url: url, resolvingAgainstBaseURL: false)
        let parts = url.path.split(separator: "/", omittingEmptySubsequences: true).map(String.init)
        // Magic-link via Universal Link: https://www.devrijehond.nl/verify-mobile?token=...
        // (when the app is installed iOS opens this instead of the web interstitial).
        if parts.first == "verify-mobile" {
            if let token = comps?.queryItems?.first(where: { $0.name == "token" })?.value,
               !token.isEmpty {
                redeemMagicLink(token)
            }
            return
        }
        // Expect ["plek", "<slug>"] or ["gebied", "<slug>"].
        guard parts.count >= 2, parts[0] == "plek" || parts[0] == "gebied" else { return }
        let slug = parts[1]
        guard !slug.isEmpty else { return }
        Task { @MainActor in
            do {
                let detail = try await APIClient.spotDetail(slug: slug)
                session.deepLinkedSpot = Self.summary(from: detail)
            } catch {
                session.authNotice = "We konden deze plek niet openen. Probeer het later opnieuw."
            }
        }
    }

    /// SpotDetailView takes a SpotSummary and loads its own detail by slug, so a
    /// minimal summary mapped from the fetched detail is enough to drive it.
    private static func summary(from d: SpotDetail) -> SpotSummary {
        SpotSummary(
            id: d.id,
            slug: d.slug,
            type: d.type,
            name: d.name,
            categoryId: d.category.id,
            status: d.status,
            lat: d.lat,
            lng: d.lng,
            rating: d.rating,
            photoUrl: d.photos.first?.url,
            geometry: nil)
    }
}
