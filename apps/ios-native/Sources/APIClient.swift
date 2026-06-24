import Foundation

enum APIError: LocalizedError {
    case badStatus(Int)
    case server(code: String, message: String, status: Int)
    case decoding(Error)
    case transport(Error)
    case noToken

    var errorDescription: String? {
        switch self {
        case .badStatus(let c): return "Server gaf status \(c)."
        case .server(_, let message, _): return message
        case .decoding: return "Kon het antwoord niet lezen."
        case .transport: return "Geen verbinding."
        case .noToken: return "Je bent niet ingelogd."
        }
    }

    /// The UPPER_SNAKE error code from the API envelope, when present.
    var code: String? {
        if case .server(let code, _, _) = self { return code }
        return nil
    }

    var status: Int? {
        switch self {
        case .badStatus(let s): return s
        case .server(_, _, let s): return s
        default: return nil
        }
    }
}

/// Thin async client over the public + /me API at api.devrijehond.nl. Mirrors the
/// mobile app's data layer; the native screens never touch the DB directly. Every
/// request carries the X-API-Version header; /me/* calls carry the bearer.
struct APIClient {
    static let base = URL(string: "https://api.devrijehond.nl")!
    static let clientVersion = "native-0.1.0"

    // MARK: - Core request

    private static func makeRequest(
        _ method: String,
        path: String,
        query: [URLQueryItem] = [],
        token: String? = nil,
        jsonBody: Data? = nil,
        contentType: String? = nil
    ) -> URLRequest {
        var comps = URLComponents(
            url: base.appendingPathComponent(path), resolvingAgainstBaseURL: false)!
        if !query.isEmpty { comps.queryItems = query }
        var req = URLRequest(url: comps.url!)
        req.httpMethod = method
        req.timeoutInterval = 20
        req.setValue("v1", forHTTPHeaderField: "X-API-Version")
        req.setValue(clientVersion, forHTTPHeaderField: "X-Client-Version")
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        if let token { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        if let jsonBody {
            req.httpBody = jsonBody
            req.setValue(contentType ?? "application/json", forHTTPHeaderField: "Content-Type")
        }
        // /me/* must never be served from a cache.
        if path.hasPrefix("/api/v1/me") || path.hasPrefix("/api/auth") {
            req.cachePolicy = .reloadIgnoringLocalCacheData
        }
        return req
    }

    /// Runs a request and validates the status, surfacing the API's
    /// `{ error, message }` envelope as `APIError.server` on failure.
    private static func send(_ req: URLRequest) async throws -> Data {
        let data: Data
        let resp: URLResponse
        do {
            (data, resp) = try await URLSession.shared.data(for: req)
        } catch {
            throw APIError.transport(error)
        }
        guard let http = resp as? HTTPURLResponse else { throw APIError.badStatus(0) }
        guard (200..<300).contains(http.statusCode) else {
            if let env = try? JSONDecoder().decode(ErrorEnvelope.self, from: data) {
                throw APIError.server(code: env.error, message: env.message ?? env.error,
                                      status: http.statusCode)
            }
            throw APIError.badStatus(http.statusCode)
        }
        return data
    }

    private static func decode<T: Decodable>(_ data: Data, as type: T.Type) throws -> T {
        do { return try JSONDecoder().decode(T.self, from: data) }
        catch { throw APIError.decoding(error) }
    }

    private struct ErrorEnvelope: Decodable {
        let error: String
        let message: String?
    }

    // MARK: - Verbs

    static func get<T: Decodable>(
        _ path: String, query: [URLQueryItem] = [], token: String? = nil, as type: T.Type
    ) async throws -> T {
        let data = try await send(makeRequest("GET", path: path, query: query, token: token))
        return try decode(data, as: T.self)
    }

    static func post<T: Decodable, B: Encodable>(
        _ path: String, body: B, token: String? = nil, as type: T.Type
    ) async throws -> T {
        let payload = try JSONEncoder().encode(body)
        let data = try await send(makeRequest("POST", path: path, token: token, jsonBody: payload))
        return try decode(data, as: T.self)
    }

    @discardableResult
    static func postNoContent<B: Encodable>(
        _ path: String, body: B, token: String? = nil
    ) async throws -> Bool {
        let payload = try JSONEncoder().encode(body)
        _ = try await send(makeRequest("POST", path: path, token: token, jsonBody: payload))
        return true
    }

    // MARK: - Public read endpoints

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

    static func amenities(categoryId: String? = nil) async throws -> [Amenity] {
        var q: [URLQueryItem] = []
        if let categoryId { q.append(.init(name: "categoryId", value: categoryId)) }
        return try await get("/api/v1/amenities", query: q, as: AmenitiesResponse.self).items
    }

    static func spotDetail(slug: String) async throws -> SpotDetail {
        try await get("/api/v1/spots/\(slug)", as: SpotDetail.self)
    }

    static func featureRequests() async throws -> [FeatureRequest] {
        try await get("/api/v1/feature-requests", as: FeatureRequestsResponse.self).items
    }

    // MARK: - Authenticated endpoints (/me/*)

    static func me(token: String) async throws -> MeProfile {
        try await get("/api/v1/me", token: token, as: MeProfile.self)
    }

    static func submitSpot(_ body: SubmitSpotBody, token: String) async throws -> CreatedSpot {
        try await post("/api/v1/me/spots", body: body, token: token, as: CreatedSpot.self)
    }

    static func vote(
        spotId: String, value: String, proof: GeoPoint?, token: String
    ) async throws -> VoteResponse {
        try await post("/api/v1/me/spots/\(spotId)/vote",
                       body: VoteBody(value: value, proof: proof), token: token,
                       as: VoteResponse.self)
    }

    // MARK: - Auth bridge

    static func exchangeIdToken(provider: String, idToken: String) async throws -> AuthToken {
        try await post("/api/auth/mobile/\(provider)",
                       body: IdTokenBody(idToken: idToken), as: AuthToken.self)
    }

    static func requestMagicLink(email: String) async throws {
        try await postNoContent("/api/auth/sign-in/magic-link",
                                body: MagicLinkBody(email: email, callbackURL: "vrijehond://verify"))
    }

    /// Redeems a magic-link token. BetterAuth returns the bearer in the
    /// `set-auth-token` response header (HttpOnly Set-Cookie is opaque to us), so
    /// we must NOT follow the redirect that would swallow it.
    static func verifyMagicLink(token: String) async throws -> AuthToken {
        let req = makeRequest(
            "GET", path: "/api/auth/magic-link/verify",
            query: [.init(name: "token", value: token)])
        let delegate = NoRedirect()
        let session = URLSession(configuration: .ephemeral, delegate: delegate, delegateQueue: nil)
        defer { session.finishTasksAndInvalidate() }

        let data: Data
        let resp: URLResponse
        do { (data, resp) = try await session.data(for: req) }
        catch { throw APIError.transport(error) }

        guard let http = resp as? HTTPURLResponse else { throw APIError.badStatus(0) }
        // 3xx (redirect held back by the delegate) and 2xx both mean success.
        guard (200..<400).contains(http.statusCode) else {
            if let env = try? JSONDecoder().decode(ErrorEnvelope.self, from: data) {
                throw APIError.server(code: env.error, message: env.message ?? env.error,
                                      status: http.statusCode)
            }
            throw APIError.badStatus(http.statusCode)
        }
        if let header = http.value(forHTTPHeaderField: "set-auth-token")
            ?? http.value(forHTTPHeaderField: "x-auth-token"), !header.isEmpty {
            return AuthToken(token: header, expiresAt: nil)
        }
        // Fallback: a JSON body carrying { token } / { session: { token } }.
        if let body = try? JSONDecoder().decode(VerifyBody.self, from: data),
           let t = body.token ?? body.session?.token {
            return AuthToken(token: t, expiresAt: body.session?.expiresAt)
        }
        // Last resort: parse the *session_token cookie out of Set-Cookie (matches
        // the Expo reference's third channel for older bearer-plugin behaviour).
        if let cookie = http.value(forHTTPHeaderField: "Set-Cookie"),
           let range = cookie.range(
            of: "[^=;\\s]*session_token=([^;]+)", options: .regularExpression) {
            let pair = String(cookie[range])
            if let eq = pair.firstIndex(of: "="),
               let decoded = String(pair[pair.index(after: eq)...])
                .removingPercentEncoding, !decoded.isEmpty {
                return AuthToken(token: decoded, expiresAt: nil)
            }
        }
        throw APIError.server(code: "no_session", message: "Geen sessie ontvangen.", status: 401)
    }

    // MARK: - Photo upload

    /// POST /api/v1/me/uploads (multipart, field `file`) → { publicUrl, key }.
    static func uploadPhoto(jpeg: Data, token: String) async throws -> String {
        let boundary = "dvh-\(UUID().uuidString)"
        var body = Data()
        func append(_ s: String) { body.append(Data(s.utf8)) }
        append("--\(boundary)\r\n")
        append("Content-Disposition: form-data; name=\"file\"; filename=\"photo.jpg\"\r\n")
        append("Content-Type: image/jpeg\r\n\r\n")
        body.append(jpeg)
        append("\r\n--\(boundary)--\r\n")

        var req = makeRequest("POST", path: "/api/v1/me/uploads", token: token)
        req.httpBody = body
        req.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        req.timeoutInterval = 60
        let data = try await send(req)
        return try decode(data, as: UploadResponse.self).publicUrl
    }

    // MARK: - Request/response payloads

    private struct IdTokenBody: Encodable { let idToken: String }
    private struct MagicLinkBody: Encodable { let email: String; let callbackURL: String }
    private struct VoteBody: Encodable { let value: String; let proof: GeoPoint? }
    private struct UploadResponse: Decodable { let publicUrl: String }
    private struct VerifyBody: Decodable {
        struct S: Decodable { let token: String?; let expiresAt: String? }
        let token: String?
        let session: S?
    }
}

/// A { lat, lng } point, the friendly object form the API accepts for POI
/// geometry and vote proof (server flips to GeoJSON [lng, lat]).
struct GeoPoint: Encodable {
    let lat: Double
    let lng: Double
}

/// Body for POST /api/v1/me/spots. We use the friendly `point` / `polygon`
/// forms ({lat,lng} objects); the server computes the centroid + GeoJSON.
struct SubmitSpotBody: Encodable {
    let type: String  // "POI" | "REGION"
    let categoryId: String
    let name: String
    let description: String?
    let point: GeoPoint?
    let polygon: [GeoPoint]?
    let amenityIds: [String]
    let photos: [String]
    let address: String?
    let website: String?
}

/// Blocks URLSession from following redirects, so the magic-link verify's 302
/// can't swallow the `set-auth-token` header.
private final class NoRedirect: NSObject, URLSessionTaskDelegate {
    func urlSession(
        _ session: URLSession, task: URLSessionTask,
        willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest
    ) async -> URLRequest? {
        nil
    }
}
