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
    /// DEBUG builds talk to the local web server by default (the simulator shares
    /// the Mac network, and http://localhost is exempt from ATS). Override with the
    /// `-apiBase <url>` launch argument. Release always uses production.
    static let base: URL = {
        #if DEBUG
        if let override = UserDefaults.standard.string(forKey: "apiBase"),
           let u = URL(string: override) { return u }
        return URL(string: "http://localhost:3030")!
        #else
        return URL(string: "https://api.devrijehond.nl")!
        #endif
    }()
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
        // The app authenticates with a bearer token (Keychain), never cookies.
        // URLSession.shared otherwise stores + replays any Set-Cookie BetterAuth
        // returns (e.g. a session cookie from an Apple/Google login); a later
        // request carrying that cookie but no Origin header trips BetterAuth's
        // CSRF guard with 403 MISSING_OR_NULL_ORIGIN (notably on magic-link
        // sign-in). Disabling cookie handling keeps every request bearer-only.
        req.httpShouldHandleCookies = false
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
        minLng: Double, minLat: Double, maxLng: Double, maxLat: Double,
        cluster: Bool, categoryId: String? = nil
    ) async throws -> SpotsMapResponse {
        var q: [URLQueryItem] = [
            .init(name: "minLng", value: String(minLng)),
            .init(name: "minLat", value: String(minLat)),
            .init(name: "maxLng", value: String(maxLng)),
            .init(name: "maxLat", value: String(maxLat)),
        ]
        if cluster { q.append(.init(name: "cluster", value: "true")) }
        if let categoryId { q.append(.init(name: "categoryId", value: categoryId)) }
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

    static func featureRequests(status: String? = nil) async throws -> [FeatureRequest] {
        var q: [URLQueryItem] = []
        if let status { q.append(.init(name: "status", value: status)) }
        return try await get("/api/v1/feature-requests", query: q, as: FeatureRequestsResponse.self).items
    }

    static func spotReviews(slug: String) async throws -> [Review] {
        try await get("/api/v1/spots/\(slug)/reviews", as: ReviewsResponse.self).items
    }

    static func geocode(_ query: String) async throws -> [GeocodeHit] {
        try await get("/api/v1/geocode", query: [.init(name: "q", value: query)],
                      as: GeocodeResponse.self).items
    }

    // MARK: - PATCH helper

    static func patch<T: Decodable, B: Encodable>(
        _ path: String, body: B, token: String, as type: T.Type
    ) async throws -> T {
        let payload = try JSONEncoder().encode(body)
        let data = try await send(makeRequest("PATCH", path: path, token: token, jsonBody: payload))
        return try decode(data, as: T.self)
    }

    @discardableResult
    static func delete(_ path: String, token: String) async throws -> Bool {
        _ = try await send(makeRequest("DELETE", path: path, token: token))
        return true
    }

    // MARK: - Authenticated endpoints (/me/*)

    static func me(token: String) async throws -> MeProfile {
        try await get("/api/v1/me", token: token, as: MeProfile.self)
    }

    static func updateProfile(_ patch: MeProfilePatchBody, token: String) async throws -> MeProfile {
        try await self.patch("/api/v1/me", body: patch, token: token, as: MeProfile.self)
    }

    static func mySpots(token: String) async throws -> [SpotSummary] {
        try await get("/api/v1/me/spots", token: token, as: SpotsListResponse.self).items
    }

    // Dogs
    static func createDog(_ body: DogBody, token: String) async throws -> Dog {
        try await post("/api/v1/me/dogs", body: body, token: token, as: Dog.self)
    }
    static func updateDog(id: String, body: DogBody, token: String) async throws -> Dog {
        try await patch("/api/v1/me/dogs/\(id)", body: body, token: token, as: Dog.self)
    }
    static func deleteDog(id: String, token: String) async throws {
        try await delete("/api/v1/me/dogs/\(id)", token: token)
    }

    // Reviews
    static func submitReview(spotId: String, stars: Int, body: String?, token: String) async throws -> Review {
        try await post("/api/v1/me/spots/\(spotId)/reviews",
                       body: SubmitReviewBody(stars: stars, body: body), token: token, as: Review.self)
    }

    // Reports
    static func reportSpot(spotId: String, reason: String, note: String?, token: String) async throws {
        try await postNoContent("/api/v1/me/reports",
                                body: SubmitReportBody(targetType: "SPOT", targetId: spotId,
                                                       reason: reason, note: note), token: token)
    }

    // Moderation (staff)
    static func moderateSpot(spotId: String, status: String, token: String) async throws {
        try await postNoContentPatch("/api/v1/me/spots/\(spotId)/moderate",
                                     body: ModerateBody(status: status), token: token)
    }

    // Moderator application
    static func moderatorApplication(token: String) async throws -> ModeratorApplication? {
        try await get("/api/v1/me/moderator-application", token: token,
                      as: ModeratorApplicationResponse.self).application
    }
    static func applyModerator(motivation: String, token: String) async throws -> ModeratorApplication {
        try await post("/api/v1/me/moderator-application",
                       body: MotivationBody(motivation: motivation), token: token,
                       as: ModeratorApplication.self)
    }

    // Feature requests
    static func createFeatureRequest(
        title: String, body: String?, component: String?, token: String
    ) async throws -> FeatureRequest {
        try await post("/api/v1/me/feature-requests",
                       body: CreateFeatureRequestBody(title: title, body: body, component: component),
                       token: token, as: FeatureRequest.self)
    }
    static func toggleFeatureVote(id: String, token: String) async throws -> FeatureVoteResponse {
        try await post("/api/v1/me/feature-requests/\(id)/vote",
                       body: EmptyBody(), token: token, as: FeatureVoteResponse.self)
    }

    @discardableResult
    private static func postNoContentPatch<B: Encodable>(
        _ path: String, body: B, token: String
    ) async throws -> Bool {
        let payload = try JSONEncoder().encode(body)
        _ = try await send(makeRequest("PATCH", path: path, token: token, jsonBody: payload))
        return true
    }

    static func submitSpot(_ body: SubmitSpotBody, token: String) async throws -> CreatedSpot {
        try await post("/api/v1/me/spots", body: body, token: token, as: CreatedSpot.self)
    }

    /// PATCH /api/v1/me/spots/:id. The owner may edit while UNVERIFIED; staff
    /// (ADMIN/MODERATOR) may edit any spot. Returns the updated spot detail.
    static func updateSpot(id: String, body: UpdateSpotBody, token: String) async throws -> SpotDetail {
        try await patch("/api/v1/me/spots/\(id)", body: body, token: token, as: SpotDetail.self)
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
    private struct SubmitReviewBody: Encodable { let stars: Int; let body: String? }
    private struct SubmitReportBody: Encodable {
        let targetType: String; let targetId: String; let reason: String; let note: String?
    }
    private struct ModerateBody: Encodable { let status: String }
    private struct MotivationBody: Encodable { let motivation: String }
    private struct CreateFeatureRequestBody: Encodable {
        let title: String; let body: String?; let component: String?
    }
    private struct EmptyBody: Encodable {}
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

/// PATCH /api/v1/me. Nil fields are omitted by the encoder (leave unchanged).
struct MeProfilePatchBody: Encodable {
    var name: String?
    var handle: String?
    var bio: String?
    var image: String?
}

/// Body for POST/PATCH /api/v1/me/dogs. Nil optionals are omitted.
struct DogBody: Encodable {
    let name: String
    var breed: String?
    var birthDate: String?  // YYYY-MM-DD
    var birthYear: Int?
    var photoUrl: String?
    var note: String?
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
