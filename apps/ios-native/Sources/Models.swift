import Foundation
import CoreLocation

struct Rating: Decodable, Hashable {
    let average: Double
    let count: Int
}

/// GeoJSON geometry on the map DTO: a Point (POI) or a Polygon (REGION).
/// Coordinates are [lng, lat] per the GeoJSON spec.
enum SpotGeometry: Decodable {
    case point(CLLocationCoordinate2D)
    case polygon([[CLLocationCoordinate2D]])

    enum K: String, CodingKey { case type, coordinates }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: K.self)
        let type = try c.decode(String.self, forKey: .type)
        if type == "Polygon" {
            let rings = try c.decode([[[Double]]].self, forKey: .coordinates)
            self = .polygon(rings.map { ring in
                ring.compactMap { p in
                    p.count >= 2 ? CLLocationCoordinate2D(latitude: p[1], longitude: p[0]) : nil
                }
            })
        } else {
            let p = try c.decode([Double].self, forKey: .coordinates)
            self = .point(CLLocationCoordinate2D(latitude: p.count >= 2 ? p[1] : 0,
                                                 longitude: p.count >= 2 ? p[0] : 0))
        }
    }

    var outerRing: [CLLocationCoordinate2D]? {
        if case let .polygon(rings) = self { return rings.first }
        return nil
    }
}

struct SpotSummary: Decodable, Identifiable {
    let id: String
    let slug: String
    let type: String
    let name: String
    let categoryId: String
    let status: String
    let lat: Double?
    let lng: Double?
    let rating: Rating
    let photoUrl: String?
    let geometry: SpotGeometry?

    var coordinate: CLLocationCoordinate2D? {
        guard let lat, let lng else { return nil }
        return CLLocationCoordinate2D(latitude: lat, longitude: lng)
    }
    var isVerified: Bool { status == "VERIFIED" }
    var isRegion: Bool { type == "REGION" }
}

struct MapCluster: Decodable, Identifiable {
    let lat: Double
    let lng: Double
    let count: Int
    var id: String { "\(lat)-\(lng)-\(count)" }
    var coordinate: CLLocationCoordinate2D { .init(latitude: lat, longitude: lng) }
}

struct SpotsMapResponse: Decodable {
    let items: [SpotSummary]
    let clusters: [MapCluster]
}

struct SpotsListResponse: Decodable {
    let items: [SpotSummary]
    let nextCursor: String?
}

struct Category: Decodable, Identifiable, Hashable {
    let id: String
    let slug: String
    let label: String
    let type: String
    let icon: String?
    let color: String?
}

struct CategoriesResponse: Decodable {
    let items: [Category]
}

// MARK: - Profile

struct Dog: Decodable, Identifiable, Hashable {
    let id: String
    let name: String
    let breed: String?
    let birthYear: Int?
    let birthDate: String?
    let photoUrl: String?
    let note: String?
}

/// GET /api/v1/me. The wire shape is the bare profile object (no envelope).
struct MeProfile: Decodable {
    let id: String
    let email: String?
    let name: String?
    let handle: String?
    let bio: String?
    let image: String?
    let role: String?
    let reputation: Int?
    let dogs: [Dog]?

    var isAdmin: Bool { role == "ADMIN" }
    var isModerator: Bool { role == "MODERATOR" || role == "ADMIN" }
}

// MARK: - Spot detail

struct Amenity: Decodable, Identifiable, Hashable {
    let id: String
    let slug: String
    let label: String
    let icon: String?
}

struct SpotAuthor: Decodable, Hashable {
    let id: String
    let handle: String?
    let name: String?
    let image: String?
}

struct SpotDetail: Decodable {
    let id: String
    let slug: String
    let type: String
    let name: String
    let description: String?
    let category: Category
    let status: String
    let lat: Double?
    let lng: Double?
    let address: String?
    let phone: String?
    let website: String?
    let amenities: [Amenity]
    let photos: [PhotoURL]
    let rating: Rating
    let submittedBy: SpotAuthor?

