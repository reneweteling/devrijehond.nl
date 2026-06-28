import SwiftUI
import UIKit

// De Vrije Hond design system for the native app. Warm, earthy, friendly:
// rounded type, soft surfaces on a sand/cream ground, moss + terracotta accents.
// Every screen should compose these instead of hand-rolling styles.

enum DVH {
    // Spacing scale
    static let s1: CGFloat = 4
    static let s2: CGFloat = 8
    static let s3: CGFloat = 12
    static let s4: CGFloat = 16
    static let s5: CGFloat = 20
    static let s6: CGFloat = 24
    static let s8: CGFloat = 32

    // Radii
    static let rSm: CGFloat = 10
    static let rMd: CGFloat = 14
    static let rLg: CGFloat = 20
    static let rXl: CGFloat = 28

    static let controlHeight: CGFloat = 52
}

// MARK: - Typography (rounded = friendly brand voice)

extension Font {
    static func dvhDisplay(_ size: CGFloat = 30) -> Font { .system(size: size, weight: .bold, design: .rounded) }
    static var dvhTitle: Font { .system(.title2, design: .rounded).weight(.bold) }
    static var dvhHeadline: Font { .system(.headline, design: .rounded) }
    static var dvhBody: Font { .system(.body, design: .rounded) }
    static var dvhCallout: Font { .system(.callout, design: .rounded) }
    static var dvhCaption: Font { .system(.caption, design: .rounded) }
}

// MARK: - Buttons

struct PrimaryButtonStyle: ButtonStyle {
    var tint: Color = Brand.moss
    var loading: Bool = false
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.dvhHeadline)
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .frame(height: DVH.controlHeight)
            .background(tint.opacity(configuration.isPressed ? 0.85 : 1), in: RoundedRectangle(cornerRadius: DVH.rMd))
            .opacity(loading ? 0.7 : 1)
            .shadow(color: tint.opacity(0.25), radius: 10, y: 4)
    }
}

struct SecondaryButtonStyle: ButtonStyle {
    var tint: Color = Brand.ink
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.dvhHeadline)
            .foregroundStyle(tint)
            .frame(maxWidth: .infinity)
            .frame(height: DVH.controlHeight)
            .background(Brand.cream, in: RoundedRectangle(cornerRadius: DVH.rMd))
            .overlay(RoundedRectangle(cornerRadius: DVH.rMd).strokeBorder(Brand.ink.opacity(0.14)))
            .opacity(configuration.isPressed ? 0.7 : 1)
    }
}

extension ButtonStyle where Self == PrimaryButtonStyle {
    static var dvhPrimary: PrimaryButtonStyle { PrimaryButtonStyle() }
    static func dvhPrimary(tint: Color) -> PrimaryButtonStyle { PrimaryButtonStyle(tint: tint) }
}
extension ButtonStyle where Self == SecondaryButtonStyle {
    static var dvhSecondary: SecondaryButtonStyle { SecondaryButtonStyle() }
}

// MARK: - Surfaces

struct CardModifier: ViewModifier {
    var padding: CGFloat = DVH.s4
    func body(content: Content) -> some View {
        content
            .padding(padding)
            .background {
                ZStack {
                    RoundedRectangle(cornerRadius: DVH.rLg).fill(.ultraThinMaterial)
                    RoundedRectangle(cornerRadius: DVH.rLg).fill(Brand.cream.opacity(0.5))
                }
            }
            .overlay(RoundedRectangle(cornerRadius: DVH.rLg).strokeBorder(.white.opacity(0.45)))
            .shadow(color: Brand.ink.opacity(0.06), radius: 14, y: 5)
    }
}
extension View {
    func dvhCard(padding: CGFloat = DVH.s4) -> some View { modifier(CardModifier(padding: padding)) }
}

// MARK: - Screen background (subtle brand watermark, for non-map screens)

struct ScreenBackground: ViewModifier {
    func body(content: Content) -> some View {
        content.background(
            ZStack(alignment: .topTrailing) {
                Brand.sand
                Image("Logo")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 360)
                    .opacity(0.05)
                    .offset(x: 80, y: 24)
                    .accessibilityHidden(true)
            }
            .ignoresSafeArea()
        )
    }
}
extension View {
    /// Sand ground + a faint dog-logo watermark. Use on screens without a map.
    func dvhScreenBackground() -> some View { modifier(ScreenBackground()) }
}

// MARK: - Text field

struct DVHFieldStyle: TextFieldStyle {
    func _body(configuration: TextField<Self._Label>) -> some View {
        configuration
            .font(.dvhBody)
            .padding(.horizontal, DVH.s4)
            .frame(height: DVH.controlHeight)
            .background(Brand.cream, in: RoundedRectangle(cornerRadius: DVH.rMd))
            .overlay(RoundedRectangle(cornerRadius: DVH.rMd).strokeBorder(Brand.ink.opacity(0.12)))
    }
}
extension TextFieldStyle where Self == DVHFieldStyle {
    static var dvh: DVHFieldStyle { DVHFieldStyle() }
}

// MARK: - Chip

struct DVHChip: View {
    let label: String
    var icon: String?
    var selected: Bool
    var tint: Color = Brand.moss
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                if let icon { Image(systemName: icon).font(.caption2.weight(.semibold)) }
                Text(label).font(.dvhCaption.weight(.semibold))
            }
            .padding(.horizontal, DVH.s3)
            .padding(.vertical, DVH.s2 + 1)
            // Unselected uses the system bar material so it matches the tab bar
            // exactly (legible over both the map and the sand background).
            // Selected fills with the tint.
            .background {
                Capsule().fill(selected ? AnyShapeStyle(tint) : AnyShapeStyle(.bar))
            }
            .foregroundStyle(selected ? .white : Brand.mossDark)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Badge

