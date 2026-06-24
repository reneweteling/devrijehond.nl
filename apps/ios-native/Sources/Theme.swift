import SwiftUI

/// De Vrije Hond brand palette (mirrors apps/web globals.css + the RN theme).
enum Brand {
    static let moss = Color(hex: 0x6E7B33)
    static let mossDark = Color(hex: 0x4C5622)
    static let mossSoft = Color(hex: 0xE7E9D5)
    static let cream = Color(hex: 0xFFFDF7)
    static let sand = Color(hex: 0xF3EFE3)
    static let terra = Color(hex: 0xC2762E)
    static let rust = Color(hex: 0xA33B2D)
    static let ink = Color(hex: 0x2B3320)
    static let ink2 = Color(hex: 0x5A6151)

    /// Category slug → marker tint, matching the web/mobile category colours.
    static func categoryColor(_ slug: String) -> Color {
        switch slug {
        case "off-leash": return moss
        case "swim-beach": return Color(hex: 0xC9A24B)
        case "horeca": return terra
        case "wash": return Color(hex: 0x4F7A86)
        case "shop": return Color(hex: 0x8A6BA0)
        case "drinking-point": return Color(hex: 0x6E7A82)
        case "vet": return Color(hex: 0xB5524A)
        default: return moss
        }
    }
}

extension Color {
    init(hex: UInt32) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: 1
        )
    }
}

extension UIColor {
    convenience init(hex: UInt32) {
        self.init(
            red: CGFloat((hex >> 16) & 0xFF) / 255,
            green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255,
            alpha: 1
        )
    }
}
