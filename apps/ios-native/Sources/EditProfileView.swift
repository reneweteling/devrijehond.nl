import PhotosUI
import SwiftUI

struct EditProfileView: View {
    @EnvironmentObject var session: Session
    @Environment(\.dismiss) private var dismiss

    @State private var name = ""
    @State private var handle = ""
    @State private var bio = ""
    @State private var uploadedImageUrl: String?
    @State private var localImage: UIImage?
    @State private var showPhotoSource = false
    @State private var uploading = false
    @State private var saving = false
    @State private var error: String?

    private var handleValid: Bool {
        let h = handle.trimmingCharacters(in: .whitespaces)
        if h.isEmpty { return true }  // optional
        let range = NSRange(h.startIndex..., in: h)
        let re = try? NSRegularExpression(pattern: "^[a-z0-9_]{3,30}$")
        return re?.firstMatch(in: h, range: range) != nil
    }

    private var canSave: Bool {
        !saving && !uploading && handleValid
    }

    var body: some View {
        ScrollView {
            VStack(spacing: DVH.s5) {
                avatarSection
                fieldsSection
                if let error {
                    Text(error)
                        .font(.dvhCaption).foregroundStyle(Brand.rust)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, DVH.s4)
                }
            }
            .padding(.horizontal, DVH.s4)
            .padding(.vertical, DVH.s5)
        }
        .dvhScreenBackground()
        .navigationTitle("Profiel bewerken")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button {
                    Task { await save() }
                } label: {
                    if saving {
                        ProgressView().scaleEffect(0.8)
                    } else {
                        Text("Opslaan")
                    }
                }
                .font(.dvhHeadline)
                .disabled(!canSave)
            }
        }
        .photoSource(isPresented: $showPhotoSource) { img in
            Task { await uploadImage(img) }
        }
        .onAppear { prefill() }
    }

    // MARK: - Sections

    private var avatarSection: some View {
        VStack(spacing: DVH.s3) {
            Button { showPhotoSource = true } label: {
                ZStack(alignment: .bottomTrailing) {
                    if let img = localImage {
                        Image(uiImage: img)
                            .resizable().scaledToFill()
                            .frame(width: 88, height: 88)
                            .clipShape(Circle())
                            .overlay(Circle().strokeBorder(Brand.ink.opacity(0.08)))
                    } else {
                        Avatar(
                            url: uploadedImageUrl ?? session.profile?.image,
                            name: name.isEmpty ? session.profile?.name : name,
                            size: 88
                        )
                    }
                    ZStack {
                        Circle().fill(Brand.moss).frame(width: 28, height: 28)
                        Image(systemName: uploading ? "arrow.triangle.2.circlepath" : "camera.fill")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(.white)
                    }
                    .offset(x: 4, y: 4)
                }
            }
            .buttonStyle(.plain)
            Text(uploading ? "Foto uploaden…" : "Foto wijzigen")
                .font(.dvhCaption).foregroundStyle(Brand.ink2)
        }
        .frame(maxWidth: .infinity)
    }

    private var fieldsSection: some View {
        VStack(spacing: DVH.s4) {
            VStack(alignment: .leading, spacing: DVH.s2) {
                Text("Naam").font(.dvhHeadline).foregroundStyle(Brand.ink)
                TextField("Je naam", text: $name)
                    .textFieldStyle(.dvh)
                    .textContentType(.name)
                    .onChange(of: name) { _, v in if v.count > 80 { name = String(v.prefix(80)) } }
            }

            VStack(alignment: .leading, spacing: DVH.s2) {
                Text("Gebruikersnaam").font(.dvhHeadline).foregroundStyle(Brand.ink)
                HStack(spacing: 0) {
                    Text("@")
                        .font(.dvhBody.weight(.medium))
                        .foregroundStyle(Brand.ink2)
                        .padding(.leading, DVH.s4)
                    TextField("gebruikersnaam", text: $handle)
                        .font(.dvhBody)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .padding(.horizontal, DVH.s3)
                        .onChange(of: handle) { _, v in
                            // lowercase and strip invalid chars
                            let cleaned = v.lowercased()
                                .filter { $0.isLetter || $0.isNumber || $0 == "_" }
                            let trimmed = String(cleaned.prefix(30))
                            if trimmed != v { handle = trimmed }
                        }
                }
                .frame(height: DVH.controlHeight)
                .background(Brand.cream, in: RoundedRectangle(cornerRadius: DVH.rMd))
                .overlay(
                    RoundedRectangle(cornerRadius: DVH.rMd)
                        .strokeBorder(handleValid ? Brand.ink.opacity(0.12) : Brand.rust.opacity(0.5))
                )
                if !handleValid {
                    Text("Gebruik 3-30 letters, cijfers of underscores.")
                        .font(.dvhCaption).foregroundStyle(Brand.terra)
                }
            }

            VStack(alignment: .leading, spacing: DVH.s2) {
                HStack {
                    Text("Bio").font(.dvhHeadline).foregroundStyle(Brand.ink)
                    Spacer()
                    Text("\(bio.count)/280")
                        .font(.dvhCaption)
                        .foregroundStyle(bio.count > 250 ? Brand.terra : Brand.ink2)
                }
                TextEditor(text: $bio)
                    .font(.dvhBody)
                    .foregroundStyle(Brand.ink)
                    .frame(minHeight: 90)
                    .padding(DVH.s3)
                    .background(Brand.cream, in: RoundedRectangle(cornerRadius: DVH.rMd))
                    .overlay(RoundedRectangle(cornerRadius: DVH.rMd).strokeBorder(Brand.ink.opacity(0.12)))
                    .onChange(of: bio) { _, v in if v.count > 280 { bio = String(v.prefix(280)) } }
            }

            Button {
                Task { await save() }
            } label: {
                HStack(spacing: DVH.s2) {
                    if saving { ProgressView().tint(.white) }
                    Text("Opslaan")
                }
            }
            .buttonStyle(.dvhPrimary)
            .disabled(!canSave)
            .opacity(canSave ? 1 : 0.55)
        }
        .dvhCard()
    }

    // MARK: - Logic

    private func prefill() {
        guard let me = session.profile else { return }
        name = me.name ?? ""
        handle = me.handle ?? ""
        bio = me.bio ?? ""
        uploadedImageUrl = me.image
    }

    private func uploadImage(_ img: UIImage) async {
        guard let token = session.token else { return }
        localImage = img
        uploading = true
        error = nil
        do {
            let jpeg = ImageUtil.squareJPEG(img)
            uploadedImageUrl = try await APIClient.uploadPhoto(jpeg: jpeg, token: token)
        } catch let e as APIError {
            if session.signOutIfUnauthorized(e) {
                error = "Je sessie is verlopen. Log opnieuw in."
            } else {
                error = "Foto uploaden mislukt: \(e.errorDescription ?? "onbekende fout")."
            }
        } catch {
            self.error = "Foto uploaden mislukt. Probeer het opnieuw."
        }
        uploading = false
    }

    private func save() async {
        guard let token = session.token else { return }
        saving = true
        error = nil
        let nameTrimmed = name.trimmingCharacters(in: .whitespaces)
        let handleTrimmed = handle.trimmingCharacters(in: .whitespaces)
        let bioTrimmed = bio.trimmingCharacters(in: .whitespacesAndNewlines)
        let patch = MeProfilePatchBody(
            name: nameTrimmed.isEmpty ? nil : nameTrimmed,
            handle: handleTrimmed.isEmpty ? nil : handleTrimmed,
            bio: bioTrimmed.isEmpty ? nil : bioTrimmed,
            image: uploadedImageUrl
        )
        do {
            // Use the returned, authoritative profile so the new avatar shows
            // immediately (no waiting on a separate re-fetch round-trip).
            let updated = try await APIClient.updateProfile(patch, token: token)
            session.setProfile(updated)
            dismiss()
        } catch let e as APIError {
            _ = session.signOutIfUnauthorized(e)
            error = e.errorDescription ?? "Opslaan mislukt."
        } catch {
            self.error = "Opslaan mislukt. Probeer het opnieuw."
        }
        saving = false
    }

}
