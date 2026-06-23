import SwiftUI

/// Spot peek/detail. Starts from the summary we already have (instant), then
/// loads the full detail (description, amenities, address) in the background.
struct SpotDetailView: View {
    let spot: SpotSummary
    let category: Category?

    @State private var detail: SpotDetail?

    private var photoURL: URL? {
        if let u = detail?.photos.first?.url ?? spot.photoUrl { return URL(string: u) }
        return nil
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
                }
                .padding(16)
            }
        }
        .background(Brand.sand)
        .task {
            if detail == nil { detail = try? await APIClient.spotDetail(slug: spot.slug) }
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
