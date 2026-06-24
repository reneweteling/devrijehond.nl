import SwiftUI

struct WensenScreen: View {
    @EnvironmentObject var session: Session

    @State private var requests: [FeatureRequest] = []
    @State private var selectedStatus: String? = nil   // nil = "Populair"
    @State private var mineOnly = false                // "Mijn wensen"
    @State private var loading = false
    @State private var errorMessage: String? = nil
    @State private var showNew = false
    @State private var showSignIn = false

    /// "Mijn wensen": requests I submitted myself, or upvoted.
    private func isMine(_ req: FeatureRequest) -> Bool {
        if let h = req.author?.handle, let me = session.profile?.handle, h == me { return true }
        return req.viewerHasVoted == true
    }

    private var displayed: [FeatureRequest] {
        mineOnly ? requests.filter(isMine) : requests
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(spacing: 0) {
                    filterRow
                        .padding(.top, DVH.s2)
                    resultsSection
                        .padding(.top, DVH.s3)
                }
            }
            .background(Brand.sand)
            .refreshable { await loadRequests() }
            .navigationTitle("Wensen")
            .navigationBarTitleDisplayMode(.inline)
            .overlay(alignment: .bottomTrailing) {
                fab.padding([.bottom, .trailing], DVH.s5)
            }
        }
        .sheet(isPresented: $showNew) {
            RequestNewView { newRequest in
                requests.insert(newRequest, at: 0)
            }
        }
        .sheet(isPresented: $showSignIn) {
            SignInView(
                reason: "Log in om een wens in te dienen of om te stemmen.",
                dismissable: true
            )
            .environmentObject(session)
        }
        .task { await loadRequests() }
    }

    // MARK: - Filter chips (scroll with the content)

    private var filterRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: DVH.s2) {
                if session.isAuthenticated {
                    DVHChip(label: "Mijn wensen", icon: "person.fill", selected: mineOnly) {
                        mineOnly = true
                        selectedStatus = nil
                    }
                }
                DVHChip(label: "Populair", selected: !mineOnly && selectedStatus == nil) {
                    selectIf(status: nil)
                }
                ForEach(statusFilters, id: \.0) { status, label in
                    DVHChip(label: label, selected: !mineOnly && selectedStatus == status) {
                        selectIf(status: status)
                    }
                }
            }
            .padding(.horizontal, DVH.s4)
        }
    }

    private var statusFilters: [(String, String)] {
        [
            ("CONSIDERING", "In overweging"),
            ("PLANNED", "Gepland"),
            ("DONE", "Klaar"),
            ("DECLINED", "Afgewezen"),
        ]
    }

    private func selectIf(status: String?) {
        guard mineOnly || selectedStatus != status else { return }
        mineOnly = false
        selectedStatus = status
        Task { await loadRequests() }
    }

    // MARK: - Results

    @ViewBuilder private var resultsSection: some View {
        if loading && requests.isEmpty {
            ProgressView().tint(Brand.moss).frame(maxWidth: .infinity, minHeight: 360)
        } else if let msg = errorMessage {
            EmptyStateView(
                icon: "exclamationmark.circle",
                title: "Kon wensen niet laden",
                message: msg,
                actionLabel: "Opnieuw proberen"
            ) { Task { await loadRequests() } }
            .frame(minHeight: 360)
        } else if displayed.isEmpty {
            EmptyStateView(
                icon: mineOnly ? "person" : "lightbulb",
                title: mineOnly ? "Nog geen eigen wensen" : "Nog geen wensen",
                message: mineOnly
                    ? "Wensen die je zelf indient of waarop je stemt verschijnen hier."
                    : "Wees de eerste die een idee indient.",
                actionLabel: "Idee indienen"
            ) { handleFABTap() }
            .frame(minHeight: 360)
        } else {
            LazyVStack(spacing: DVH.s3) {
                ForEach(displayed) { req in
                    NavigationLink(destination: RequestDetailView(request: req)) {
                        WishCard(request: req)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, DVH.s4)
            .padding(.bottom, 100) // clear the FAB
        }
    }

    // MARK: - FAB

    private var fab: some View {
        Button { handleFABTap() } label: {
            Image(systemName: "plus")
                .font(.title2.weight(.semibold))
                .foregroundStyle(.white)
                .frame(width: 56, height: 56)
                .background(Brand.moss, in: Circle())
                .shadow(color: Brand.moss.opacity(0.35), radius: 12, y: 4)
        }
    }

    // MARK: - Actions

    private func handleFABTap() {
        if session.isAuthenticated { showNew = true } else { showSignIn = true }
    }

    private func loadRequests() async {
        loading = true
        errorMessage = nil
        do {
            // "Mijn wensen" cuts across statuses, so fetch everything and filter.
            requests = try await APIClient.featureRequests(status: mineOnly ? nil : selectedStatus)
        } catch {
            errorMessage = "Er is iets misgegaan. Probeer het opnieuw."
        }
        loading = false
    }
}

// MARK: - WishCard

private struct WishCard: View {
    let request: FeatureRequest

    var body: some View {
        HStack(alignment: .top, spacing: DVH.s3) {
            VStack(alignment: .leading, spacing: DVH.s2) {
                Text(request.title)
                    .font(.dvhHeadline)
                    .foregroundStyle(Brand.ink)
                    .multilineTextAlignment(.leading)

                if let body = request.body, !body.isEmpty {
                    Text(body)
                        .font(.dvhBody)
                        .foregroundStyle(Brand.ink2)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                }

                if let component = request.component, !component.isEmpty {
                    WishComponentTag(label: component)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            upvoteColumn
        }
        .dvhCard()
    }

    private var upvoteColumn: some View {
        VStack(spacing: DVH.s1) {
            Image(systemName: request.viewerHasVoted == true ? "chevron.up.circle.fill" : "chevron.up.circle")
                .font(.system(size: 22, weight: .medium))
                .foregroundStyle(request.viewerHasVoted == true ? Brand.moss : Brand.ink2)
            Text("\(request.upvoteCount ?? 0)")
                .font(.dvhCaption.weight(.semibold))
                .foregroundStyle(Brand.ink2)
        }
    }
}

// MARK: - WishComponentTag

private struct WishComponentTag: View {
    let label: String

    var body: some View {
        Text(label)
            .font(.dvhCaption.weight(.medium))
            .foregroundStyle(Brand.mossDark)
            .padding(.horizontal, DVH.s2 + 2)
            .padding(.vertical, DVH.s1)
            .background(Brand.mossSoft.opacity(0.7), in: Capsule())
    }
}
