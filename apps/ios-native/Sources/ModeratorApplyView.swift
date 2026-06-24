import SwiftUI

struct ModeratorApplyView: View {
    @EnvironmentObject var session: Session
    @Environment(\.dismiss) private var dismiss

    @State private var application: ModeratorApplication?
    @State private var loadingState: LoadState = .loading
    @State private var motivation = ""
    @State private var submitting = false
    @State private var submitError: String?
    @State private var submitted = false

    private enum LoadState { case loading, ready, error(String) }

    private var motivationTrimmed: String { motivation.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var canSubmit: Bool { motivationTrimmed.count >= 10 && !submitting }

    var body: some View {
        ScrollView {
            VStack(spacing: DVH.s5) {
                switch loadingState {
                case .loading:
                    ProgressView("Laden…")
                        .frame(maxWidth: .infinity, minHeight: 200)
                case .error(let msg):
                    EmptyStateView(
                        icon: "exclamationmark.triangle",
                        title: "Kon niet laden",
                        message: msg,
                        actionLabel: "Opnieuw proberen"
                    ) {
                        Task { await load() }
                    }
                case .ready:
                    if submitted {
                        successCard
                    } else if let app = application {
                        statusCard(app)
                    } else {
                        applyForm
                    }
                }
            }
            .padding(.horizontal, DVH.s4)
            .padding(.vertical, DVH.s5)
        }
        .dvhScreenBackground()
        .navigationTitle("Word moderator")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    // MARK: - Sub-views

    private var applyForm: some View {
        VStack(alignment: .leading, spacing: DVH.s5) {
            VStack(alignment: .leading, spacing: DVH.s3) {
                Text("Word moderator")
                    .font(.dvhTitle).foregroundStyle(Brand.ink)
                Text(
                    "Moderatoren helpen de kaart schoon te houden: ze kunnen plekken verifiëren, " +
                    "verbergen of verwijderen. Vertel ons waarom je moderator wilt worden en " +
                    "wat je bijdrage aan de community is."
                )
                .font(.dvhBody).foregroundStyle(Brand.ink2)
                .lineSpacing(4)
            }
            .dvhCard()

            VStack(alignment: .leading, spacing: DVH.s3) {
                HStack {
                    Text("Motivatie").font(.dvhHeadline).foregroundStyle(Brand.ink)
                    Spacer()
                    Text("\(motivationTrimmed.count)/1000")
                        .font(.dvhCaption).foregroundStyle(
                            motivationTrimmed.count > 900 ? Brand.terra : Brand.ink2)
                }

                TextEditor(text: $motivation)
                    .font(.dvhBody)
                    .foregroundStyle(Brand.ink)
                    .frame(minHeight: 160)
                    .padding(DVH.s3)
                    .background(Brand.cream, in: RoundedRectangle(cornerRadius: DVH.rMd))
                    .overlay(RoundedRectangle(cornerRadius: DVH.rMd).strokeBorder(Brand.ink.opacity(0.12)))
                    .onChange(of: motivation) { _, v in
                        if v.count > 1000 { motivation = String(v.prefix(1000)) }
                    }

                if motivationTrimmed.count < 10 && !motivationTrimmed.isEmpty {
                    Text("Vul minstens 10 tekens in.")
                        .font(.dvhCaption).foregroundStyle(Brand.terra)
                }

                if let submitError {
                    Text(submitError)
                        .font(.dvhCaption).foregroundStyle(Brand.rust)
                        .padding(.top, DVH.s1)
                }

                Button {
                    Task { await submit() }
                } label: {
                    HStack(spacing: DVH.s2) {
                        if submitting { ProgressView().tint(.white) }
                        Text("Aanmelding indienen")
                    }
                }
                .buttonStyle(.dvhPrimary)
                .disabled(!canSubmit)
                .opacity(canSubmit ? 1 : 0.55)
            }
            .dvhCard()
        }
    }

    private func statusCard(_ app: ModeratorApplication) -> some View {
        VStack(spacing: DVH.s4) {
            ZStack {
                Circle()
                    .fill(statusColor(app.status).opacity(0.15))
                    .frame(width: 72, height: 72)
                Image(systemName: statusIcon(app.status))
                    .font(.system(size: 30, weight: .medium))
                    .foregroundStyle(statusColor(app.status))
            }
            Text(statusTitle(app.status))
                .font(.dvhTitle).foregroundStyle(Brand.ink)
            Text(statusBody(app.status))
                .font(.dvhBody).foregroundStyle(Brand.ink2)
                .multilineTextAlignment(.center)
                .lineSpacing(4)
            DVHChip(
                label: statusLabel(app.status),
                icon: statusIcon(app.status),
                selected: true,
                tint: statusColor(app.status)
            ) {}
        }
        .padding(DVH.s5)
        .dvhCard()
    }

    private var successCard: some View {
        VStack(spacing: DVH.s4) {
            ZStack {
                Circle().fill(Brand.mossSoft).frame(width: 72, height: 72)
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 30)).foregroundStyle(Brand.moss)
            }
            Text("Aanmelding ingediend")
                .font(.dvhTitle).foregroundStyle(Brand.ink)
            Text("We beoordelen je aanvraag en laten het weten. Bedankt voor je betrokkenheid.")
                .font(.dvhBody).foregroundStyle(Brand.ink2)
                .multilineTextAlignment(.center)
                .lineSpacing(4)
        }
        .padding(DVH.s5)
        .dvhCard()
    }

