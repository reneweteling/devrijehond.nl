import SwiftUI
import UIKit

/// Pick a photo from the camera or the photo library and crop it square.
/// SwiftUI has no native cropping picker, so this wraps UIImagePickerController
/// with `allowsEditing = true`, which gives the built-in square crop UI for
/// both sources. The camera source needs NSCameraUsageDescription in Info.plist.
struct ImagePicker: UIViewControllerRepresentable {
    let sourceType: UIImagePickerController.SourceType
    let onImage: (UIImage) -> Void
    @Environment(\.dismiss) private var dismiss

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = sourceType
        picker.allowsEditing = true
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ controller: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: ImagePicker
        init(_ parent: ImagePicker) { self.parent = parent }

        func imagePickerController(
            _ picker: UIImagePickerController,
            didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]
        ) {
            if let image = info[.editedImage] as? UIImage ?? info[.originalImage] as? UIImage {
                parent.onImage(image)
            }
            parent.dismiss()
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            parent.dismiss()
        }
    }
}

/// Attach to a tappable view: on `isPresented`, offers "Maak een foto" (camera,
/// when available) or "Kies uit bibliotheek", lets the user crop the result
/// square, and calls `onImage` with the resulting UIImage from either source.
struct PhotoSourceModifier: ViewModifier {
    @Binding var isPresented: Bool
    let onImage: (UIImage) -> Void

    @State private var showCamera = false
    @State private var showLibrary = false

    func body(content: Content) -> some View {
        content
            .confirmationDialog("Foto toevoegen", isPresented: $isPresented, titleVisibility: .visible) {
                if UIImagePickerController.isSourceTypeAvailable(.camera) {
                    Button("Maak een foto") { showCamera = true }
                }
                Button("Kies uit bibliotheek") { showLibrary = true }
                Button("Annuleer", role: .cancel) {}
            }
            .fullScreenCover(isPresented: $showCamera) {
                ImagePicker(sourceType: .camera) { img in onImage(img) }
                    .ignoresSafeArea()
            }
            .fullScreenCover(isPresented: $showLibrary) {
                ImagePicker(sourceType: .photoLibrary) { img in onImage(img) }
                    .ignoresSafeArea()
            }
    }
}

extension View {
    /// Pick a photo from the camera or the library via one entry point.
    func photoSource(isPresented: Binding<Bool>, onImage: @escaping (UIImage) -> Void) -> some View {
        modifier(PhotoSourceModifier(isPresented: isPresented, onImage: onImage))
    }
}