struct VerifiedBadge: View {
    let verified: Bool
    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: verified ? "checkmark.seal.fill" : "questionmark.circle")
            Text(verified ? "Geverifieerd" : "Niet geverifieerd")
        }
        .font(.dvhCaption.weight(.semibold))
        .foregroundStyle(verified ? Brand.mossDark : Brand.terra)
        .padding(.horizontal, DVH.s2 + 2).padding(.vertical, DVH.s1 + 1)
        .background((verified ? Brand.mossSoft : Brand.terra.opacity(0.14)), in: Capsule())
    }
}

// MARK: - Cached remote image

/// Small in-memory image cache shared across the app. Decoded once per URL and
/// kept alive, so an avatar/dog photo survives the frequent re-renders of a
/// ScrollView.
final class ImageCache {
    static let shared = ImageCache()
    private let cache = NSCache<NSURL, UIImage>()
    func image(for url: URL) -> UIImage? { cache.object(forKey: url as NSURL) }
    func insert(_ image: UIImage, for url: URL) { cache.setObject(image, forKey: url as NSURL) }
}

/// A robust replacement for `AsyncImage` inside scrolling content.
///
/// `AsyncImage(...).id(url)` re-creates the loader whenever the surrounding view
/// is re-evaluated, which on the Profile screen happens repeatedly (the
/// moderator-application `.task` flips state right while the avatar is still
/// downloading). The in-flight request gets cancelled and the view sticks on the
/// placeholder. `CachedImage` instead keeps a stable identity (no `.id`), holds
/// the decoded image in `@State`, and serves from a shared cache, so it loads
/// once and keeps showing across re-renders. `.task(id:)` only restarts when the
/// URL itself changes (e.g. nil -> url after an upload).
struct CachedImage<Content: View, Placeholder: View>: View {
    let url: URL?
    @ViewBuilder var content: (Image) -> Content
    @ViewBuilder var placeholder: () -> Placeholder

    @State private var uiImage: UIImage?

    var body: some View {
        Group {
            if let uiImage {
                content(Image(uiImage: uiImage))
            } else {
                placeholder()
            }
        }
        .task(id: url) { await load() }
    }

    private func load() async {
        guard let url else { uiImage = nil; return }
        if let cached = ImageCache.shared.image(for: url) {
            uiImage = cached
            return
        }
        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            guard !Task.isCancelled, let img = UIImage(data: data) else { return }
            ImageCache.shared.insert(img, for: url)
            uiImage = img
        } catch {
            // Keep the placeholder; a later re-render / pull-to-refresh retries.
        }
    }
}

// MARK: - Avatar

struct Avatar: View {
    let url: String?
    let name: String?
    var size: CGFloat = 52

    private var initials: String {
        let parts = (name ?? "").split(separator: " ").prefix(2)
        let s = parts.compactMap { $0.first }.map(String.init).joined()
        return s.isEmpty ? "🐾" : s.uppercased()
    }

    var body: some View {
        Group {
            if let url, let u = URL(string: url) {
                CachedImage(url: u) { img in
                    img.resizable().scaledToFill()
                } placeholder: {
                    placeholder
                }
            } else {
                placeholder
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
        .overlay(Circle().strokeBorder(Brand.ink.opacity(0.08)))
    }

    private var placeholder: some View {
        ZStack {
            LinearGradient(colors: [Brand.moss, Brand.mossDark], startPoint: .topLeading, endPoint: .bottomTrailing)
            Text(initials).font(.system(size: size * 0.36, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
        }
    }
}

// MARK: - Section header

struct SectionHeader: View {
    let title: String
    var action: (() -> Void)?
    var actionLabel: String?
    var body: some View {
        HStack {
            Text(title).font(.dvhHeadline).foregroundStyle(Brand.ink)
            Spacer()
            if let action, let actionLabel {
                Button(actionLabel, action: action)
                    .font(.dvhCaption.weight(.semibold)).foregroundStyle(Brand.moss)
            }
        }
    }
}

// MARK: - Empty state

struct EmptyStateView: View {
    let icon: String
    let title: String
    let message: String
    var actionLabel: String?
    var action: (() -> Void)?

    var body: some View {
        VStack(spacing: DVH.s3) {
            ZStack {
                Circle().fill(Brand.mossSoft).frame(width: 84, height: 84)
                Image(systemName: icon).font(.system(size: 36, weight: .medium))
                    .foregroundStyle(Brand.moss)
            }
            Text(title).font(.dvhTitle).foregroundStyle(Brand.ink)
            Text(message).font(.dvhCallout).foregroundStyle(Brand.ink2)
                .multilineTextAlignment(.center).padding(.horizontal, DVH.s8)
            if let actionLabel, let action {
                Button(actionLabel, action: action)
                    .buttonStyle(.dvhPrimary).frame(maxWidth: 240).padding(.top, DVH.s2)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(DVH.s5)
    }
}

// MARK: - Star rating (display + interactive)

struct StarRating: View {
    let value: Double
    var size: CGFloat = 14
    var body: some View {
        HStack(spacing: 2) {
            ForEach(0..<5) { i in
                Image(systemName: Double(i) < value.rounded() ? "star.fill" : "star")
                    .font(.system(size: size))
                    .foregroundStyle(Brand.terra)
            }
        }
    }
}

struct StarPicker: View {
    @Binding var rating: Int
    var body: some View {
        HStack(spacing: DVH.s2) {
            ForEach(1...5, id: \.self) { i in
                Image(systemName: i <= rating ? "star.fill" : "star")
                    .font(.system(size: 34))
                    .foregroundStyle(i <= rating ? Brand.terra : Brand.ink.opacity(0.25))
                    .onTapGesture { rating = i }
            }
        }
    }
}