    // MARK: - Status helpers

    private func statusColor(_ status: String) -> Color {
        switch status {
        case "APPROVED": return Brand.moss
        case "REJECTED": return Brand.rust
        default: return Brand.terra
        }
    }

    private func statusIcon(_ status: String) -> String {
        switch status {
        case "APPROVED": return "checkmark.seal.fill"
        case "REJECTED": return "xmark.circle.fill"
        default: return "clock.fill"
        }
    }

    private func statusTitle(_ status: String) -> String {
        switch status {
        case "APPROVED": return "Je bent moderator"
        case "REJECTED": return "Aanvraag afgewezen"
        default: return "Aanvraag in behandeling"
        }
    }

    private func statusBody(_ status: String) -> String {
        switch status {
        case "APPROVED":
            return "Je aanvraag is goedgekeurd. Je kunt nu plekken verifiëren en beheren."
        case "REJECTED":
            return "Je aanvraag is helaas afgewezen. Neem contact op als je vragen hebt."
        default:
            return "Je aanvraag wordt bekeken. We nemen contact op zodra er een beslissing is."
        }
    }

    private func statusLabel(_ status: String) -> String {
        switch status {
        case "APPROVED": return "Goedgekeurd"
        case "REJECTED": return "Afgewezen"
        default: return "In behandeling"
        }
    }

    // MARK: - Data

    private func load() async {
        guard let token = session.token else { return }
        loadingState = .loading
        do {
            application = try await APIClient.moderatorApplication(token: token)
            loadingState = .ready
        } catch let e as APIError {
            _ = session.signOutIfUnauthorized(e)
            loadingState = .error(e.errorDescription ?? "Laden mislukt.")
        } catch {
            loadingState = .error("Laden mislukt. Controleer je verbinding.")
        }
    }

    private func submit() async {
        guard let token = session.token else { return }
        submitting = true
        submitError = nil
        do {
            let result = try await APIClient.applyModerator(
                motivation: motivationTrimmed, token: token)
            application = result
            submitted = true
        } catch let e as APIError where e.code == "ALREADY_EXISTS" {
            submitError = "Je hebt al een aanmelding ingediend."
        } catch let e as APIError {
            _ = session.signOutIfUnauthorized(e)
            submitError = e.errorDescription ?? "Indienen mislukt."
        } catch {
            submitError = "Indienen mislukt. Probeer het opnieuw."
        }
        submitting = false
    }
}
