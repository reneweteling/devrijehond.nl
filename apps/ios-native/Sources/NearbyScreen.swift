import SwiftUI
import CoreLocation
import UIKit

struct NearbyScreen: View {
    @StateObject private var loc = LocationManager()
    @State private var categories: [Category] = []
    @State private var spots: [SpotSummary] = []
    @State private var query = ""
    @State private var selectedCategoryId: String? = nil
    @State private var selected: SpotSummary?
    @State private var loading = false
    @State private var loadFailed = false

    private var categoriesById: [String: Category] {
        Dictionary(uniqueKeysWithValues: categories.map { ($0.id, $0) })
    }

    private var locKey: String {
        guard let c = loc.coordinate else { return "" }
        return "\((c.latitude * 100).rounded() / 100),\((c.longitude * 100).rounded() / 100)"
    }

    private var filtered: [SpotSummary] {
        var result = spots

        // Category single-select filter
        if let catId = selectedCategoryId {
            result = result.filter { $0.categoryId == catId }
        }

        // Text search
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        if !q.isEmpty {
            result = result.filter {
                $0.name.lowercased().contains(q)
                    || (categoriesById[$0.categoryId]?.label.lowercased().contains(q) ?? false)
            }
        }

        return result
    }

    var body: some View {
        NavigationStack {
            ZStack(alignment: .top) {
                // Ground color fills the entire screen including behind the header.
                Brand.sand.ignoresSafeArea()

                Group {
                    if loading && spots.isEmpty {
                        loadingView
                            .padding(.top, headerHeight)
                    } else if spots.isEmpty || loadFailed {
                        noLocationState
                            .padding(.top, headerHeight)
                    } else if filtered.isEmpty {
                        EmptyStateView(
                            icon: "magnifyingglass",
                            title: "Geen resultaten",
                            message: "Niets gevonden met deze filters. Pas de categorie of zoekterm aan.",
                            actionLabel: "Filters wissen"
                        ) {
                            query = ""
                            selectedCategoryId = nil
                        }
                        .padding(.top, headerHeight)
                    } else {
                        spotList
                            // Top inset so the first row starts below the sticky header.
                            .safeAreaInset(edge: .top, spacing: 0) {
                                Color.clear.frame(height: chipsHeight)
                            }
                    }
                }

                // Sticky glass header: category chips on a frosted surface.
                // Sits right below the navigation bar; scrolling content passes under it.
                if !categories.isEmpty {
                    VStack(spacing: 0) {
                        categoryChips
                            .padding(.vertical, DVH.s2)
                        Divider().opacity(0.35)
                    }
                    .background(.ultraThinMaterial)
                    .frame(maxWidth: .infinity)
                }
            }
            .navigationTitle("Nabij")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Brand.sand, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .searchable(text: $query, prompt: "Zoek op naam of categorie")
        }
        .task {
            loc.request()
            if categories.isEmpty { categories = (try? await APIClient.categories()) ?? [] }
        }
        // .task(id:) auto-cancels the previous fetch when the coarse cell changes,
        // so a moving GPS fix can't trigger a refetch storm or out-of-order writes.
        .task(id: locKey) {
            if !locKey.isEmpty { await loadSpots() }
        }
        .sheet(item: $selected) { spot in
            SpotDetailView(spot: spot, category: categoriesById[spot.categoryId])
                .presentationDetents([.medium, .large])
        }
    }

    // Approximate heights used for padding non-scrollable states below the header.
    private var chipsHeight: CGFloat { categories.isEmpty ? 0 : 48 }
    private var headerHeight: CGFloat { chipsHeight }

    // MARK: Category chip row (single-select)

