import SwiftUI

/// Brand splash shown over the app while the session boots/hydrates. Warm moss
/// gradient with the paw mark and wordmark; fades out once the app is ready.
struct SplashView: View {
    @State private var appear = false

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Brand.moss, Brand.mossDark],
                startPoint: .top, endPoint: .bottom
            )
            .ignoresSafeArea()

            VStack(spacing: DVH.s5) {
                ZStack {
                    Circle().fill(.white.opacity(0.14)).frame(width: 132, height: 132)
                    Circle().fill(.white.opacity(0.22)).frame(width: 100, height: 100)
                    Image(systemName: "pawprint.fill")
                        .font(.system(size: 50, weight: .bold))
                        .foregroundStyle(.white)
                }
                .scaleEffect(appear ? 1 : 0.8)
                .opacity(appear ? 1 : 0)

                VStack(spacing: DVH.s1) {
                    Text("De Vrije Hond")
                        .font(.system(size: 30, weight: .heavy, design: .rounded))
                        .foregroundStyle(.white)
                    Text("Honden los, zorgen los.")
                        .font(.dvhCallout)
                        .foregroundStyle(.white.opacity(0.85))
                }
                .opacity(appear ? 1 : 0)
                .offset(y: appear ? 0 : 8)
            }
        }
        .onAppear {
            withAnimation(.spring(response: 0.6, dampingFraction: 0.7)) { appear = true }
        }
    }
}
