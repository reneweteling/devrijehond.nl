import PhotosUI
import SwiftUI

/// Step 2 of adding a spot: the geometry is already drawn, here the user fills
/// the details and submits. Uploads photos first, then POSTs the spot.
struct SpotFormView: View {
    @EnvironmentObject var session: Session
    @Environment(\.dismiss) private var dismiss

    let isRegion: Bool
    let point: GeoPoint?
    let polygon: [GeoPoint]
    let onCreated: (CreatedSpot) -> Void

    @State private var name = ""
    @State private var description = ""
    @State private var website = ""
    @State private var address = ""
    @State private var categoryId: String?
    @State private var categories: [Category] = []
    @State private var amenities: [Amenity] = []
    @State private var selectedAmenities: Set<String> = []
    @State private var pickerItems: [PhotosPickerItem] = []
    @State private var images: [UIImage] = []
    @State private var uploadedURLs: [String] = []
    @State private var showPhotoSource = false
    @State private var showCamera = false
    @State private var showLibrary = false
    @State private var submitting = false
    @State private var error: String?

    private var typeString: String { isRegion ? "REGION" : "POI" }

    private var pickableCategories: [Category] {
        let matched = categories.filter { $0.type == typeString }
        return matched.isEmpty ? categories : matched
    }

    private var canSubmit: Bool {
        let n = name.trimmingCharacters(in: .whitespaces).count
        return n >= 2 && n <= 120 && categoryId != nil && !submitting
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Naam") {
                    TextField(isRegion ? "Naam van het gebied" : "Naam van de plek", text: $name)
                        .onChange(of: name) { _, v in if v.count > 120 { name = String(v.prefix(120)) } }
                }

                Section("Categorie") {
                    if pickableCategories.isEmpty {
                        ProgressView()
                    } else {
                        Picker("Categorie", selection: $categoryId) {
                            Text("Kies een categorie").tag(String?.none)
                            ForEach(pickableCategories) { c in
                                Text(c.label).tag(String?.some(c.id))
                            }
                        }
                        .onChange(of: categoryId) { _, id in
                            selectedAmenities = []
                            if let id { Task { await loadAmenities(id) } }
                        }
                    }
                }

                Section("Beschrijving") {
                    TextField("Wat is hier leuk voor honden?", text: $description, axis: .vertical)
                        .lineLimit(3...8)
                }

                if !isRegion {
                    Section("Details (optioneel)") {
                        TextField("Adres", text: $address)
                        TextField("Website", text: $website)
                            .textInputAutocapitalization(.never)
                            .keyboardType(.URL)
                            .autocorrectionDisabled()
                    }
                }

                if !amenities.isEmpty {
                    Section("Voorzieningen") {
                        amenityChips
                    }
                }

                Section("Foto's") {
                    photoRow
                }

