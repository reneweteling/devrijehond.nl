import Foundation

enum APIError: LocalizedError {
    case badStatus(Int)
    case decoding(Error)
    case transport(Error)

    var errorDescription: String? {
        switch self {
        case .badStatus(let c): return "Server gaf status \(c)."
        case .decoding: return "Kon het antwoord niet lezen."
        case .transport: return "Geen verbinding."
        }
    }
}

/// Thin async client over the public + /me API at api.devrijehond.nl. Mirrors the
/// mobile app's data layer; the native screens never touch the DB directly.
struct APIClient {
    static let base = URL(string: "https://api.devrijehond.nl")!

    static func get<T: Decodable>(
        _ path: String,
        query: [URLQueryItem] = [],
        token: String? = nil,
        as type: T.Type
    ) async throws -> T {
        var comps = URLComponents(
            url: base.appendingPathComponent(path), resolvingAgainstBaseURL: false)!
        if !query.isEmpty { comps.queryItems = query }
        var req = URLRequest(url: comps.url!)
        req.timeoutInterval = 20
        if let token { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }

        let data: Data
        let resp: URLResponse
        do {
            (data, resp) = try await URLSession.shared.data(for: req)
        } catch {
            throw APIError.transport(error)
        }
        guard let http = resp as? HTTPURLResponse else { throw APIError.badStatus(0) }
        guard (200..<300).contains(http.statusCode) else { throw APIError.badStatus(http.statusCode) }
        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            throw APIError.decoding(error)
        }
    }

    // MARK: - Endpoints

    static func spotsMap(
        minLng: Double, minLat: Double, maxLng: Double, maxLat: Double, cluster: Bool
    ) async throws -> SpotsMapResponse {
        var q: [URLQueryItem] = [
            .init(name: "minLng", value: String(minLng)),
            .init(name: "minLat", value: String(minLat)),
            .init(name: "maxLng", value: String(maxLng)),
            .init(name: "maxLat", value: String(maxLat)),
        ]
        if cluster { q.append(.init(name: "cluster", value: "true")) }
        return try await get("/api/v1/spots/map", query: q, as: SpotsMapResponse.self)
    }

    static func spotsNear(lat: Double, lng: Double, limit: Int = 100) async throws -> SpotsListResponse {
        try await get(
            "/api/v1/spots",
            query: [
                .init(name: "nearLat", value: String(lat)),
                .init(name: "nearLng", value: String(lng)),
                .init(name: "limit", value: String(limit)),
            ],
            as: SpotsListResponse.self)
    }

    static func categories() async throws -> [Category] {
        try await get("/api/v1/categories", as: CategoriesResponse.self).items
    }

    static func me(token: String) async throws -> MeProfile {
        try await get("/api/v1/me", token: token, as: MeProfile.self)
    }

    static func spotDetail(slug: String) async throws -> SpotDetail {
        try await get("/api/v1/spots/\(slug)", as: SpotDetail.self)
    }

    static func featureRequests() async throws -> [FeatureRequest] {
        try await get("/api/v1/feature-requests", as: FeatureRequestsResponse.self).items
    }
}
