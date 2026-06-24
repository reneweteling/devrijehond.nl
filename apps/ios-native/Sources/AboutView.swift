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
                hero
                intro
                makerCard
                contactLinks
                legalLinks

                Text("Gebouwd met liefde voor honden en hun baasjes.")
                    .font(.dvhCaption).foregroundStyle(Brand.ink2.opacity(0.6))
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.top, DVH.s2)
            }
            .padding(.horizontal, DVH.s4)
            .padding(.vertical, DVH.s5)
        }
        .dvhScreenBackground()
        .navigationTitle("Over De Vrije Hond")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var hero: some View {
        HStack(spacing: DVH.s4) {
            Image("Logo").resizable().scaledToFit().frame(width: 64, height: 64)
            VStack(alignment: .leading, spacing: DVH.s1) {
                Text("De Vrije Hond").font(.dvhTitle).foregroundStyle(Brand.ink)
                Text("Versie \(appVersion)").font(.dvhCaption).foregroundStyle(Brand.ink2)
            }
            Spacer()
        }
        .dvhCard()
    }

    private var intro: some View {
        VStack(alignment: .leading, spacing: DVH.s3) {
            Text("Wat is De Vrije Hond?").font(.dvhHeadline).foregroundStyle(Brand.ink)
            Text(
                "Een community-kaart van hondvriendelijke plekken in Nederland: losloopgebieden, "
                + "hondenstranden, hondvriendelijke horeca, waterpunten en meer. Toegevoegd en "
                + "geverifieerd door hondenbazen zelf. Geen moderators, gewoon mensen die elkaar helpen."
            )
            .font(.dvhBody).foregroundStyle(Brand.ink2).lineSpacing(4)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .dvhCard()
    }

    // The "maker" section: a tasteful funnel to René's work.
    private var makerCard: some View {
        VStack(alignment: .leading, spacing: DVH.s3) {
            Text("Gemaakt door").font(.dvhHeadline).foregroundStyle(Brand.ink)
            HStack(spacing: DVH.s3) {
                Image("Logo").resizable().scaledToFit().frame(width: 46, height: 46)
                VStack(alignment: .leading, spacing: 2) {
                    Text("René Weteling").font(.dvhBody.weight(.semibold)).foregroundStyle(Brand.ink)
                    Text("Felobo B.V.").font(.dvhCaption).foregroundStyle(Brand.ink2)
                }
                Spacer()
            }
            Text(
                "Van idee tot productie: web, mobiel en AI. Deze app is van begin tot eind door mij "
                + "gebouwd. Zelf een app, platform of AI-oplossing nodig? Ik help je graag."
            )
            .font(.dvhCallout).foregroundStyle(Brand.ink2).lineSpacing(3)

            Link(destination: URL(string: "https://www.weteling.com")!) {
                HStack(spacing: DVH.s2) {
                    Image(systemName: "arrow.up.right.square.fill")
                    Text("Bekijk weteling.com")
                }
            }
            .buttonStyle(.dvhPrimary)

            Link(destination: URL(string: "mailto:rene@weteling.com")!) {
                Text("Of mail rene@weteling.com")
                    .font(.dvhCallout.weight(.semibold)).foregroundStyle(Brand.moss)
                    .frame(maxWidth: .infinity)
            }
        }
        .dvhCard()
    }

    private var contactLinks: some View {
        VStack(spacing: 0) {
            AboutLinkRow(icon: "globe", label: "Website", detail: "devrijehond.nl",
                         url: URL(string: "https://devrijehond.nl"))
            Divider().padding(.leading, DVH.s4 + 28)
            AboutLinkRow(icon: "chevron.left.forwardslash.chevron.right", label: "Open source, bouw mee",
                         detail: "github.com/reneweteling/devrijehond.nl",
                         url: URL(string: "https://github.com/reneweteling/devrijehond.nl"))
            Divider().padding(.leading, DVH.s4 + 28)
            AboutLinkRow(icon: "envelope", label: "Contact", detail: "info@devrijehond.nl",
                         url: URL(string: "mailto:info@devrijehond.nl"))
        }
        .dvhCard(padding: 0)
    }

    private var legalLinks: some View {
        VStack(spacing: 0) {
            AboutLinkRow(icon: "doc.text", label: "Gebruiksvoorwaarden", detail: nil,
                         url: URL(string: "https://devrijehond.nl/terms"))
            Divider().padding(.leading, DVH.s4 + 28)
            AboutLinkRow(icon: "hand.raised", label: "Privacybeleid", detail: nil,
                         url: URL(string: "https://devrijehond.nl/privacy"))
        }
        .dvhCard(padding: 0)
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
