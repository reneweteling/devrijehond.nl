import SwiftUI

struct AboutView: View {
    private var appVersion: String {
        let short = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "?"
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "?"
        return "\(short) (\(build))"
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: DVH.s5) {
                // Hero
                HStack(spacing: DVH.s4) {
                    ZStack {
                        Circle()
                            .fill(LinearGradient(
                                colors: [Brand.moss, Brand.mossDark],
                                startPoint: .topLeading, endPoint: .bottomTrailing))
                            .frame(width: 64, height: 64)
                        Image(systemName: "pawprint.fill")
                            .font(.system(size: 28, weight: .bold))
                            .foregroundStyle(.white)
                    }
                    VStack(alignment: .leading, spacing: DVH.s1) {
                        Text("De Vrije Hond")
                            .font(.dvhTitle).foregroundStyle(Brand.ink)
                        Text("Versie \(appVersion)")
                            .font(.dvhCaption).foregroundStyle(Brand.ink2)
                    }
                    Spacer()
                }
                .dvhCard()

                // Intro
                VStack(alignment: .leading, spacing: DVH.s3) {
                    Text("Wat is De Vrije Hond?")
                        .font(.dvhHeadline).foregroundStyle(Brand.ink)
                    Text(
                        "De Vrije Hond is een community-kaart van hondvriendelijke plekken in Nederland. " +
                        "Iedereen kan een plek toevoegen. De community bevestigt of verwerpt inzendingen via stemmen, " +
                        "zodat de kaart accuraat en actueel blijft. Geen moderators, gewoon hondeneigenaren die elkaar helpen."
                    )
                    .font(.dvhBody).foregroundStyle(Brand.ink2)
                    .lineSpacing(4)
                }
                .dvhCard()

                // Links
                VStack(spacing: 0) {
                    AboutLinkRow(
                        icon: "globe",
                        label: "Website",
                        detail: "devrijehond.nl",
                        url: URL(string: "https://devrijehond.nl")
                    )
                    Divider().padding(.leading, DVH.s4 + 28)
                    AboutLinkRow(
                        icon: "envelope",
                        label: "Contact",
                        detail: "hallo@devrijehond.nl",
                        url: URL(string: "mailto:hallo@devrijehond.nl")
                    )
                }
                .dvhCard(padding: 0)

                // Legal
                VStack(alignment: .leading, spacing: DVH.s3) {
                    AboutLinkRow(
                        icon: "doc.text",
                        label: "Gebruiksvoorwaarden",
                        detail: nil,
                        url: URL(string: "https://devrijehond.nl/voorwaarden")
                    )
                    Divider().padding(.leading, DVH.s4 + 28)
                    AboutLinkRow(
                        icon: "hand.raised",
                        label: "Privacybeleid",
                        detail: nil,
                        url: URL(string: "https://devrijehond.nl/privacy")
                    )
                }
                .dvhCard(padding: 0)

                Text("Gebouwd met liefde voor honden en hun baasjes.")
                    .font(.dvhCaption).foregroundStyle(Brand.ink2.opacity(0.6))
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.top, DVH.s2)
            }
            .padding(.horizontal, DVH.s4)
            .padding(.vertical, DVH.s5)
        }
        .background(Brand.sand.ignoresSafeArea())
        .navigationTitle("Over De Vrije Hond")
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - Helper row

private struct AboutLinkRow: View {
    let icon: String
    let label: String
    let detail: String?
    let url: URL?

    var body: some View {
        if let url {
            Link(destination: url) { paddedRow }
        } else {
            paddedRow
        }
    }

    private var paddedRow: some View {
        rowContent
            .padding(.horizontal, DVH.s4)
            .padding(.vertical, DVH.s3 + 2)
            .contentShape(Rectangle())
    }

    private var rowContent: some View {
        HStack(spacing: DVH.s3) {
            Image(systemName: icon)
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(Brand.moss)
                .frame(width: 20)
            VStack(alignment: .leading, spacing: 2) {
                Text(label).font(.dvhBody).foregroundStyle(Brand.ink)
                if let detail {
                    Text(detail).font(.dvhCaption).foregroundStyle(Brand.ink2)
                }
            }
            Spacer()
            Image(systemName: "arrow.up.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Brand.ink2.opacity(0.5))
        }
    }
}