    private var categoryChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: DVH.s2) {
                DVHChip(
                    label: "Alles",
                    selected: selectedCategoryId == nil,
                    tint: Brand.moss
                ) {
                    selectedCategoryId = nil
                }

                ForEach(categories) { cat in
                    DVHChip(
                        label: cat.label,
                        icon: cat.icon,
                        selected: selectedCategoryId == cat.id,
                        tint: Brand.categoryColor(cat.slug)
                    ) {
                        selectedCategoryId = selectedCategoryId == cat.id ? nil : cat.id
                    }
                }
            }
            .padding(.horizontal, DVH.s4)
        }
    }

    // MARK: Spot list

    private var spotList: some View {
        List(filtered) { spot in
            Button { selected = spot } label: {
                SpotRow(
                    spot: spot,
                    category: categoriesById[spot.categoryId],
                    distance: distance(to: spot)
                )
            }
            .buttonStyle(.plain)
            .listRowBackground(Brand.cream)
            .listRowInsets(EdgeInsets(top: 0, leading: DVH.s4, bottom: 0, trailing: DVH.s4))
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .background(Brand.sand)
        .refreshable { await loadSpots() }
    }

    // MARK: Empty / loading states

    private var loadingView: some View {
        VStack(spacing: DVH.s3) {
            Spacer()
            ProgressView()
                .scaleEffect(1.3)
                .tint(Brand.moss)
            Text("Zoeken naar plekken bij jou in de buurt...")
                .font(.dvhCallout)
                .foregroundStyle(Brand.ink2)
            Spacer()
        }
        .frame(maxWidth: .infinity)
    }

    @ViewBuilder
    private var noLocationState: some View {
        if loadFailed {
            EmptyStateView(
                icon: "wifi.slash",
                title: "Verbinding mislukt",
                message: "We konden de plekken niet laden. Probeer het opnieuw.",
                actionLabel: "Opnieuw proberen"
            ) {
                Task { await loadSpots() }
            }
        } else if loc.coordinate == nil {
            EmptyStateView(
                icon: "location.slash.fill",
                title: "Locatie nodig",
                message: "Zet locatie aan om hondenplekken bij jou in de buurt te zien.",
                actionLabel: "Open Instellingen"
            ) {
                if let url = URL(string: UIApplication.openSettingsURLString) {
                    UIApplication.shared.open(url)
                }
            }
        } else {
            EmptyStateView(
                icon: "pawprint.fill",
                title: "Geen plekken gevonden",
                message: "Probeer een andere zoekterm of beweeg over de kaart."
            )
        }
    }

    // MARK: Data loading

    private func loadSpots() async {
        guard let c = loc.coordinate else { return }
        loading = true
        loadFailed = false
        defer { loading = false }
        guard let result = try? await APIClient.spotsNear(lat: c.latitude, lng: c.longitude, limit: 100) else {
            guard !Task.isCancelled else { return }
            loadFailed = true
            return
        }
        guard !Task.isCancelled else { return }  // a newer cell superseded this
        spots = result.items
    }

    private func distance(to spot: SpotSummary) -> CLLocationDistance? {
        guard let c = loc.coordinate, let s = spot.coordinate else { return nil }
        return CLLocation(latitude: c.latitude, longitude: c.longitude)
            .distance(from: CLLocation(latitude: s.latitude, longitude: s.longitude))
    }
}

// MARK: - Spot row

struct SpotRow: View {
    let spot: SpotSummary
    let category: Category?
    let distance: CLLocationDistance?

    var body: some View {
        HStack(spacing: DVH.s3) {
            thumb
            VStack(alignment: .leading, spacing: DVH.s1) {
                Text(spot.name)
                    .font(.dvhBody.weight(.medium))
                    .foregroundStyle(Brand.ink)
                    .lineLimit(1)
                HStack(spacing: 6) {
                    if let category {
                        Text(category.label).foregroundStyle(Brand.ink2)
                    }
                    if let distance {
                        Text("· \(formatted(distance))").foregroundStyle(Brand.ink2)
                    }
                }
                .font(.dvhCaption)
                VerifiedBadge(verified: spot.isVerified)
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
        .padding(.vertical, DVH.s1 + 2)
        .contentShape(Rectangle())
    }

    @ViewBuilder private var thumb: some View {
        let size: CGFloat = 56
        if let u = spot.photoUrl, let url = URL(string: u) {
            AsyncImage(url: url) { img in
                img.resizable().scaledToFill()
            } placeholder: {
                Rectangle().fill(Brand.mossSoft)
            }
            .frame(width: size, height: size)
            .clipShape(RoundedRectangle(cornerRadius: DVH.rSm + 2))
        } else {
            ZStack {
                RoundedRectangle(cornerRadius: DVH.rSm + 2).fill(Brand.mossSoft)
                Image(systemName: category?.icon ?? "pawprint.fill")
                    .font(.system(size: 22))
                    .foregroundStyle(Brand.mossDark)
            }
            .frame(width: size, height: size)
        }
    }

    private func formatted(_ m: CLLocationDistance) -> String {
        m < 1000 ? "\(Int((m / 10).rounded()) * 10) m"
            : String(format: "%.1f km", m / 1000).replacingOccurrences(of: ".", with: ",")
    }
}
