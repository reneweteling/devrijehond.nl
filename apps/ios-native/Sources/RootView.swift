import SwiftUI

struct RootView: View {
    @EnvironmentObject var session: Session
    // Launch with `-startTab N` (0…4) to open a specific tab — handy for testing.
    @State private var selection = UserDefaults.standard.integer(forKey: "startTab")

    var body: some View {
        TabView(selection: $selection) {
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
