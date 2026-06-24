import SwiftUI

struct RequestDetailView: View {
    @EnvironmentObject var session: Session

    let request: FeatureRequest

    @State private var upvoteCount: Int
    @State private var viewerHasVoted: Bool
    @State private var voting = false
    @State private var showSignIn = false
    @State private var voteError: String? = nil

    init(request: FeatureRequest) {
        self.request = request
        _upvoteCount    = State(initialValue: request.upvoteCount ?? 0)
        _viewerHasVoted = State(initialValue: request.viewerHasVoted ?? false)
    }

    var body: some View {
        ZStack {
            Brand.sand.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: DVH.s5) {
                    titleAndMeta
                    if let body = request.body, !body.isEmpty {
                        bodySection(body)
                    }
                    authorRow
                }
                .padding(.horizontal, DVH.s5)
                .padding(.top, DVH.s4)
                .padding(.bottom, DVH.s8)
            }
        }
        .navigationTitle("Wens")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                upvoteButton
            }
        }
        .sheet(isPresented: $showSignIn) {
            SignInView(
                reason: "Log in om te stemmen op wensen.",
                dismissable: true
            )
            .environmentObject(session)
        }
    }

    // MARK: - Title + meta

    private var titleAndMeta: some View {
        VStack(alignment: .leading, spacing: DVH.s3) {
            Text(request.title)
                .font(.dvhDisplay(24))
                .foregroundStyle(Brand.ink)

            HStack(spacing: DVH.s2) {
                WishStatusTag(status: request.status)

                if let component = request.component, !component.isEmpty {
                    Text(component)
                        .font(.dvhCaption.weight(.medium))
                        .foregroundStyle(Brand.mossDark)
                        .padding(.horizontal, DVH.s2 + 2)
                        .padding(.vertical, DVH.s1)
                        .background(Brand.mossSoft.opacity(0.7), in: Capsule())
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .dvhCard()
    }

    // MARK: - Body

    private func bodySection(_ text: String) -> some View {
        VStack(alignment: .leading, spacing: DVH.s2) {
            Text("Toelichting")
                .font(.dvhHeadline)
                .foregroundStyle(Brand.ink)
            Text(text)
                .font(.dvhBody)
                .foregroundStyle(Brand.ink2)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .dvhCard()
    }

    // MARK: - Author

    private var authorRow: some View {
        HStack(spacing: DVH.s3) {
            Avatar(
                url: request.author?.image,
                name: request.author?.handle,
                size: 40
            )
            VStack(alignment: .leading, spacing: 2) {
                Text("Ingediend door")
                    .font(.dvhCaption)
                    .foregroundStyle(Brand.ink2)
                if let handle = request.author?.handle {
                    Text("@\(handle)")
                        .font(.dvhCallout.weight(.semibold))
                        .foregroundStyle(Brand.ink)
                } else {
                    Text("Een hondenbaas")
                        .font(.dvhCallout)
                        .foregroundStyle(Brand.ink2)
                }
            }
            Spacer()

            if let date = formattedDate {
                Text(date)
                    .font(.dvhCaption)
                    .foregroundStyle(Brand.ink2)
            }
        }
        .dvhCard()
    }

    private var formattedDate: String? {
        guard let raw = request.createdAt else { return nil }
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = iso.date(from: raw) ?? {
            var f2 = ISO8601DateFormatter()
            f2.formatOptions = [.withInternetDateTime]
            return f2.date(from: raw)
        }()
        guard let date else { return nil }
        let f = DateFormatter()
        f.dateStyle = .medium
        f.timeStyle = .none
        f.locale = Locale(identifier: "nl_NL")
        return f.string(from: date)
    }

    // MARK: - Upvote button (toolbar)

    private var upvoteButton: some View {
        Button { handleVoteTap() } label: {
            HStack(spacing: DVH.s1 + 1) {
                if voting {
                    ProgressView().scaleEffect(0.75)
                } else {
                    Image(systemName: viewerHasVoted ? "chevron.up.circle.fill" : "chevron.up.circle")
                        .font(.system(size: 20, weight: .semibold))
                }
                Text("\(upvoteCount)")
                    .font(.dvhHeadline)
            }
            .foregroundStyle(viewerHasVoted ? Brand.moss : Brand.ink2)
            .padding(.horizontal, DVH.s3)
            .padding(.vertical, DVH.s2)
            .background(
                viewerHasVoted ? Brand.mossSoft : Brand.ink.opacity(0.06),
                in: Capsule()
            )
        }
        .disabled(voting)
    }

    // MARK: - Vote action

    private func handleVoteTap() {
        guard !voting else { return }
        if !session.isAuthenticated {
            showSignIn = true
            return
        }
        guard let token = session.token else { return }

        // Optimistic update
        let wasVoted = viewerHasVoted
        let prevCount = upvoteCount
        viewerHasVoted = !wasVoted
        upvoteCount    = wasVoted ? max(0, prevCount - 1) : prevCount + 1
        voteError      = nil
        voting         = true

        Task {
            do {
                let result = try await APIClient.toggleFeatureVote(id: request.id, token: token)
                upvoteCount    = result.upvoteCount
                viewerHasVoted = result.viewerHasVoted
            } catch {
                // Roll back
                viewerHasVoted = wasVoted
                upvoteCount    = prevCount
                voteError      = "Stem kon niet worden opgeslagen."
                _ = session.signOutIfUnauthorized(error)
            }
            voting = false
        }
    }
}

// MARK: - WishStatusTag

struct WishStatusTag: View {
    let status: String

    private var config: (label: String, color: Color, bg: Color) {
        switch status {
        case "CONSIDERING":
            return ("In overweging", Brand.terra, Brand.terra.opacity(0.14))
        case "PLANNED":
            return ("Gepland", Brand.mossDark, Brand.mossSoft)
        case "DONE":
            return ("Klaar", Brand.mossDark, Brand.mossSoft)
        case "DECLINED":
            return ("Afgewezen", Brand.rust, Brand.rust.opacity(0.12))
        default:
            return ("In overweging", Brand.terra, Brand.terra.opacity(0.14))
        }
    }

    var body: some View {
        Text(config.label)
            .font(.dvhCaption.weight(.semibold))
            .foregroundStyle(config.color)
            .padding(.horizontal, DVH.s3)
            .padding(.vertical, DVH.s1 + 1)
            .background(config.bg, in: Capsule())
    }
}
