import SwiftUI

struct MySpotsView: View {
    @EnvironmentObject var session: Session

    @State private var spots: [SpotSummary] = []
    @State private var loading = true
    @State private var error: String?
    @State private var selectedSpot: SpotSummary?

    var body: some View {
        Group {
            if loading {
                ProgressView("Inzendingen laden…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error {
                EmptyStateView(
                    icon: "exclamationmark.triangle",
                    title: "Kon niet laden",
                    message: error,
                    actionLabel: "Opnieuw proberen"
                ) {
                    Task { await load() }
                }
            } else if spots.isEmpty {
                EmptyStateView(
                    icon: "mappin.and.ellipse",
                    title: "Nog geen inzendingen",
                    message: "Plekken die je toevoegt verschijnen hier."
                )
            } else {
                List(spots) { spot in
                    MySpotRow(spot: spot)
                        .contentShape(Rectangle())
                        .onTapGesture { selectedSpot = spot }
                        .listRowBackground(Color.clear)
                        .listRowSeparatorTint(Brand.ink.opacity(0.08))
                }
                .listStyle(.plain)
                .scrollContentBackground(.hidden)
            }
        }
        .background(Brand.sand.ignoresSafeArea())
        .navigationTitle("Mijn inzendingen")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
        .refreshable { await load() }
        .sheet(item: $selectedSpot) { spot in
            SpotDetailView(spot: spot, category: nil)
                .presentationDetents([.medium, .large])
        }
    }

    private func load() async {
        guard let token = session.token else { return }
        loading = true
        error = nil
        do {
            spots = try await APIClient.mySpots(token: token)
        } catch let e as APIError {
            _ = session.signOutIfUnauthorized(e)
            error = e.errorDescription ?? "Laden mislukt."
        } catch {
            self.error = "Laden mislukt. Controleer je verbinding."
        }
        loading = false
    }
}

// MARK: - Row

private struct MySpotRow: View {
    let spot: SpotSummary

    var body: some View {
        HStack(spacing: DVH.s3) {
            thumb
            VStack(alignment: .leading, spacing: DVH.s1) {
                Text(spot.name)
                    .font(.dvhBody.weight(.medium))
                    .foregroundStyle(Brand.ink)
                    .lineLimit(1)
                HStack(spacing: DVH.s2) {
                    VerifiedBadge(verified: spot.isVerified)
                    Text(spot.isRegion ? "Gebied" : "Plek")
                        .font(.dvhCaption).foregroundStyle(Brand.ink2)
                }
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Brand.ink2.opacity(0.4))
        }
        .padding(.vertical, DVH.s2)
    }

    @ViewBuilder
    private var thumb: some View {
        if let urlStr = spot.photoUrl, let url = URL(string: urlStr) {
            AsyncImage(url: url) { img in
                img.resizable().scaledToFill()
            } placeholder: {
                RoundedRectangle(cornerRadius: DVH.rSm).fill(Brand.mossSoft)
            }
            .frame(width: 52, height: 52)
            .clipShape(RoundedRectangle(cornerRadius: DVH.rSm))
        } else {
            ZStack {
                RoundedRectangle(cornerRadius: DVH.rSm).fill(Brand.mossSoft)
                Image(systemName: "mappin.circle.fill")
                    .font(.system(size: 22))
                    .foregroundStyle(Brand.moss)
            }
            .frame(width: 52, height: 52)
        }
    }
}
