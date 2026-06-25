import SwiftUI

// MARK: - Sheet router

/// All sheets that SpotDetailView can present, expressed as a single
/// discriminated enum so we can use the safe `.sheet(item:)` overload.
enum SpotDetailSheet: Identifiable {
    case signIn(reason: String)
    case writeReview
    case report

    var id: String {
        switch self {
        case .signIn: return "signIn"
        case .writeReview: return "writeReview"
        case .report: return "report"
        }
    }
}

// MARK: - ReviewRow

struct ReviewRow: View {
    let review: Review

    private var displayName: String {
        review.author?.name ?? review.author?.handle ?? "Anoniem"
    }

    private var formattedDate: String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: review.createdAt) {
            return date.formatted(date: .abbreviated, time: .omitted)
        }
        // fallback without fractional seconds
        let f2 = ISO8601DateFormatter()
        if let date = f2.date(from: review.createdAt) {
            return date.formatted(date: .abbreviated, time: .omitted)
        }
        return review.createdAt
    }

    var body: some View {
        VStack(alignment: .leading, spacing: DVH.s2) {
            HStack(spacing: DVH.s2) {
                Avatar(url: review.author?.image, name: displayName, size: 36)
                VStack(alignment: .leading, spacing: 2) {
                    Text(displayName)
                        .font(.dvhCallout.weight(.semibold))
                        .foregroundStyle(Brand.ink)
                    Text(formattedDate)
                        .font(.dvhCaption)
                        .foregroundStyle(Brand.ink2)
                }
                Spacer()
                StarRating(value: Double(review.stars), size: 12)
            }
            if let body = review.body, !body.isEmpty {
                Text(body)
                    .font(.dvhBody)
                    .foregroundStyle(Brand.ink2)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if review.helpfulCount > 0 {
                Text("\(review.helpfulCount)× nuttig")
                    .font(.dvhCaption)
                    .foregroundStyle(Brand.moss)
            }
        }
        .padding(.vertical, DVH.s2)
    }
}

// MARK: - WriteReviewView

struct WriteReviewView: View {
    let spotId: String
    let onSuccess: () -> Void

    @EnvironmentObject var session: Session
    @Environment(\.dismiss) private var dismiss

    @State private var rating = 0
    @State private var comment = ""
    @State private var submitting = false
    @State private var error: String?

    private var canSubmit: Bool { rating > 0 && !submitting }

    var body: some View {
        NavigationStack {
            ZStack {
                Brand.sand.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: DVH.s5) {
                        VStack(alignment: .leading, spacing: DVH.s3) {
                            Text("Jouw beoordeling")
                                .font(.dvhHeadline)
                                .foregroundStyle(Brand.ink)
                            StarPicker(rating: $rating)
                        }
                        .dvhCard()

                        VStack(alignment: .leading, spacing: DVH.s3) {
                            Text("Reactie (optioneel)")
                                .font(.dvhHeadline)
                                .foregroundStyle(Brand.ink)
                            TextEditor(text: $comment)
                                .font(.dvhBody)
                                .foregroundStyle(Brand.ink)
                                .frame(minHeight: 120, maxHeight: 240)
                                .padding(DVH.s3)
                                .background(Brand.cream, in: RoundedRectangle(cornerRadius: DVH.rMd))
                                .overlay(RoundedRectangle(cornerRadius: DVH.rMd)
                                    .strokeBorder(Brand.ink.opacity(0.12)))
                                .onChange(of: comment) { _, v in
                                    if v.count > 4000 { comment = String(v.prefix(4000)) }
                                }
                            Text("\(comment.count)/4000")
                                .font(.dvhCaption)
                                .foregroundStyle(Brand.ink2)
                                .frame(maxWidth: .infinity, alignment: .trailing)
                        }
                        .dvhCard()

                        if let error {
                            Text(error)
                                .font(.dvhCaption)
                                .foregroundStyle(Brand.terra)
                                .padding(.horizontal, DVH.s1)
                        }

                        Button {
                            submitReview()
                        } label: {
                            HStack(spacing: DVH.s2) {
                                if submitting { ProgressView().tint(.white) }
                                Text("Verstuur recensie")
                            }
                        }
                        .buttonStyle(.dvhPrimary)
                        .disabled(!canSubmit)
                        .opacity(canSubmit ? 1 : 0.55)
                    }
                    .padding(.horizontal, DVH.s5)
                    .padding(.vertical, DVH.s5)
                }
            }
            .navigationTitle("Schrijf recensie")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuleer") { dismiss() }
                        .foregroundStyle(Brand.ink2)
                }
            }
        }
    }

    private func submitReview() {
        guard let token = session.token else { return }
        submitting = true
        error = nil
        let bodyText = comment.trimmingCharacters(in: .whitespacesAndNewlines)
        Task {
            do {
                _ = try await APIClient.submitReview(
                    spotId: spotId,
                    stars: rating,
                    body: bodyText.isEmpty ? nil : bodyText,
                    token: token
                )
                onSuccess()
                dismiss()
            } catch let e as APIError {
                _ = session.signOutIfUnauthorized(e)
                error = e.errorDescription ?? "Versturen mislukt."
            } catch {
                self.error = "Versturen mislukt. Probeer het opnieuw."
            }
            submitting = false
        }
    }
}

