import SwiftUI
import CoreLocation

struct NearbyScreen: View {
    @StateObject private var loc = LocationManager()
    @State private var categories: [Category] = []
    @State private var spots: [SpotSummary] = []
    @State private var query = ""
    @State private var selected: SpotSummary?
    @State private var loading = false

    private var categoriesById: [String: Category] {
        Dictionary(uniqueKeysWithValues: categories.map { ($0.id, $0) })
    }

    private var locKey: String {
        guard let c = loc.coordinate else { return "" }
        return "\((c.latitude * 100).rounded() / 100),\((c.longitude * 100).rounded() / 100)"
    }

    private var filtered: [SpotSummary] {
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        guard !q.isEmpty else { return spots }
        return spots.filter {
            $0.name.lowercased().contains(q)
                || (categoriesById[$0.categoryId]?.label.lowercased().contains(q) ?? false)
        }
    }

    var body: some View {
        NavigationStack {
            Group {
                if loading && spots.isEmpty {
                    ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if spots.isEmpty {
                    emptyState
                } else {
                    List(filtered) { spot in
                        Button { selected = spot } label: {
                            SpotRow(spot: spot, category: categoriesById[spot.categoryId],
                                    distance: distance(to: spot))
                        }
                        .buttonStyle(.plain)
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle("Nabij")
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

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: loc.coordinate == nil ? "location.slash" : "magnifyingglass")
                .font(.system(size: 44)).foregroundStyle(Brand.moss)
            Text(loc.coordinate == nil ? "Locatie nodig" : "Geen plekken gevonden")
                .font(.headline).foregroundStyle(Brand.ink)
            Text(loc.coordinate == nil
                ? "Zet locatie aan om hondenplekken bij jou in de buurt te zien."
                : "Probeer een andere zoekterm of beweeg over de kaart.")
                .font(.subheadline).foregroundStyle(Brand.ink2)
                .multilineTextAlignment(.center).padding(.horizontal, 40)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func loadSpots() async {
        guard let c = loc.coordinate else { return }
        loading = true
        defer { loading = false }
        let result = try? await APIClient.spotsNear(lat: c.latitude, lng: c.longitude, limit: 100)
        guard !Task.isCancelled else { return }  // a newer cell superseded this
        spots = result?.items ?? []
    }

    private func distance(to spot: SpotSummary) -> CLLocationDistance? {
        guard let c = loc.coordinate, let s = spot.coordinate else { return nil }
        return CLLocation(latitude: c.latitude, longitude: c.longitude)
            .distance(from: CLLocation(latitude: s.latitude, longitude: s.longitude))
    }
}

struct SpotRow: View {
    let spot: SpotSummary
    let category: Category?
    let distance: CLLocationDistance?

    var body: some View {
        HStack(spacing: 12) {
            thumb
            VStack(alignment: .leading, spacing: 4) {
                Text(spot.name).font(.body.weight(.medium)).foregroundStyle(Brand.ink).lineLimit(1)
                HStack(spacing: 6) {
                    if let category { Text(category.label) }
                    if let distance { Text("· \(formatted(distance))") }
                }
                .font(.caption).foregroundStyle(Brand.ink2)
                VerifiedBadge(verified: spot.isVerified)
            }
            Spacer()
            Image(systemName: "chevron.right").font(.caption).foregroundStyle(.tertiary)
        }
        .padding(.vertical, 4)
    }

    @ViewBuilder private var thumb: some View {
        let size: CGFloat = 56
        if let u = spot.photoUrl, let url = URL(string: u) {
            AsyncImage(url: url) { img in img.resizable().scaledToFill() } placeholder: {
                Rectangle().fill(Brand.mossSoft)
            }
            .frame(width: size, height: size).clipShape(RoundedRectangle(cornerRadius: 12))
        } else {
            ZStack {
                RoundedRectangle(cornerRadius: 12).fill(Brand.mossSoft)
                Image(systemName: category?.icon ?? "pawprint.fill").foregroundStyle(Brand.mossDark)
            }
            .frame(width: size, height: size)
        }
    }

    private func formatted(_ m: CLLocationDistance) -> String {
        m < 1000 ? "\(Int((m / 10).rounded()) * 10) m"
            : String(format: "%.1f km", m / 1000).replacingOccurrences(of: ".", with: ",")
    }
}
