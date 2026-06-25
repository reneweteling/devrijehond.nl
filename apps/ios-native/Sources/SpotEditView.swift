import SwiftUI
import UIKit

/// Edit a spot's text details. The owner may edit while the spot is still
/// UNVERIFIED; staff (ADMIN/MODERATOR) may edit any spot, any status. The map
/// geometry is not editable here, only the descriptive fields.
///
/// Pre-fills from `detail` when available, falling back to the lighter
/// `summary`. On save it PATCHes /api/v1/me/spots/:id, calls `onSaved`, then
/// dismisses.
struct SpotEditView: View {
    @EnvironmentObject var session: Session
    @Environment(\.dismiss) private var dismiss

    let spot: SpotSummary
    let detail: SpotDetail?
    let onSaved: () -> Void

    init(spot: SpotSummary, detail: SpotDetail?, onSaved: @escaping () -> Void) {
        self.spot = spot
        self.detail = detail
        self.onSaved = onSaved
    }

    @State private var name = ""
    @State private var description = ""
    @State private var website = ""
    @State private var phone = ""
    @State private var address = ""
    @State private var categoryId: String?
    @State private var categories: [Category] = []
    @State private var amenities: [Amenity] = []
    @State private var selectedAmenities: Set<String> = []
    @State private var loaded = false
    @State private var saving = false
    @State private var error: String?
    @State private var localImage: UIImage?
    @State private var uploadedPhotoUrl: String?
    @State private var showPhotoSource = false
    @State private var uploadingPhoto = false

    private var typeString: String { detail?.type ?? spot.type }

    private var pickableCategories: [Category] {
        let matched = categories.filter { $0.type == typeString }
        return matched.isEmpty ? categories : matched
    }

    private var canSave: Bool {
        let n = name.trimmingCharacters(in: .whitespaces).count
        return n >= 2 && n <= 120 && categoryId != nil && !saving && !uploadingPhoto
    }