// MARK: - ReportSheet

struct ReportSheet: View {
    let spotId: String

    @EnvironmentObject var session: Session
    @Environment(\.dismiss) private var dismiss

    @State private var selected: ReportReason?
    @State private var note = ""
    @State private var submitting = false
    @State private var submitted = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            ZStack {
                Brand.sand.ignoresSafeArea()
                if submitted {
                    successView
                } else {
                    ScrollView {
                        VStack(alignment: .leading, spacing: DVH.s4) {
                            Text("Wat klopt er niet?")
                                .font(.dvhHeadline)
                                .foregroundStyle(Brand.ink)
                                .padding(.horizontal, DVH.s1)

                            VStack(spacing: 0) {
                                ForEach(ReportReason.allCases) { reason in
                                    Button {
                                        selected = (selected == reason) ? nil : reason
                                    } label: {
                                        HStack(spacing: DVH.s3) {
                                            Image(systemName: reason.icon)
                                                .font(.body)
                                                .foregroundStyle(Brand.moss)
                                                .frame(width: 24)
                                            Text(reason.label)
                                                .font(.dvhBody)
                                                .foregroundStyle(Brand.ink)
                                            Spacer()
                                            if selected == reason {
                                                Image(systemName: "checkmark")
                                                    .font(.body.weight(.semibold))
                                                    .foregroundStyle(Brand.moss)
                                            }
                                        }
                                        .padding(.horizontal, DVH.s4)
                                        .padding(.vertical, DVH.s3)
                                        .contentShape(Rectangle())
                                    }
                                    .buttonStyle(.plain)
                                    if reason != ReportReason.allCases.last {
                                        Divider().padding(.leading, DVH.s4 + 24 + DVH.s3)
                                    }
                                }
                            }
                            .dvhCard(padding: 0)

                            VStack(alignment: .leading, spacing: DVH.s2) {
                                Text("Toelichting (optioneel)")
                                    .font(.dvhHeadline)
                                    .foregroundStyle(Brand.ink)
                                TextEditor(text: $note)
                                    .font(.dvhBody)
                                    .foregroundStyle(Brand.ink)
                                    .frame(minHeight: 80, maxHeight: 160)
                                    .padding(DVH.s3)
                                    .background(Brand.cream, in: RoundedRectangle(cornerRadius: DVH.rMd))
                                    .overlay(RoundedRectangle(cornerRadius: DVH.rMd)
                                        .strokeBorder(Brand.ink.opacity(0.12)))
                            }

                            if let error {
                                Text(error)
                                    .font(.dvhCaption)
                                    .foregroundStyle(Brand.terra)
                            }

                            Button {
                                submitReport()
                            } label: {
                                HStack(spacing: DVH.s2) {
                                    if submitting { ProgressView().tint(.white) }
                                    Text("Meld probleem")
                                }
                            }
                            .buttonStyle(.dvhPrimary(tint: Brand.terra))
                            .disabled(selected == nil || submitting)
                            .opacity(selected != nil ? 1 : 0.55)
                        }
                        .padding(.horizontal, DVH.s5)
                        .padding(.vertical, DVH.s5)
                    }
                }
            }
            .navigationTitle("Probleem melden")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuleer") { dismiss() }
                        .foregroundStyle(Brand.ink2)
                }
            }
        }
    }

    private var successView: some View {
        VStack(spacing: DVH.s4) {
            ZStack {
                Circle().fill(Brand.mossSoft).frame(width: 84, height: 84)
                Image(systemName: "checkmark.seal.fill")
                    .font(.system(size: 36))
                    .foregroundStyle(Brand.moss)
            }
            Text("Bedankt!")
                .font(.dvhTitle)
                .foregroundStyle(Brand.ink)
            Text("Bedankt, we kijken ernaar.")
                .font(.dvhCallout)
                .foregroundStyle(Brand.ink2)
                .multilineTextAlignment(.center)
            Button("Sluiten") { dismiss() }
                .buttonStyle(.dvhPrimary)
                .frame(maxWidth: 200)
                .padding(.top, DVH.s2)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(DVH.s5)
    }

    private func submitReport() {
        guard let token = session.token, let reason = selected else { return }
        submitting = true
        error = nil
        let noteText = note.trimmingCharacters(in: .whitespacesAndNewlines)
        Task {
            do {
                try await APIClient.reportSpot(
                    spotId: spotId,
                    reason: reason.rawValue,
                    note: noteText.isEmpty ? nil : noteText,
                    token: token
                )
                submitted = true
            } catch let e as APIError {
                _ = session.signOutIfUnauthorized(e)
                error = e.errorDescription ?? "Melden mislukt."
            } catch {
                self.error = "Melden mislukt. Probeer het opnieuw."
            }
            submitting = false
        }
    }
}

