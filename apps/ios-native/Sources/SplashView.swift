import SwiftUI

/// Brand splash shown over the app while the session boots/hydrates. The real
/// logo (the leaping dog + wordmark) on the warm sand ground; fades out once the
/// app is ready. The pawprint lives on the map markers, not here.
struct SplashView: View {
    @State private var appear = false

    var body: some View {
        ZStack {
            Brand.sand.ignoresSafeArea()

            VStack(spacing: DVH.s4) {
                Image("Logo")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 230)
                    .scaleEffect(appear ? 1 : 0.86)
                    .opacity(appear ? 1 : 0)

                Text("Honden los, zorgen los.")
                    .font(.dvhCallout)
                    .foregroundStyle(Brand.ink2)
                    .opacity(appear ? 1 : 0)
                    .offset(y: appear ? 0 : 8)
            }
        }
        .onAppear {
            withAnimation(.spring(response: 0.6, dampingFraction: 0.75)) { appear = true }
        }
    }
}
