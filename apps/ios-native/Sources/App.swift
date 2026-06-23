import SwiftUI

@main
struct DeVrijeHondNativeApp: App {
    @StateObject private var session = Session()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(session)
                .tint(Brand.moss)
        }
    }
}
