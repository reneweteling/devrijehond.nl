import SwiftUI

struct RequestNewView: View {
    @EnvironmentObject var session: Session
    @Environment(\.dismiss) private var dismiss

    var onCreated: ((FeatureRequest) -> Void)?

    @State private var title = ""
    @State private var body_ = ""
    @State private var selectedComponent: String? = nil
    @State private var submitting = false
    @State private var errorMessage: String? = nil

    private let maxTitle = 140
    private let maxBody  = 4000

    private let components: [(key: String, label: String)] = [
        ("Kaart",      "Kaart"),
        ("Inzenden",   "Inzenden"),
        ("Profiel",    "Profiel"),
        ("Anders",     "Anders"),
    ]

    private var titleValid: Bool { title.trimmingCharacters(in: .whitespaces).count >= 4 }
    private var canSubmit: Bool  { titleValid && !submitting }

    var body: some View {
        NavigationStack {
            ZStack {
                Brand.sand.ignoresSafeArea()

                ScrollView {
                    VStack(alignment: .leading, spacing: DVH.s5) {
                        titleSection
                        bodySection
                        componentSection

                        if let msg = errorMessage {
                            Text(msg)
                                .font(.dvhCaption)
                                .foregroundStyle(Brand.rust)
                                .padding(.top, -DVH.s2)
                        }

                        submitButton
                    }
                    .padding(.horizontal, DVH.s5)
                    .padding(.top, DVH.s4)
                    .padding(.bottom, DVH.s8)
                }
            }
            .navigationTitle("Idee indienen")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuleren") { dismiss() }
                        .font(.dvhCallout)
                        .foregroundStyle(Brand.ink2)
                }
            }
        }
    }

    // MARK: - Title section

    private var titleSection: some View {
        VStack(alignment: .leading, spacing: DVH.s2) {
            Text("Titel")
                .font(.dvhHeadline)
                .foregroundStyle(Brand.ink)

            TextField("Wat zou je graag willen?", text: $title)
                .textFieldStyle(.dvh)
                .onChange(of: title) { _, value in
                    if value.count > maxTitle { title = String(value.prefix(maxTitle)) }
                }

            HStack {
                if title.count > 0 && title.trimmingCharacters(in: .whitespaces).count < 4 {
                    Text("Minimaal 4 tekens")
                        .font(.dvhCaption)
                        .foregroundStyle(Brand.rust)
                }
                Spacer()
                Text("\(title.count)/\(maxTitle)")
                    .font(.dvhCaption)
                    .foregroundStyle(Brand.ink2.opacity(0.7))
            }
        }
    }

    // MARK: - Body section

    private var bodySection: some View {
        VStack(alignment: .leading, spacing: DVH.s2) {
            Text("Toelichting (optioneel)")
                .font(.dvhHeadline)
                .foregroundStyle(Brand.ink)

            ZStack(alignment: .topLeading) {
                TextEditor(text: $body_)
                    .font(.dvhBody)
                    .foregroundStyle(Brand.ink)
                    .frame(minHeight: 120, maxHeight: 240)
                    .padding(DVH.s3)
                    .background(Brand.cream, in: RoundedRectangle(cornerRadius: DVH.rMd))
                    .overlay(RoundedRectangle(cornerRadius: DVH.rMd).strokeBorder(Brand.ink.opacity(0.12)))
                    .onChange(of: body_) { _, value in
                        if value.count > maxBody { body_ = String(value.prefix(maxBody)) }
                    }

                if body_.isEmpty {
                    Text("Geef meer context, zodat anderen begrijpen wat je bedoelt.")
                        .font(.dvhBody)
                        .foregroundStyle(Brand.ink2.opacity(0.5))
                        .padding(.horizontal, DVH.s3 + 4)
                        .padding(.vertical, DVH.s3 + 8)
                        .allowsHitTesting(false)
                }
            }

            HStack {
                Spacer()
                Text("\(body_.count)/\(maxBody)")
                    .font(.dvhCaption)
                    .foregroundStyle(Brand.ink2.opacity(0.7))
            }
        }
    }

    // MARK: - Component picker

    private var componentSection: some View {
        VStack(alignment: .leading, spacing: DVH.s2) {
            Text("Onderdeel (optioneel)")
                .font(.dvhHeadline)
                .foregroundStyle(Brand.ink)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: DVH.s2) {
                    ForEach(components, id: \.key) { comp in
                        DVHChip(
                            label: comp.label,
                            selected: selectedComponent == comp.key
                        ) {
                            selectedComponent = selectedComponent == comp.key ? nil : comp.key
                        }
                    }
                }
            }
        }
    }

    // MARK: - Submit

    private var submitButton: some View {
        Button {
            Task { await submit() }
        } label: {
            HStack(spacing: DVH.s2) {
                if submitting { ProgressView().tint(.white) }
                Text(submitting ? "Indienen..." : "Indienen")
            }
        }
        .buttonStyle(.dvhPrimary)
        .disabled(!canSubmit)
        .opacity(canSubmit ? 1 : 0.5)
        .padding(.top, DVH.s2)
    }

    // MARK: - Action

    private func submit() async {
        guard let token = session.token else { return }
        errorMessage = nil
        submitting = true
        do {
            let trimmedTitle = title.trimmingCharacters(in: .whitespaces)
            let trimmedBody  = body_.trimmingCharacters(in: .whitespaces)
            let result = try await APIClient.createFeatureRequest(
                title: trimmedTitle,
                body: trimmedBody.isEmpty ? nil : trimmedBody,
                component: selectedComponent,
                token: token
            )
            onCreated?(result)
            dismiss()
        } catch {
            session.signOutIfUnauthorized(error)
            errorMessage = "Kon je wens niet indienen. Probeer het opnieuw."
        }
        submitting = false
    }
}
