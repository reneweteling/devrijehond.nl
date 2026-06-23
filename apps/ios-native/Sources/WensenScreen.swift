import SwiftUI

struct WensenScreen: View {
    @State private var requests: [FeatureRequest] = []
    @State private var loading = false

    var body: some View {
        NavigationStack {
            Group {
                if loading && requests.isEmpty {
                    ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    List(requests) { req in
                        VStack(alignment: .leading, spacing: 6) {
                            Text(req.title).font(.body.weight(.medium)).foregroundStyle(Brand.ink)
                            if let body = req.body, !body.isEmpty {
                                Text(body).font(.caption).foregroundStyle(Brand.ink2).lineLimit(3)
                            }
                            HStack(spacing: 8) {
                                statusBadge(req.status)
                                if let c = req.component { Text(c).font(.caption2).foregroundStyle(.tertiary) }
                            }
                        }
                        .padding(.vertical, 4)
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle("Wensen")
        }
        .task {
            if requests.isEmpty {
                loading = true
                requests = (try? await APIClient.featureRequests()) ?? []
                loading = false
            }
        }
    }

    private func statusBadge(_ status: String) -> some View {
        let (label, color): (String, Color) = {
            switch status {
            case "PLANNED": return ("Gepland", Brand.moss)
            case "DONE": return ("Klaar", Brand.mossDark)
            case "DECLINED": return ("Afgewezen", Brand.rust)
            default: return ("In overweging", Brand.terra)
            }
        }()
        return Text(label)
            .font(.caption2.weight(.medium))
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background(color.opacity(0.15), in: Capsule())
            .foregroundStyle(color)
    }
}
