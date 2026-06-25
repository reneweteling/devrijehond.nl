import PhotosUI
import SwiftUI

struct DogEditView: View {
    @EnvironmentObject var session: Session
    @Environment(\.dismiss) private var dismiss

    /// Pass nil to create a new dog.
    let dog: Dog?

    @State private var name = ""
    @State private var breed = ""
    @State private var note = ""
    @State private var hasBirthDate = false
    @State private var birthDate = Date()
    @State private var uploadedPhotoUrl: String?
    @State private var localImage: UIImage?
    @State private var showPhotoSource = false
    @State private var uploading = false
    @State private var saving = false
    @State private var deleteAlert = false
    @State private var error: String?

    private var isEditing: Bool { dog != nil }
    private var nameTrimmed: String { name.trimmingCharacters(in: .whitespaces) }
    private var canSave: Bool {
        let n = nameTrimmed.count
        return n >= 1 && n <= 60 && !saving && !uploading
    }

    var body: some View {
        ScrollView {
            VStack(spacing: DVH.s5) {
                photoSection
                fieldsSection
                if isEditing { deleteSection }
            }
            .padding(.horizontal, DVH.s4)
            .padding(.vertical, DVH.s5)
        }
        .dvhScreenBackground()
        .navigationTitle(isEditing ? "Hond bewerken" : "Hond toevoegen")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("Opslaan") {
                    Task { await save() }
                }
                .font(.dvhHeadline)
                .disabled(!canSave)
            }
        }
        .alert("Hond verwijderen?", isPresented: $deleteAlert) {
            Button("Verwijderen", role: .destructive) { Task { await deleteDog() } }
            Button("Annuleren", role: .cancel) {}
        } message: {
            Text("Dit kan niet ongedaan worden gemaakt.")
        }
        .photoSource(isPresented: $showPhotoSource) { img in
            Task { await uploadImage(img) }
        }
        .onAppear { prefill() }
    }

    // MARK: - Sections

    private var photoSection: some View {
        VStack(spacing: DVH.s3) {
            Button { showPhotoSource = true } label: {
                ZStack(alignment: .bottomTrailing) {
                    dogAvatar
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
            if uploading {
                Text("Foto uploaden…").font(.dvhCaption).foregroundStyle(Brand.ink2)
            }
        }
        .frame(maxWidth: .infinity)
    }

    @ViewBuilder
    private var dogAvatar: some View {
        if let img = localImage {
            Image(uiImage: img)
                .resizable().scaledToFill()
                .frame(width: 96, height: 96)
                .clipShape(Circle())
                .overlay(Circle().strokeBorder(Brand.ink.opacity(0.08)))
        } else {
            Avatar(url: uploadedPhotoUrl ?? dog?.photoUrl, name: name.isEmpty ? nil : name, size: 96)
        }
    }

    private var fieldsSection: some View {
        VStack(spacing: DVH.s4) {
            VStack(alignment: .leading, spacing: DVH.s2) {
                Text("Naam").font(.dvhHeadline).foregroundStyle(Brand.ink)
                TextField("Naam van je hond", text: $name)
                    .textFieldStyle(.dvh)
                    .onChange(of: name) { _, v in if v.count > 60 { name = String(v.prefix(60)) } }
                if nameTrimmed.isEmpty {
                    Text("Naam is verplicht.").font(.dvhCaption).foregroundStyle(Brand.terra)
                }
            }

            VStack(alignment: .leading, spacing: DVH.s2) {
                Text("Ras (optioneel)").font(.dvhHeadline).foregroundStyle(Brand.ink)
                TextField("Bijv. Labrador, Teckel…", text: $breed)
                    .textFieldStyle(.dvh)
                    .onChange(of: breed) { _, v in if v.count > 80 { breed = String(v.prefix(80)) } }
            }

            VStack(alignment: .leading, spacing: DVH.s2) {
                Toggle(isOn: $hasBirthDate) {
                    Text("Geboortedatum bekend?")
                        .font(.dvhHeadline).foregroundStyle(Brand.ink)
                }
                .tint(Brand.moss)
                if hasBirthDate {
                    DatePicker(
                        "Geboortedatum",
                        selection: $birthDate,
                        in: ...Date(),
                        displayedComponents: .date
                    )
                    .datePickerStyle(.compact)
                    .font(.dvhBody)
                    .environment(\.locale, Locale(identifier: "nl_NL"))
                    .padding(.top, DVH.s1)
                }
            }

            VStack(alignment: .leading, spacing: DVH.s2) {
                HStack {
                    Text("Notitie (optioneel)").font(.dvhHeadline).foregroundStyle(Brand.ink)
                    Spacer()
                    Text("\(note.count)/500").font(.dvhCaption)
                        .foregroundStyle(note.count > 450 ? Brand.terra : Brand.ink2)
                }
                TextEditor(text: $note)
                    .font(.dvhBody)
                    .foregroundStyle(Brand.ink)
                    .frame(minHeight: 90)
                    .padding(DVH.s3)
                    .background(Brand.cream, in: RoundedRectangle(cornerRadius: DVH.rMd))
                    .overlay(RoundedRectangle(cornerRadius: DVH.rMd).strokeBorder(Brand.ink.opacity(0.12)))
                    .onChange(of: note) { _, v in if v.count > 500 { note = String(v.prefix(500)) } }
            }

            if let error {
                Text(error).font(.dvhCaption).foregroundStyle(Brand.rust)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            Button {
                Task { await save() }
            } label: {
                HStack(spacing: DVH.s2) {
                    if saving { ProgressView().tint(.white) }
                    Text(isEditing ? "Opslaan" : "Hond toevoegen")
                }
            }
            .buttonStyle(.dvhPrimary)
            .disabled(!canSave)
            .opacity(canSave ? 1 : 0.55)
        }
        .dvhCard()
    }

    @ViewBuilder
    private var deleteSection: some View {
        Button(role: .destructive) {
            deleteAlert = true
        } label: {
            Text("Verwijder hond")
                .font(.dvhHeadline)
                .foregroundStyle(Brand.rust)
                .frame(maxWidth: .infinity)
                .frame(height: DVH.controlHeight)
                .background(Brand.rust.opacity(0.1), in: RoundedRectangle(cornerRadius: DVH.rMd))
                .overlay(RoundedRectangle(cornerRadius: DVH.rMd).strokeBorder(Brand.rust.opacity(0.25)))
        }
        .buttonStyle(.plain)
    }

    // MARK: - Logic

    private func prefill() {
        guard let dog else { return }
        name = dog.name
        breed = dog.breed ?? ""
        note = dog.note ?? ""
        uploadedPhotoUrl = dog.photoUrl
        if let bd = dog.birthDate, let date = parseBirthDate(bd) {
            hasBirthDate = true
            birthDate = date
        }
    }

    private func uploadImage(_ img: UIImage) async {
        guard let token = session.token else { return }
        localImage = img
        uploading = true
        error = nil
        do {
            let jpeg = ImageUtil.squareJPEG(img)
            uploadedPhotoUrl = try await APIClient.uploadPhoto(jpeg: jpeg, token: token)
        } catch let e as APIError {
            _ = session.signOutIfUnauthorized(e)
            error = "Foto uploaden mislukt."
        } catch {
            self.error = "Foto uploaden mislukt."
        }
        uploading = false
    }

    private func save() async {
        guard let token = session.token else { return }
        saving = true
        error = nil
        let noteTrimmed = note.trimmingCharacters(in: .whitespacesAndNewlines)
        let breedTrimmed = breed.trimmingCharacters(in: .whitespaces)
        let body = DogBody(
            name: nameTrimmed,
            breed: breedTrimmed.isEmpty ? nil : breedTrimmed,
            birthDate: hasBirthDate ? formattedBirthDate(birthDate) : nil,
            birthYear: nil,
            photoUrl: uploadedPhotoUrl,
            note: noteTrimmed.isEmpty ? nil : noteTrimmed
        )
        do {
            if let dog {
                _ = try await APIClient.updateDog(id: dog.id, body: body, token: token)
            } else {
                _ = try await APIClient.createDog(body, token: token)
            }
            await session.hydrate()
            dismiss()
        } catch let e as APIError {
            _ = session.signOutIfUnauthorized(e)
            error = e.errorDescription ?? "Opslaan mislukt."
        } catch {
            self.error = "Opslaan mislukt. Probeer het opnieuw."
        }
        saving = false
    }

    private func deleteDog() async {
        guard let dog, let token = session.token else { return }
        saving = true
        error = nil
        do {
            try await APIClient.deleteDog(id: dog.id, token: token)
            await session.hydrate()
            dismiss()
        } catch let e as APIError {
            _ = session.signOutIfUnauthorized(e)
            error = e.errorDescription ?? "Verwijderen mislukt."
        } catch {
            self.error = "Verwijderen mislukt. Probeer het opnieuw."
        }
        saving = false
    }

    // MARK: - Helpers

    private func formattedBirthDate(_ date: Date) -> String {
        DogEditView.isoDayFormatter.string(from: date)
    }

    private func parseBirthDate(_ string: String) -> Date? {
        DogEditView.isoDayFormatter.date(from: string)
    }

    /// Fixed-format YYYY-MM-DD formatter. en_US_POSIX locale + Gregorian calendar
    /// + UTC are required for internet date strings so that non-Gregorian device
    /// calendars (Buddhist, Japanese, Persian) don't corrupt the year.
    static let isoDayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.calendar = Calendar(identifier: .gregorian)
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

}
