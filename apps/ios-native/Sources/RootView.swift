import SwiftUI

#if canImport(FirebaseAnalytics)
import FirebaseAnalytics
#endif

struct RootView: View {
    @EnvironmentObject var session: Session

    private static let tabNames = ["Kaart", "Nabij", "Toevoegen", "Wensen", "Profiel"]

    private func logScreen(_ tab: Int) {
        #if canImport(FirebaseAnalytics)
        let name = tab >= 0 && tab < Self.tabNames.count ? Self.tabNames[tab] : "tab\(tab)"
        Analytics.logEvent(
            AnalyticsEventScreenView, parameters: [AnalyticsParameterScreenName: name])
        #endif
    }

    var body: some View {
        // Tab selection lives in Session so e.g. "Bekijk op kaart" can switch tabs.
        // Launch with `-startTab N` (0…4) seeds the initial tab (handy for testing).
        TabView(selection: $session.selectedTab) {
            MapScreen().tabItem { Label("Kaart", systemImage: "map.circle") }.tag(0)
            NearbyScreen().tabItem { Label("Nabij", systemImage: "mappin.and.ellipse.circle") }.tag(1)
            AddScreen().tabItem { Label("Toevoegen", systemImage: "plus.circle") }.tag(2)
            WensenScreen().tabItem { Label("Wensen", systemImage: "lightbulb.circle") }.tag(3)
            ProfileScreen().tabItem { Label("Profiel", systemImage: "person.crop.circle.fill") }.tag(4)
        }
        // A Universal Link (https://www.devrijehond.nl/plek|gebied/<slug>) resolves
        // to a spot in App.swift, which sets session.deepLinkedSpot. Present its
        // detail over whatever tab is active. SpotDetailView loads its own detail,
        // so a nil category is fine here.
        .sheet(item: $session.deepLinkedSpot) { spot in
            NavigationStack {
                SpotDetailView(spot: spot, category: nil)
            }
        }
        .alert("Inloggen", isPresented: Binding(
            get: { session.authNotice != nil },
            set: { if !$0 { session.authNotice = nil } })
        ) {
            Button("Oké") { session.authNotice = nil }
        } message: {
            Text(session.authNotice ?? "")
        }
    }
}
