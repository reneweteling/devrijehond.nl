import SwiftUI

/// Spot peek/detail. Starts from the summary we already have (instant), then
/// loads the full detail (description, amenities, photos, reviews) in the background.
struct SpotDetailView: View {
    let spot: SpotSummary
    let category: Category?

    @EnvironmentObject var session: Session
    @StateObject private var loc = LocationManager()
    @Environment(\.dismiss) private var dismiss

    @State private var detail: SpotDetail?
    @State private var reviews: [Review] = []
    @State private var voteResult: VoteResponse?
    @State private var voting = false
    @State private var voteError: String?
    @State private var activeSheet: SpotDetailSheet?

    // MARK: - Derived helpers

    private var photoURL: URL? {
        if let u = detail?.photos.first?.url ?? spot.photoUrl { return URL(string: u) }
        return nil
    }

    private var status: String { voteResult?.status ?? detail?.status ?? spot.status }
    private var isVerified: Bool { status == "VERIFIED" }

    private var effectiveRating: Rating {
        detail?.rating ?? spot.rating
    }

    private var isOwner: Bool {
        guard let me = session.userId, let owner = detail?.submittedBy?.id else { return false }
        return me == owner
    }

    private var spotId: String { detail?.id ?? spot.id }

    /// Vote only on still-unverified spots, never your own.
    private var canVote: Bool {
        session.isAuthenticated && detail != nil && !isOwner && status == "UNVERIFIED"
    }

    private var statusDescription: String {
        switch status {
        case "VERIFIED": return "Deze plek is geverifieerd door de community."
        case "HIDDEN": return "Deze plek is verborgen."
        case "REMOVED": return "Deze plek is verwijderd."
        default: return "Nog niet bevestigd door de community."
        }
    }

    // MARK: - Body

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                heroPhoto

