import SwiftUI

/// Spot peek/detail. Starts from the summary we already have (instant), then
/// loads the full detail (description, amenities, address) in the background.
struct SpotDetailView: View {
    let spot: SpotSummary
    let category: Category?

    @EnvironmentObject var session: Session
    @StateObject private var loc = LocationManager()

    @State private var detail: SpotDetail?
    @State private var voteResult: VoteResponse?
    @State private var voting = false
    @State private var voteError: String?
    @State private var showSignIn = false

    private var photoURL: URL? {
        if let u = detail?.photos.first?.url ?? spot.photoUrl { return URL(string: u) }
        return nil
    }

    private var status: String { voteResult?.status ?? detail?.status ?? spot.status }

    private var isOwner: Bool {
        guard let me = session.userId, let owner = detail?.submittedBy?.id else { return false }
        return me == owner
    }

    /// Mirror the mobile rule: vote only on still-unverified spots, never your own.
    private var canVote: Bool {
        session.isAuthenticated && detail != nil && !isOwner && status == "UNVERIFIED"
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                photo
                VStack(alignment: .leading, spacing: 12) {
                    Text(spot.name).font(.title2.bold()).foregroundStyle(Brand.ink)
                    if let category {
                        Text(category.label).font(.subheadline).foregroundStyle(Brand.ink2)
                    }
                    HStack(spacing: 12) {
                        VerifiedBadge(verified: spot.isVerified)
                        if spot.rating.count > 0 {
                            Label(
                                String(format: "%.1f (%d)", spot.rating.average, spot.rating.count),
                                systemImage: "star.fill"
                            ).font(.caption).foregroundStyle(Brand.ink2)
                        }
                    }

                    if let desc = detail?.description, !desc.isEmpty {
                        Text(stripHTML(desc))
                            .font(.body).foregroundStyle(Brand.ink2)
                            .fixedSize(horizontal: false, vertical: true)
                    }

                    if let amenities = detail?.amenities, !amenities.isEmpty {
                        FlowChips(amenities: amenities)
                    }

                    if let addr = detail?.address, !addr.isEmpty {
                        Label(addr, systemImage: "mappin.and.ellipse")
                            .font(.subheadline).foregroundStyle(Brand.ink2)
                    }
                    if let site = detail?.website, let url = URL(string: site) {
                        Link(destination: url) {
                            Label("Website", systemImage: "safari")
                        }.font(.subheadline)
                    }

                    voteSection
                }
                .padding(16)
            }
        }
        .background(Brand.sand)
        .task {
            loc.request()
            if detail == nil { detail = try? await APIClient.spotDetail(slug: spot.slug) }
        }
        .sheet(isPresented: $showSignIn) {
            SignInView(reason: "Log in om deze plek te bevestigen of af te wijzen.", dismissable: true)
        }
    }

    @ViewBuilder private var voteSection: some View {
        Divider().padding(.vertical, 4)

        if let result = voteResult {
            VStack(alignment: .leading, spacing: 6) {
                Label(
                    result.vote.value == "CONFIRM" ? "Je hebt deze plek bevestigd"
                        : "Je hebt deze plek afgewezen",
                    systemImage: result.vote.value == "CONFIRM" ? "checkmark.circle.fill" : "xmark.circle.fill"
                )
                .font(.subheadline.weight(.medium))
                .foregroundStyle(result.vote.value == "CONFIRM" ? Brand.mossDark : Brand.terra)
                Text(result.vote.proximityVerified
                    ? "Je was in de buurt, dus je stem telt extra mee."
                    : "Je stem is geteld. (Niet in de buurt: halve weging.)")
                    .font(.caption).foregroundStyle(Brand.ink2)
            }
        } else if isOwner {
            Label("Dit is jouw plek. Anderen bevestigen hem.", systemImage: "person.fill")
                .font(.caption).foregroundStyle(Brand.ink2)
        } else if status != "UNVERIFIED" {
            EmptyView()
        } else if !session.isAuthenticated {
            Button { showSignIn = true } label: {
                Label("Log in om te bevestigen", systemImage: "person.crop.circle.badge.plus")
                    .font(.subheadline)
            }
            .foregroundStyle(Brand.moss)
        } else if canVote {
            VStack(alignment: .leading, spacing: 8) {
                Text("Ken je deze plek?").font(.subheadline.weight(.medium)).foregroundStyle(Brand.ink)
                HStack(spacing: 10) {
                    Button { castVote("CONFIRM") } label: {
                        Label("Bevestigen", systemImage: "checkmark").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent).tint(Brand.moss).disabled(voting)
                    Button { castVote("DENY") } label: {
                        Label("Afwijzen", systemImage: "hand.thumbsdown").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered).tint(Brand.terra).disabled(voting)
                }
                if voting { ProgressView() }
                if let voteError {
                    Text(voteError).font(.caption).foregroundStyle(Brand.terra)
                }
            }
        }
    }

    private func castVote(_ value: String) {
        guard let token = session.token else { showSignIn = true; return }
        voting = true
        voteError = nil
        Task {
            // Best-effort proximity proof: send the current location if we have it,
            // otherwise vote without it (the server counts it at half weight).
            let proof = loc.coordinate.map { GeoPoint(lat: $0.latitude, lng: $0.longitude) }
            do {
                voteResult = try await APIClient.vote(
                    spotId: spot.id, value: value, proof: proof, token: token)
            } catch let e as APIError {
                if session.signOutIfUnauthorized(e) {
                    voteError = "Je sessie is verlopen. Log opnieuw in."
                    showSignIn = true
                } else if e.code == "OWN_SPOT" {
                    voteError = "Je kunt niet op je eigen plek stemmen."
                } else {
                    voteError = e.errorDescription ?? "Stemmen mislukt."
                }
            } catch {
                voteError = "Stemmen mislukt. Probeer het opnieuw."
            }
            voting = false
        }
    }

    @ViewBuilder private var photo: some View {
        if let url = photoURL {
            AsyncImage(url: url) { img in
                img.resizable().scaledToFill()
            } placeholder: {
                Rectangle().fill(Brand.mossSoft)
            }
            .frame(height: 200).frame(maxWidth: .infinity).clipped()
        } else {
            ZStack {
                Rectangle().fill(Brand.mossSoft)
                Image(systemName: category?.icon ?? "pawprint.fill")
                    .font(.system(size: 44)).foregroundStyle(Brand.mossDark)
            }
            .frame(height: 200).frame(maxWidth: .infinity)
        }
    }

    private func stripHTML(_ s: String) -> String {
        s.replacingOccurrences(of: "<[^>]+>", with: " ", options: .regularExpression)
            .replacingOccurrences(of: "&nbsp;", with: " ")
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

struct FlowChips: View {
    let amenities: [Amenity]
    var body: some View {
        // Simple wrapping row of amenity chips.
        let columns = [GridItem(.adaptive(minimum: 90), spacing: 8)]
        LazyVGrid(columns: columns, alignment: .leading, spacing: 8) {
            ForEach(amenities) { a in
                HStack(spacing: 5) {
                    Image(systemName: a.icon ?? "checkmark").font(.caption2)
                    Text(a.label).font(.caption)
                }
                .padding(.horizontal, 10).padding(.vertical, 6)
                .background(Brand.mossSoft, in: Capsule())
                .foregroundStyle(Brand.mossDark)
            }
        }
    }
}

struct VerifiedBadge: View {
    let verified: Bool
    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: verified ? "checkmark.seal.fill" : "circle.dashed")
            Text(verified ? "Geverifieerd" : "Niet geverifieerd")
        }
        .font(.caption.weight(.medium))
        .foregroundStyle(verified ? Brand.mossDark : Brand.terra)
        .padding(.horizontal, 8).padding(.vertical, 4)
        .background((verified ? Brand.mossSoft : Brand.terra.opacity(0.12)), in: Capsule())
    }
}