    var isVerified: Bool { status == "VERIFIED" }
}

/// A photo as exposed on the detail DTO (just the URL is needed here).
struct PhotoURL: Decodable, Identifiable {
    let url: String
    var id: String { url }
}

struct AmenitiesResponse: Decodable {
    let items: [Amenity]
}

// MARK: - Auth + mutations

/// Response of the native sign-in bridge (apple-native / google-native) and the
/// magic-link verify: a signed BetterAuth bearer + ISO expiry.
struct AuthToken: Decodable {
    let token: String
    let expiresAt: String?
}

/// The spot returned by POST /api/v1/me/spots (a full SpotDetail; we only need a
/// few fields to confirm + navigate).
struct CreatedSpot: Decodable {
    let id: String
    let slug: String
    let name: String
    let status: String
}

/// Body for PATCH /api/v1/me/spots/:id (mirrors UpdateSpotRequestSchema).
/// All fields optional; nil optionals are omitted by the synthesized encoder,
/// so an omitted field leaves the existing value unchanged.
struct UpdateSpotBody: Encodable {
    var name: String?
    var description: String?
    var website: String?
    var phone: String?
    var categoryId: String?
    var amenityIds: [String]?
    var address: String?
    var photoUrls: [String]?
}

struct Vote: Decodable {
    let id: String
    let spotId: String
    let value: String
    let proximityVerified: Bool
    let createdAt: String
}

struct VoteResponse: Decodable {
    let vote: Vote
    let netScore: Double
    let confirmCount: Int
    let denyCount: Int
    let status: String
}

// MARK: - Feature requests (Wensen)

struct FeatureAuthor: Decodable, Hashable {
    let handle: String?
    let image: String?
}

struct FeatureRequest: Decodable, Identifiable {
    let id: String
    let title: String
    let body: String?
    let component: String?
    let status: String
    let upvoteCount: Int?
    let viewerHasVoted: Bool?
    let author: FeatureAuthor?
    let createdAt: String?
}

struct FeatureRequestsResponse: Decodable {
    let items: [FeatureRequest]
    let nextCursor: String?
}

struct FeatureVoteResponse: Decodable {
    let requestId: String
    let upvoteCount: Int
    let viewerHasVoted: Bool
}

// MARK: - Reviews

struct Review: Decodable, Identifiable {
    let id: String
    let spotId: String
    let stars: Int
    let body: String?
    let helpfulCount: Int
    let author: SpotAuthor?
    let createdAt: String
}

struct ReviewsResponse: Decodable {
    let items: [Review]
    let nextCursor: String?
}

// MARK: - Reports

enum ReportReason: String, CaseIterable, Identifiable {
    case duplicate = "DUPLICATE"
    case wrongInfo = "WRONG_INFO"
    case spam = "SPAM"
    case inappropriate = "INAPPROPRIATE"
    case other = "OTHER"

    var id: String { rawValue }
    var label: String {
        switch self {
        case .duplicate: return "Dubbele plek"
        case .wrongInfo: return "Verkeerde informatie"
        case .spam: return "Spam"
        case .inappropriate: return "Ongepast"
        case .other: return "Anders"
        }
    }
    var icon: String {
        switch self {
        case .duplicate: return "doc.on.doc"
        case .wrongInfo: return "exclamationmark.triangle"
        case .spam: return "envelope.badge"
        case .inappropriate: return "hand.raised"
        case .other: return "ellipsis.circle"
        }
    }
}

// MARK: - Moderator application

struct ModeratorApplication: Decodable {
    let id: String
    let status: String  // PENDING | APPROVED | REJECTED
    let motivation: String
    let createdAt: String
}

struct ModeratorApplicationResponse: Decodable {
    let application: ModeratorApplication?
}

// MARK: - Geocode

struct GeocodeHit: Decodable, Identifiable {
    let label: String
    let lat: Double
    let lng: Double
    var id: String { "\(label)-\(lat)-\(lng)" }
}

struct GeocodeResponse: Decodable {
    let items: [GeocodeHit]
}
