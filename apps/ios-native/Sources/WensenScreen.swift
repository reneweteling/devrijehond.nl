import SwiftUI

struct WensenScreen: View {
    @EnvironmentObject var session: Session

    @State private var requests: [FeatureRequest] = []
    @State private var selectedStatus: String? = nil   // nil = "Populair"
    @State private var loading = false
    @State private var errorMessage: String? = nil
    @State private var showNew = false
    @State private var showSignIn = false

    private struct StatusFilter: Identifiable {
        let id: String           // unique key used in ForEach
        let status: String?      // nil = no filter (popular)
        let label: String
        var isSelected: Bool
    }

    private var filters: [StatusFilter] {
        [
            StatusFilter(id: "all",         status: nil,           label: "Populair",      isSelected: selectedStatus == nil),
            StatusFilter(id: "CONSIDERING", status: "CONSIDERING", label: "In overweging", isSelected: selectedStatus == "CONSIDERING"),
            StatusFilter(id: "PLANNED",     status: "PLANNED",     label: "Gepland",       isSelected: selectedStatus == "PLANNED"),
            StatusFilter(id: "DONE",        status: "DONE",        label: "Klaar",         isSelected: selectedStatus == "DONE"),
            StatusFilter(id: "DECLINED",    status: "DECLINED",    label: "Afgewezen",     isSelected: selectedStatus == "DECLINED"),
        ]
    }

    var body: some View {
        NavigationStack {
            ZStack(alignment: .bottomTrailing) {
                Brand.sand.ignoresSafeArea()

                VStack(spacing: 0) {
                    filterRow
                    contentArea
                }

                fab
                    .padding([.bottom, .trailing], DVH.s5)
            }
            .navigationTitle("Wensen")
            .navigationBarTitleDisplayMode(.inline)
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

    // MARK: - Filter chips

    private var filterRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: DVH.s2) {
                ForEach(filters) { filter in
                    DVHChip(
                        label: filter.label,
                        selected: filter.isSelected
                    ) {
                        if selectedStatus != filter.status {
                            selectedStatus = filter.status
                            Task { await loadRequests() }
                        }
                    }
                }
            }
            .padding(.horizontal, DVH.s5)
            .padding(.vertical, DVH.s2)
        }
    }

    // MARK: - Content

    @ViewBuilder
    private var contentArea: some View {
        if loading && requests.isEmpty {
            Spacer()
            ProgressView()
                .frame(maxWidth: .infinity)
            Spacer()
        } else if let msg = errorMessage {
            EmptyStateView(
                icon: "exclamationmark.circle",
                title: "Kon wensen niet laden",
                message: msg,
                actionLabel: "Opnieuw proberen"
            ) {
                Task { await loadRequests() }
            }
        } else if requests.isEmpty {
            EmptyStateView(
                icon: "lightbulb",
                title: "Nog geen wensen",
                message: "Wees de eerste die een idee indient.",
                actionLabel: "Idee indienen"
            ) {
                handleFABTap()
            }
        } else {
            ScrollView {
                LazyVStack(spacing: DVH.s3) {
                    ForEach(requests) { req in
                        NavigationLink(destination: RequestDetailView(request: req)) {
                            WishCard(request: req)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, DVH.s5)
                .padding(.top, DVH.s3)
                .padding(.bottom, 100)   // clear FAB
            }
            .refreshable { await loadRequests() }
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
        if session.isAuthenticated {
            showNew = true
        } else {
            showSignIn = true
        }
    }

    private func loadRequests() async {
        loading = true
        errorMessage = nil
        do {
            requests = try await APIClient.featureRequests(status: selectedStatus)
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
            Image(systemName: "chevron.up.circle")
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
