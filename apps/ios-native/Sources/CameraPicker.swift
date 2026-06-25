import PhotosUI
import SwiftUI
import UIKit

/// Take a photo with the camera. SwiftUI has no native camera picker, so this
/// wraps UIImagePickerController. Needs NSCameraUsageDescription in Info.plist.
struct CameraPicker: UIViewControllerRepresentable {
    let onImage: (UIImage) -> Void
    @Environment(\.dismiss) private var dismiss

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ controller: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: CameraPicker
        init(_ parent: CameraPicker) { self.parent = parent }

        func imagePickerController(
            _ picker: UIImagePickerController,
            didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]
        ) {
            if let image = info[.originalImage] as? UIImage { parent.onImage(image) }
            parent.dismiss()
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            parent.dismiss()
        }
    }
}

/// Attach to a tappable view: on `isPresented`, offers "Maak een foto" (camera,
/// when available) or "Kies uit bibliotheek", and calls `onImage` with the
/// resulting UIImage from either source.
struct PhotoSourceModifier: ViewModifier {
    @Binding var isPresented: Bool
    let onImage: (UIImage) -> Void

    @State private var showCamera = false
    @State private var showLibrary = false
    @State private var pickerItem: PhotosPickerItem?

    func body(content: Content) -> some View {
        content
            .confirmationDialog("Foto toevoegen", isPresented: $isPresented, titleVisibility: .visible) {
                if UIImagePickerController.isSourceTypeAvailable(.camera) {
                    Button("Maak een foto") { showCamera = true }
                }
                Button("Kies uit bibliotheek") { showLibrary = true }
                Button("Annuleer", role: .cancel) {}
            }
            .photosPicker(isPresented: $showLibrary, selection: $pickerItem, matching: .images)
            .fullScreenCover(isPresented: $showCamera) {
                CameraPicker { img in onImage(img) }
                    .ignoresSafeArea()
            }
            .onChange(of: pickerItem) { _, item in
                guard let item else { return }
                Task {
                    if let data = try? await item.loadTransferable(type: Data.self),
                       let img = UIImage(data: data) {
                        onImage(img)
                    }
                    pickerItem = nil
                }
            }
    }
}

extension View {
    /// Pick a photo from the camera or the library via one entry point.
    func photoSource(isPresented: Binding<Bool>, onImage: @escaping (UIImage) -> Void) -> some View {
        modifier(PhotoSourceModifier(isPresented: isPresented, onImage: onImage))
    }
}