    var body: some View {
        ScrollView {
            VStack(spacing: DVH.s5) {
                photoSection
                fieldsSection
                if !amenities.isEmpty {
                    amenitiesSection
                }
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
        .photoSource(isPresented: $showPhotoSource) { img in
            Task { await uploadPhoto(img) }
        }
        .navigationTitle("Plek bewerken")
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
        .task { await load() }
    }

    // MARK: - Sections

    private var currentPhotoURL: URL? {
        if let u = detail?.photos.first?.url ?? spot.photoUrl { return URL(string: u) }
        return nil
    }

    private var photoSection: some View {
        VStack(alignment: .leading, spacing: DVH.s3) {
            Text("Foto").font(.dvhHeadline).foregroundStyle(Brand.ink)
            Button { showPhotoSource = true } label: {
                ZStack(alignment: .bottomTrailing) {
                    Group {
                        if let img = localImage {
                            Image(uiImage: img).resizable().scaledToFill()
                        } else if let url = currentPhotoURL {
                            AsyncImage(url: url) { $0.resizable().scaledToFill() } placeholder: {
                                Rectangle().fill(Brand.mossSoft)
                            }
                        } else {
                            ZStack {
                                Rectangle().fill(Brand.mossSoft)
                                Image(systemName: "photo").font(.title).foregroundStyle(Brand.mossDark)
                            }
                        }
                    }
                    .frame(maxWidth: .infinity).frame(height: 160).clipped()
                    .clipShape(RoundedRectangle(cornerRadius: DVH.rMd))
                    ZStack {
                        Circle().fill(Brand.moss).frame(width: 32, height: 32)
                        Image(systemName: uploadingPhoto ? "arrow.triangle.2.circlepath" : "camera.fill")
                            .font(.system(size: 13, weight: .bold)).foregroundStyle(.white)
                    }
                    .padding(DVH.s2)
                }
            }
            .buttonStyle(.plain)
            Text(uploadingPhoto ? "Foto uploaden…" : "Tik om de foto te wijzigen")
                .font(.dvhCaption).foregroundStyle(Brand.ink2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .dvhCard()
    }

    private var fieldsSection: some View {
        VStack(alignment: .leading, spacing: DVH.s4) {
            VStack(alignment: .leading, spacing: DVH.s2) {
                Text("Naam").font(.dvhHeadline).foregroundStyle(Brand.ink)
                TextField("Naam van de plek", text: $name)
                    .textFieldStyle(.dvh)
                    .onChange(of: name) { _, v in if v.count > 120 { name = String(v.prefix(120)) } }
            }

            VStack(alignment: .leading, spacing: DVH.s2) {
                Text("Categorie").font(.dvhHeadline).foregroundStyle(Brand.ink)
                if pickableCategories.isEmpty {
                    ProgressView()
                } else {
                    Picker("Categorie", selection: $categoryId) {
                        Text("Kies een categorie").tag(String?.none)
                        ForEach(pickableCategories) { c in
                            Text(c.label).tag(String?.some(c.id))
                        }
                    }
                    .pickerStyle(.menu)
                    .tint(Brand.mossDark)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .frame(height: DVH.controlHeight)
                    .padding(.horizontal, DVH.s4)
                    .background(Brand.cream, in: RoundedRectangle(cornerRadius: DVH.rMd))
                    .overlay(RoundedRectangle(cornerRadius: DVH.rMd).strokeBorder(Brand.ink.opacity(0.12)))
                    .onChange(of: categoryId) { _, id in
                        if let id { Task { await loadAmenities(id) } } else { amenities = [] }
                    }
                }
            }

            VStack(alignment: .leading, spacing: DVH.s2) {
                Text("Beschrijving").font(.dvhHeadline).foregroundStyle(Brand.ink)
                TextEditor(text: $description)
                    .font(.dvhBody)
                    .foregroundStyle(Brand.ink)
                    .frame(minHeight: 110)
                    .padding(DVH.s3)
                    .background(Brand.cream, in: RoundedRectangle(cornerRadius: DVH.rMd))
                    .overlay(RoundedRectangle(cornerRadius: DVH.rMd).strokeBorder(Brand.ink.opacity(0.12)))
                    .onChange(of: description) { _, v in if v.count > 4000 { description = String(v.prefix(4000)) } }
            }

            VStack(alignment: .leading, spacing: DVH.s2) {
                Text("Adres").font(.dvhHeadline).foregroundStyle(Brand.ink)
                TextField("Adres", text: $address)
                    .textFieldStyle(.dvh)
                    .onChange(of: address) { _, v in if v.count > 240 { address = String(v.prefix(240)) } }
            }

            VStack(alignment: .leading, spacing: DVH.s2) {
                Text("Website").font(.dvhHeadline).foregroundStyle(Brand.ink)
                TextField("https://", text: $website)
                    .textFieldStyle(.dvh)
                    .textInputAutocapitalization(.never)
                    .keyboardType(.URL)
                    .autocorrectionDisabled()
            }

            VStack(alignment: .leading, spacing: DVH.s2) {
                Text("Telefoon").font(.dvhHeadline).foregroundStyle(Brand.ink)
                TextField("Telefoonnummer", text: $phone)
                    .textFieldStyle(.dvh)
                    .keyboardType(.phonePad)
                    .onChange(of: phone) { _, v in if v.count > 40 { phone = String(v.prefix(40)) } }
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

    private var amenitiesSection: some View {
        VStack(alignment: .leading, spacing: DVH.s3) {
            Text("Voorzieningen").font(.dvhHeadline).foregroundStyle(Brand.ink)
            let columns = [GridItem(.adaptive(minimum: 110), spacing: DVH.s2)]
            LazyVGrid(columns: columns, alignment: .leading, spacing: DVH.s2) {
                ForEach(amenities) { a in
                    DVHChip(
                        label: a.label,
                        icon: a.icon ?? "checkmark",
                        selected: selectedAmenities.contains(a.id)
                    ) {
                        if selectedAmenities.contains(a.id) {
                            selectedAmenities.remove(a.id)
                        } else {
                            selectedAmenities.insert(a.id)
                        }
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .dvhCard()
    }

    // MARK: - Data

    private func load() async {
        guard !loaded else { return }
        loaded = true
        prefill()
        if categories.isEmpty {
            categories = (try? await APIClient.categories()) ?? []
        }
        if let id = categoryId {
            await loadAmenities(id)
        }
    }

    private func prefill() {
        name = detail?.name ?? spot.name
        description = detail?.description ?? ""
        website = detail?.website ?? ""
        phone = detail?.phone ?? ""
        address = detail?.address ?? ""
        categoryId = detail?.category.id ?? spot.categoryId
        selectedAmenities = Set((detail?.amenities ?? []).map(\.id))
    }

    private func loadAmenities(_ id: String) async {
        amenities = (try? await APIClient.amenities(categoryId: id)) ?? []
    }

    private func uploadPhoto(_ img: UIImage) async {
        guard let token = session.token else { return }
        localImage = img
        uploadingPhoto = true
        error = nil
        do {
            let jpeg = ImageUtil.squareJPEG(img)
            uploadedPhotoUrl = try await APIClient.uploadPhoto(jpeg: jpeg, token: token)
        } catch let e as APIError {
            _ = session.signOutIfUnauthorized(e)
            self.error = "Foto uploaden mislukt."
        } catch {
            self.error = "Foto uploaden mislukt. Probeer het opnieuw."
        }
        uploadingPhoto = false
    }

    private func save() async {
        guard let token = session.token, let categoryId else { return }
        saving = true
        error = nil
        let trimmedName = name.trimmingCharacters(in: .whitespaces)
        let trimmedDesc = description.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedAddr = address.trimmingCharacters(in: .whitespaces)
        let trimmedPhone = phone.trimmingCharacters(in: .whitespaces)
        let body = UpdateSpotBody(
            name: trimmedName,
            description: trimmedDesc,
            website: normalizedWebsite(),
            phone: trimmedPhone.isEmpty ? nil : trimmedPhone,
            categoryId: categoryId,
            amenityIds: Array(selectedAmenities),
            address: trimmedAddr.isEmpty ? nil : trimmedAddr,
            photoUrls: uploadedPhotoUrl.map { [$0] }
        )
        do {
            _ = try await APIClient.updateSpot(id: spot.id, body: body, token: token)
            onSaved()
            dismiss()
        } catch let e as APIError {
            if session.signOutIfUnauthorized(e) {
                error = "Je sessie is verlopen. Log opnieuw in."
            } else if e.status == 403 {
                error = "Je mag deze plek niet bewerken."
            } else if e.status == 404 {
                error = "Deze plek bestaat niet of is niet bewerkbaar."
            } else {
                error = e.errorDescription ?? "Opslaan mislukt."
            }
        } catch {
            self.error = "Opslaan mislukt. Probeer het opnieuw."
        }
        saving = false
    }

    /// zod's z.string().url() requires a scheme; a user typing "example.com"
    /// would 400. Prefix https:// when no scheme is present. Empty clears it.
    private func normalizedWebsite() -> String? {
        let s = website.trimmingCharacters(in: .whitespaces)
        guard !s.isEmpty else { return nil }
        if s.lowercased().hasPrefix("http://") || s.lowercased().hasPrefix("https://") { return s }
        return "https://\(s)"
    }
}
