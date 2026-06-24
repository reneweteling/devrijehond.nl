import SwiftUI

// MARK: - SearchView

/// Sheet-based search, presented from MapScreen.
/// Results come from two sources: geocoder (for addresses/areas) and
/// a client-side name filter over the spots array passed in.
struct SearchView: View {
    /// Called when the user picks a geocoded address/place.
    let onSelectPlace: (GeocodeHit) -> Void
    /// Called when the user picks a spot from the guide.
    let onSelectSpot: (SpotSummary) -> Void
    /// Pre-loaded spots for offline name filtering (from the map or nearby cache).
    let knownSpots: [SpotSummary]
    /// Lookup table for category labels.
    let categoriesById: [String: Category]

    @Environment(\.dismiss) private var dismiss

    @State private var query = ""
    @State private var geocodeResults: [GeocodeHit] = []
    @State private var spotResults: [SpotSummary] = []
    @State private var isSearching = false
    @State private var debounceTask: Task<Void, Never>?

    @FocusState private var focused: Bool

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Search field
                HStack(spacing: DVH.s3) {
                    Image(systemName: "magnifyingglass")
                        .foregroundStyle(Brand.moss)
                        .font(.body.weight(.semibold))

                    TextField("Zoek een plek, gebied of adres", text: $query)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .focused($focused)
                        .submitLabel(.search)
                        .onSubmit { runSearch(immediate: true) }

                    if !query.isEmpty {
                        Button {
                            query = ""
                            geocodeResults = []
                            spotResults = []
                            isSearching = false
                        } label: {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundStyle(Brand.ink2)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, DVH.s4)
                .frame(height: DVH.controlHeight)
                .background(Brand.sand, in: RoundedRectangle(cornerRadius: DVH.rMd))
                .overlay(RoundedRectangle(cornerRadius: DVH.rMd)
                    .strokeBorder(Brand.ink.opacity(0.10)))
                .padding([.horizontal, .top], DVH.s4)
                .padding(.bottom, DVH.s3)

                Divider()

                if isSearching {
                    SearchLoadingView()
                } else if query.trimmingCharacters(in: .whitespaces).count < 2 {
                    SearchHintView()
                } else if geocodeResults.isEmpty && spotResults.isEmpty {
                    EmptyStateView(
                        icon: "magnifyingglass",
                        title: "Geen resultaten",
                        message: "Niets gevonden voor '\(query)'. Probeer een andere zoekterm.")
                } else {
                    resultsList
                }
            }
            .navigationTitle("Zoeken")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Sluiten") { dismiss() }
                        .font(.dvhBody)
                        .foregroundStyle(Brand.moss)
                }
            }
        }
        .onAppear { focused = true }
        .onChange(of: query) { _, _ in runSearch(immediate: false) }
    }

    // MARK: Result list

    private var resultsList: some View {
        List {
            if !geocodeResults.isEmpty {
                Section {
                    ForEach(geocodeResults) { hit in
                        Button {
                            onSelectPlace(hit)
                            dismiss()
                        } label: {
                            SearchGeoRow(hit: hit)
                        }
                        .buttonStyle(.plain)
                    }
                } header: {
                    SectionHeader(title: "Locaties")
                        .padding(.bottom, DVH.s1)
                }
            }

            if !spotResults.isEmpty {
                Section {
                    ForEach(spotResults) { spot in
                        Button {
                            onSelectSpot(spot)
                            dismiss()
                        } label: {
                            SearchSpotRow(spot: spot, category: categoriesById[spot.categoryId])
                        }
                        .buttonStyle(.plain)
                    }
                } header: {
                    SectionHeader(title: "In onze gids")
                        .padding(.bottom, DVH.s1)
                }
            }
        }
        .listStyle(.plain)
    }

    // MARK: Debounced search

    @MainActor
    private func runSearch(immediate: Bool) {
        debounceTask?.cancel()
        // Capture current query value before leaving MainActor context.
        let currentQuery = query
        let spots = knownSpots
        let catById = categoriesById
        debounceTask = Task {
            if !immediate {
                // Show spinner immediately so "Geen resultaten" doesn't flash
                // during the debounce window when a search is expected.
                if currentQuery.trimmingCharacters(in: .whitespaces).count >= 2 {
                    await MainActor.run { isSearching = true }
                }
                try? await Task.sleep(nanoseconds: 400_000_000)
            }
            guard !Task.isCancelled else { return }

            let q = currentQuery.trimmingCharacters(in: .whitespaces)
            guard q.count >= 2 else {
                await MainActor.run {
                    geocodeResults = []
                    spotResults = []
                    isSearching = false
                }
                return
            }

            await MainActor.run { isSearching = true }

            let lower = q.lowercased()
            let filteredSpots = spots.filter { spot in
                spot.name.lowercased().contains(lower)
                    || (catById[spot.categoryId]?.label.lowercased().contains(lower) ?? false)
            }
            let geo = (try? await APIClient.geocode(q)) ?? []

            guard !Task.isCancelled else { return }
            await MainActor.run {
                geocodeResults = geo
                spotResults = filteredSpots
                isSearching = false
            }
        }
    }
}

// MARK: - Helper views

private struct SearchHintView: View {
    var body: some View {
        VStack(spacing: DVH.s5) {
            Spacer()
            Image(systemName: "map.fill")
                .font(.system(size: 48))
                .foregroundStyle(Brand.mossSoft)
            VStack(spacing: DVH.s2) {
                Text("Typ minimaal 2 tekens")
                    .font(.dvhHeadline)
                    .foregroundStyle(Brand.ink)
                Text("Zoek op naam van een plek, categorie of een adres.")
                    .font(.dvhCallout)
                    .foregroundStyle(Brand.ink2)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, DVH.s8)
            }
            Spacer()
        }
    }
}

private struct SearchLoadingView: View {
    var body: some View {
        VStack(spacing: DVH.s3) {
            Spacer()
            ProgressView()
                .scaleEffect(1.2)
                .tint(Brand.moss)
            Text("Zoeken...")
                .font(.dvhCallout)
                .foregroundStyle(Brand.ink2)
            Spacer()
        }
    }
}

private struct SearchGeoRow: View {
    let hit: GeocodeHit

    var body: some View {
        HStack(spacing: DVH.s3) {
            ZStack {
                Circle()
                    .fill(Brand.mossSoft)
                    .frame(width: 40, height: 40)
                Image(systemName: "mappin.circle.fill")
                    .font(.system(size: 20))
                    .foregroundStyle(Brand.terra)
            }
            Text(hit.label)
                .font(.dvhBody)
                .foregroundStyle(Brand.ink)
                .lineLimit(2)
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
        .padding(.vertical, DVH.s1)
    }
}

private struct SearchSpotRow: View {
    let spot: SpotSummary
    let category: Category?

    var body: some View {
        HStack(spacing: DVH.s3) {
            let size: CGFloat = 40
            ZStack {
                RoundedRectangle(cornerRadius: DVH.rSm)
                    .fill(Brand.mossSoft)
                    .frame(width: size, height: size)
                Image(systemName: category?.icon ?? "pawprint.fill")
                    .font(.system(size: 18))
                    .foregroundStyle(category.map { Brand.categoryColor($0.slug) } ?? Brand.moss)
            }

            VStack(alignment: .leading, spacing: DVH.s1) {
                Text(spot.name)
                    .font(.dvhBody)
                    .foregroundStyle(Brand.ink)
                    .lineLimit(1)
                if let cat = category {
                    Text(cat.label)
                        .font(.dvhCaption)
                        .foregroundStyle(Brand.ink2)
                }
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
        .padding(.vertical, DVH.s1)
    }
}