                VStack(alignment: .leading, spacing: DVH.s5) {
                    // Title block
                    titleBlock

                    // Jump to this spot on the map (hidden when already on the map tab)
                    if session.selectedTab != 0, spot.lat != nil, spot.lng != nil {
                        Button {
                            session.mapFocus = spot
                            session.selectedTab = 0
                            dismiss()
                        } label: {
                            Label("Bekijk op kaart", systemImage: "map")
                        }
                        .buttonStyle(.dvhSecondary)
                    }

                    // Description
                    if let desc = detail?.description, !desc.isEmpty {
                        Text(stripHTML(desc))
                            .font(.dvhBody)
                            .foregroundStyle(Brand.ink2)
                            .fixedSize(horizontal: false, vertical: true)
                    }

                    // Community check block
                    communityBlock

                    // Voting
                    voteSection

                    // Amenities
                    if let amenities = detail?.amenities, !amenities.isEmpty {
                        VStack(alignment: .leading, spacing: DVH.s2) {
                            SectionHeader(title: "Voorzieningen")
                            FlowChips(amenities: amenities)
                        }
                    }

                    // POI info
                    poiInfo

                    // Reviews
                    reviewsSection

                    // Report
                    reportRow

                    // Moderation card (moderators only)
                    if session.profile?.isModerator == true {
                        ModerationCardView(spotId: spotId, currentStatus: status)
                            .environmentObject(session)
                    }
                }
                .padding(.horizontal, DVH.s4)
                .padding(.top, DVH.s4)
                .padding(.bottom, DVH.s8)
            }
        }
        .background(Brand.sand)
        .task {
            loc.request()
            if detail == nil {
                detail = try? await APIClient.spotDetail(slug: spot.slug)
            }
            if reviews.isEmpty {
                reviews = (try? await APIClient.spotReviews(slug: spot.slug)) ?? []
            }
        }
        .sheet(item: $activeSheet) { sheet in
            switch sheet {
            case .signIn(let reason):
                SignInView(reason: reason, dismissable: true)
                    .environmentObject(session)
            case .writeReview:
                WriteReviewView(spotId: spotId) {
                    Task {
                        reviews = (try? await APIClient.spotReviews(slug: spot.slug)) ?? []
                    }
                }
                .environmentObject(session)
            case .report:
                ReportSheet(spotId: spotId)
                    .environmentObject(session)
            }
        }
    }

    // MARK: - Hero photo

    @ViewBuilder private var heroPhoto: some View {
        if let url = photoURL {
            AsyncImage(url: url) { img in
                img.resizable().scaledToFill()
            } placeholder: {
                Rectangle().fill(Brand.mossSoft)
            }
            .frame(height: 240)
            .frame(maxWidth: .infinity)
            .clipped()
        } else {
            ZStack {
                Rectangle().fill(Brand.mossSoft)
                Image(systemName: category?.icon ?? detail?.category.icon ?? "pawprint.fill")
                    .font(.system(size: 52))
                    .foregroundStyle(Brand.mossDark)
            }
            .frame(height: 240)
            .frame(maxWidth: .infinity)
        }
    }

    // MARK: - Title block

    @ViewBuilder private var titleBlock: some View {
        VStack(alignment: .leading, spacing: DVH.s2) {
            Text(spot.name)
                .font(.dvhTitle)
                .foregroundStyle(Brand.ink)

            let catLabel = category?.label ?? detail?.category.label
            if let label = catLabel {
                Text(label)
                    .font(.dvhCallout)
                    .foregroundStyle(Brand.ink2)
            }

            HStack(spacing: DVH.s3) {
                VerifiedBadge(verified: isVerified)
                if effectiveRating.count > 0 {
                    HStack(spacing: DVH.s1) {
                        StarRating(value: effectiveRating.average, size: 13)
                        Text("(\(effectiveRating.count))")
                            .font(.dvhCaption)
                            .foregroundStyle(Brand.ink2)
                    }
                }
            }
        }
    }

    // MARK: - Community check block

    @ViewBuilder private var communityBlock: some View {
        VStack(alignment: .leading, spacing: DVH.s2) {
            HStack(spacing: DVH.s2) {
                VerifiedBadge(verified: isVerified)
                Text(statusDescription)
                    .font(.dvhCaption)
                    .foregroundStyle(Brand.ink2)
            }

            if let result = voteResult {
                VStack(alignment: .leading, spacing: DVH.s2) {
                    HStack(spacing: DVH.s4) {
                        Label("\(result.confirmCount)", systemImage: "checkmark.circle.fill")
                            .font(.dvhCaption.weight(.semibold))
                            .foregroundStyle(Brand.moss)
                        Label("\(result.denyCount)", systemImage: "xmark.circle.fill")
                            .font(.dvhCaption.weight(.semibold))
                            .foregroundStyle(Brand.terra)
                        Text("Score: \(String(format: "%.0f", result.netScore))")
                            .font(.dvhCaption)
                            .foregroundStyle(Brand.ink2)
                    }
                    VoteProgressBar(netScore: result.netScore)
                }
            }
        }
        .dvhCard()
    }

    // MARK: - Vote section

    @ViewBuilder private var voteSection: some View {
        if let result = voteResult {
            VStack(alignment: .leading, spacing: DVH.s2) {
                Label(
                    result.vote.value == "CONFIRM"
                        ? "Je hebt deze plek bevestigd"
                        : "Je hebt deze plek afgewezen",
                    systemImage: result.vote.value == "CONFIRM"
                        ? "checkmark.circle.fill" : "xmark.circle.fill"
                )
                .font(.dvhCallout.weight(.medium))
                .foregroundStyle(result.vote.value == "CONFIRM" ? Brand.mossDark : Brand.terra)

                Text(result.vote.proximityVerified
                    ? "Je was in de buurt, dus je stem telt extra mee."
                    : "Je stem is geteld. (Niet in de buurt: halve weging.)")
                    .font(.dvhCaption)
                    .foregroundStyle(Brand.ink2)
            }
            .dvhCard()
        } else if isOwner {
            Label("Dit is jouw plek. Anderen bevestigen hem.", systemImage: "person.fill")
                .font(.dvhCaption)
                .foregroundStyle(Brand.ink2)
                .dvhCard()
        } else if status == "UNVERIFIED" {
            if !session.isAuthenticated {
                Button {
                    activeSheet = .signIn(reason: "Log in om deze plek te bevestigen of af te wijzen.")
                } label: {
                    Label("Log in om te bevestigen", systemImage: "person.crop.circle.badge.plus")
                }
                .buttonStyle(.dvhPrimary)
            } else if canVote {
                VStack(alignment: .leading, spacing: DVH.s3) {
                    Text("Ken je deze plek?")
                        .font(.dvhHeadline)
                        .foregroundStyle(Brand.ink)
                    HStack(spacing: DVH.s2) {
                        Button { castVote("CONFIRM") } label: {
                            Label("Bevestigen", systemImage: "checkmark")
                        }
                        .buttonStyle(.dvhPrimary)
                        .disabled(voting)

                        Button { castVote("DENY") } label: {
                            Label("Afwijzen", systemImage: "hand.thumbsdown")
                        }
                        .buttonStyle(.dvhPrimary(tint: Brand.terra))
                        .disabled(voting)
                    }
                    if voting {
                        ProgressView()
                    }
                    if let voteError {
                        Text(voteError)
                            .font(.dvhCaption)
                            .foregroundStyle(Brand.terra)
                    }
                }
            }
        }
    }

    // MARK: - POI info

    @ViewBuilder private var poiInfo: some View {
        let hasAddress = !(detail?.address ?? "").isEmpty
        let hasSite = detail?.website != nil

        if hasAddress || hasSite {
            VStack(alignment: .leading, spacing: DVH.s3) {
                if let addr = detail?.address, !addr.isEmpty {
                    Button {
                        openInMaps(address: addr)
                    } label: {
                        Label(addr, systemImage: "mappin.and.ellipse")
                            .font(.dvhCallout)
                            .foregroundStyle(Brand.ink2)
                            .multilineTextAlignment(.leading)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
                if let site = detail?.website, let url = URL(string: site) {
                    Link(destination: url) {
                        Label("Website", systemImage: "safari")
                            .font(.dvhCallout)
                            .foregroundStyle(Brand.moss)
                    }
                }
            }
            .dvhCard()
        }
    }

    private func openInMaps(address: String) {
        let encoded = address.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        if let url = URL(string: "maps://?q=\(encoded)") {
            UIApplication.shared.open(url)
        }
    }

    // MARK: - Reviews section

    @ViewBuilder private var reviewsSection: some View {
        VStack(alignment: .leading, spacing: DVH.s3) {
            SectionHeader(
                title: "Recensies",
                action: {
                    if session.isAuthenticated {
                        activeSheet = .writeReview
                    } else {
                        activeSheet = .signIn(reason: "Log in om een recensie te schrijven.")
                    }
                },
                actionLabel: "Schrijf recensie"
            )

            if reviews.isEmpty {
                VStack(spacing: DVH.s2) {
                    Text("Nog geen recensies.")
                        .font(.dvhCallout)
                        .foregroundStyle(Brand.ink2)
                    Button {
                        if session.isAuthenticated {
                            activeSheet = .writeReview
                        } else {
                            activeSheet = .signIn(reason: "Log in om een recensie te schrijven.")
                        }
                    } label: {
                        Label("Schrijf een recensie", systemImage: "pencil")
                    }
                    .buttonStyle(.dvhSecondary)
                }
                .padding(.vertical, DVH.s2)
            } else {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(reviews) { review in
                        ReviewRow(review: review)
                        if review.id != reviews.last?.id {
                            Divider()
                        }
                    }
                }
                .dvhCard(padding: DVH.s3)
            }
        }
    }

    // MARK: - Report row

    @ViewBuilder private var reportRow: some View {
        Button {
            if session.isAuthenticated {
                activeSheet = .report
            } else {
                activeSheet = .signIn(reason: "Log in om een probleem te melden.")
            }
        } label: {
            HStack(spacing: DVH.s2) {
                Image(systemName: "flag")
                    .font(.subheadline)
                    .foregroundStyle(Brand.ink2)
                Text("Probleem melden")
                    .font(.dvhCallout)
                    .foregroundStyle(Brand.ink2)
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Brand.ink2.opacity(0.5))
            }
            .padding(.vertical, DVH.s2)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    // MARK: - Vote

    private func castVote(_ value: String) {
        guard let token = session.token else {
            activeSheet = .signIn(reason: "Log in om te stemmen.")
            return
        }
        voting = true
        voteError = nil
        Task {
            let proof = loc.coordinate.map { GeoPoint(lat: $0.latitude, lng: $0.longitude) }
            do {
                voteResult = try await APIClient.vote(
                    spotId: spot.id, value: value, proof: proof, token: token)
            } catch let e as APIError {
                if session.signOutIfUnauthorized(e) {
                    voteError = "Je sessie is verlopen. Log opnieuw in."
                    activeSheet = .signIn(reason: "Log opnieuw in om te stemmen.")
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

    // MARK: - Helpers

    private func stripHTML(_ s: String) -> String {
        s.replacingOccurrences(of: "<[^>]+>", with: " ", options: .regularExpression)
            .replacingOccurrences(of: "&nbsp;", with: " ")
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

// MARK: - FlowChips (non-interactive amenity grid, preserved + unchanged)

struct FlowChips: View {
    let amenities: [Amenity]
    var body: some View {
        let columns = [GridItem(.adaptive(minimum: 90), spacing: DVH.s2)]
        LazyVGrid(columns: columns, alignment: .leading, spacing: DVH.s2) {
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
