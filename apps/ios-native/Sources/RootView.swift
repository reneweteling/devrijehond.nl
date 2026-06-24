import SwiftUI

struct RootView: View {
    @EnvironmentObject var session: Session

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