// MARK: - ModerationCardView

struct ModerationCardView: View {
    let spotId: String
    let currentStatus: String
    /// Called with the new status after a successful moderation action.
    var onModerated: ((String) -> Void)? = nil

    @EnvironmentObject var session: Session

    @State private var working = false
    @State private var resultMessage: String?
    @State private var updatedStatus: String?

    private var effectiveStatus: String { updatedStatus ?? currentStatus }

    private struct ModerationAction {
        let label: String
        let icon: String
        let status: String
        let tint: Color
    }

    private let actions: [ModerationAction] = [
        .init(label: "Verifieer", icon: "checkmark.seal", status: "VERIFIED", tint: Brand.moss),
        .init(label: "Herstel", icon: "arrow.counterclockwise", status: "UNVERIFIED", tint: Brand.ink2),
        .init(label: "Verberg", icon: "eye.slash", status: "HIDDEN", tint: Brand.terra),
        .init(label: "Verwijder", icon: "trash", status: "REMOVED", tint: Brand.rust),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: DVH.s3) {
            HStack(spacing: DVH.s2) {
                Image(systemName: "shield.lefthalf.filled")
                    .foregroundStyle(Brand.moss)
                Text("Moderatie")
                    .font(.dvhHeadline)
                    .foregroundStyle(Brand.ink)
            }

            LazyVGrid(
                columns: [GridItem(.flexible()), GridItem(.flexible())],
                spacing: DVH.s2
            ) {
                ForEach(actions, id: \.status) { action in
                    Button {
                        moderate(to: action.status)
                    } label: {
                        HStack(spacing: DVH.s1 + 2) {
                            Image(systemName: action.icon).font(.caption)
                            Text(action.label).font(.dvhCaption.weight(.semibold))
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, DVH.s2 + 2)
                        .background(
                            effectiveStatus == action.status
                                ? action.tint.opacity(0.15)
                                : Brand.sand,
                            in: RoundedRectangle(cornerRadius: DVH.rSm)
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: DVH.rSm)
                                .strokeBorder(
                                    effectiveStatus == action.status
                                        ? action.tint
                                        : Brand.ink.opacity(0.12),
                                    lineWidth: effectiveStatus == action.status ? 1.5 : 1
                                )
                        )
                        .foregroundStyle(
                            effectiveStatus == action.status ? action.tint : Brand.ink2
                        )
                    }
                    .buttonStyle(.plain)
                    .disabled(effectiveStatus == action.status || working)
                }
            }

            if working {
                HStack(spacing: DVH.s2) {
                    ProgressView().scaleEffect(0.8)
                    Text("Even wachten...")
                        .font(.dvhCaption)
                        .foregroundStyle(Brand.ink2)
                }
            }

            if let msg = resultMessage {
                Text(msg)
                    .font(.dvhCaption)
                    .foregroundStyle(Brand.moss)
            }
        }
        .dvhCard()
    }

    private func moderate(to status: String) {
        guard let token = session.token else { return }
        working = true
        resultMessage = nil
        Task {
            do {
                try await APIClient.moderateSpot(spotId: spotId, status: status, token: token)
                updatedStatus = status
                resultMessage = statusLabel(status)
                onModerated?(status)
            } catch let e as APIError {
                _ = session.signOutIfUnauthorized(e)
                resultMessage = e.errorDescription ?? "Actie mislukt."
            } catch {
                resultMessage = "Actie mislukt. Probeer het opnieuw."
            }
            working = false
        }
    }

    private func statusLabel(_ s: String) -> String {
        switch s {
        case "VERIFIED": return "Plek geverifieerd."
        case "UNVERIFIED": return "Plek teruggezet naar onbevestigd."
        case "HIDDEN": return "Plek verborgen."
        case "REMOVED": return "Plek verwijderd."
        default: return "Status bijgewerkt."
        }
    }
}

// MARK: - VoteProgressBar

struct VoteProgressBar: View {
    let netScore: Double

    private var clamped: Double { min(max(netScore, 0), 5) }
    private var fraction: Double { clamped / 5 }

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(Brand.ink.opacity(0.08)).frame(height: 4)
                Capsule()
                    .fill(Brand.moss)
                    .frame(width: geo.size.width * fraction, height: 4)
            }
        }
        .frame(height: 4)
    }
}
