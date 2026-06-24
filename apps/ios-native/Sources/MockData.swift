#if DEBUG
import Foundation

// Sample data for driving the authenticated screens in the simulator via the
// `-mockAuth` launch argument. DEBUG-only; never compiled into release.
extension MeProfile {
    static var mock: MeProfile {
        let json = """
        {
          "id": "11111111-1111-1111-1111-111111111111",
          "email": "rene@weteling.com",
          "name": "René Weteling",
          "handle": "rene",
          "bio": "Op pad met Bo door heel Nederland. Altijd op zoek naar het volgende losloopbos.",
          "image": null,
          "role": "MODERATOR",
          "reputation": 142,
          "dogs": [
            {"id":"d1","name":"Bo","breed":"Border Collie","birthYear":2021,"birthDate":"2021-06-15","photoUrl":null,"note":"Dol op water","createdAt":"2026-01-01T12:00:00Z","updatedAt":"2026-01-01T12:00:00Z"},
            {"id":"d2","name":"Storm","breed":"Labrador","birthYear":2019,"birthDate":"2019-03-02","photoUrl":null,"note":null,"createdAt":"2026-01-01T12:00:00Z","updatedAt":"2026-01-01T12:00:00Z"}
          ],
          "createdAt": "2025-09-01T12:00:00Z"
        }
        """
        return try! JSONDecoder().decode(MeProfile.self, from: Data(json.utf8))
    }
}
#endif
