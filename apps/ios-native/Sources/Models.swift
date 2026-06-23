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

// MARK: - Profile (filled in when the profile screen is built)

struct Dog: Decodable, Identifiable, Hashable {
    let id: String
    let name: String
    let breed: String?
    let photoUrl: String?
}

struct MeProfile: Decodable {
    let id: String
    let name: String?
    let handle: String?
    let image: String?
    let reputation: Int?
    let dogs: [Dog]?
}

// MARK: - Spot detail

struct Amenity: Decodable, Identifiable, Hashable {
    let id: String
    let slug: String
    let label: String
    let icon: String?
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
    let website: String?
    let amenities: [Amenity]
    let photos: [PhotoURL]
    let rating: Rating
}

/// A photo as exposed on the detail DTO (just the URL is needed here).
struct PhotoURL: Decodable, Identifiable {
    let url: String
    var id: String { url }
}

// MARK: - Feature requests (Wensen)

struct FeatureRequest: Decodable, Identifiable {
    let id: String
    let title: String
    let body: String?
    let component: String?
    let status: String
    let voteCount: Int?
}

struct FeatureRequestsResponse: Decodable {
    let items: [FeatureRequest]
}