                Section {
                    if let error {
                        Text(error).font(.footnote).foregroundStyle(Brand.terra)
                    }
                    Button {
                        submit()
                    } label: {
                        HStack {
                            if submitting { ProgressView().tint(.white) }
                            Text("Plek plaatsen").frame(maxWidth: .infinity)
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(Brand.moss)
                    .disabled(!canSubmit)
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
                }
            }
            .navigationTitle("Gegevens")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Terug") { dismiss() }
                }
            }
            .task { if categories.isEmpty { categories = (try? await APIClient.categories()) ?? [] } }
            .onChange(of: pickerItems) { _, items in Task { await loadImages(items) } }
            .confirmationDialog("Foto toevoegen", isPresented: $showPhotoSource, titleVisibility: .visible) {
                if UIImagePickerController.isSourceTypeAvailable(.camera) {
                    Button("Maak een foto") { showCamera = true }
                }
                Button("Kies uit bibliotheek") { showLibrary = true }
                Button("Annuleer", role: .cancel) {}
            }
            .photosPicker(
                isPresented: $showLibrary, selection: $pickerItems,
                maxSelectionCount: 10, matching: .images)
            .fullScreenCover(isPresented: $showCamera) {
                CameraPicker { img in
                    images.append(img)
                    uploadedURLs = []
                }
                .ignoresSafeArea()
            }
        }
    }

    private var amenityChips: some View {
        let columns = [GridItem(.adaptive(minimum: 110), spacing: 8)]
        return LazyVGrid(columns: columns, alignment: .leading, spacing: 8) {
            ForEach(amenities) { a in
                let on = selectedAmenities.contains(a.id)
                Button {
                    if on { selectedAmenities.remove(a.id) } else { selectedAmenities.insert(a.id) }
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: a.icon ?? "checkmark").font(.caption2)
                        Text(a.label).font(.caption)
                    }
                    .padding(.horizontal, 10).padding(.vertical, 7)
                    .background(on ? Brand.moss : Brand.mossSoft, in: Capsule())
                    .foregroundStyle(on ? .white : Brand.mossDark)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.vertical, 4)
    }

    private var photoRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                Button { showPhotoSource = true } label: {
                    ZStack {
                        RoundedRectangle(cornerRadius: 12).fill(Brand.mossSoft)
                        Image(systemName: "camera.fill").foregroundStyle(Brand.mossDark)
                    }
                    .frame(width: 76, height: 76)
                }
                .buttonStyle(.plain)
                ForEach(Array(images.enumerated()), id: \.offset) { _, img in
                    Image(uiImage: img).resizable().scaledToFill()
                        .frame(width: 76, height: 76)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }
            }
            .padding(.vertical, 4)
        }
    }

    // MARK: - Data

    private func loadAmenities(_ id: String) async {
        amenities = (try? await APIClient.amenities(categoryId: id)) ?? []
    }

    private func loadImages(_ items: [PhotosPickerItem]) async {
        guard !items.isEmpty else { return }
        for item in items {
            if let data = try? await item.loadTransferable(type: Data.self),
               let img = UIImage(data: data) {
                images.append(img)
            }
        }
        pickerItems = []  // consumed; allow picking more later
        uploadedURLs = []  // selection changed: invalidate any cached uploads
    }

    private func submit() {
        guard let token = session.token, let categoryId else { return }
        submitting = true
        error = nil
        Task {
            do {
                let photoURLs = try await uploadPhotos(token: token)
                let trimmedDesc = description.trimmingCharacters(in: .whitespacesAndNewlines)
                let trimmedAddr = address.trimmingCharacters(in: .whitespaces)
                let body = SubmitSpotBody(
                    type: typeString,
                    categoryId: categoryId,
                    name: name.trimmingCharacters(in: .whitespaces),
                    description: trimmedDesc.isEmpty ? nil : trimmedDesc,
                    point: isRegion ? nil : point,
                    polygon: isRegion ? polygon : nil,
                    amenityIds: Array(selectedAmenities),
                    photos: photoURLs,
                    address: (!isRegion && !trimmedAddr.isEmpty) ? trimmedAddr : nil,
                    website: isRegion ? nil : normalizedWebsite())
                let created = try await APIClient.submitSpot(body, token: token)
                onCreated(created)
                dismiss()
            } catch let e as APIError {
                if session.signOutIfUnauthorized(e) {
                    self.error = "Je sessie is verlopen. Log opnieuw in."
                } else {
                    self.error = e.errorDescription ?? "Plaatsen mislukt."
                }
            } catch {
                self.error = "Plaatsen mislukt. Probeer het opnieuw."
            }
            submitting = false
        }
    }

    /// zod's z.string().url() requires a scheme; a user typing "example.com"
    /// would 400. Prefix https:// when no scheme is present.
    private func normalizedWebsite() -> String? {
        let s = website.trimmingCharacters(in: .whitespaces)
        guard !s.isEmpty else { return nil }
        if s.lowercased().hasPrefix("http://") || s.lowercased().hasPrefix("https://") { return s }
        return "https://\(s)"
    }

    /// Upload each picked image (downscaled JPEG) and collect the public URLs.
    /// Caches the result so a failed submit + retry doesn't re-upload (and orphan)
    /// every image again.
    private func uploadPhotos(token: String) async throws -> [String] {
        if !images.isEmpty, uploadedURLs.count == min(images.count, 10) { return uploadedURLs }
        var urls: [String] = []
        for img in images.prefix(10) {
            let jpeg = ImageUtil.jpeg(img)
            let url = try await APIClient.uploadPhoto(jpeg: jpeg, token: token)
            urls.append(url)
        }
        uploadedURLs = urls
        return urls
    }
}
