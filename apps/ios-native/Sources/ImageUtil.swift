import UIKit

/// Image downscaling for uploads. The proxy in front of the API caps request
/// bodies near 1 MB, so we resize and step JPEG quality down until the data is
/// safely under that, before POSTing to /api/v1/me/uploads (the server then
/// re-resizes to its own target).
enum ImageUtil {
    static func jpeg(_ image: UIImage, maxEdge: CGFloat = 1280, maxBytes: Int = 950_000) -> Data {
        let size = image.size
        let longest = max(size.width, size.height)
        let scale = min(1, maxEdge / max(longest, 1))
        let drawn: UIImage
        if scale < 1 {
            let target = CGSize(width: size.width * scale, height: size.height * scale)
            let renderer = UIGraphicsImageRenderer(size: target)
            drawn = renderer.image { _ in image.draw(in: CGRect(origin: .zero, size: target)) }
        } else {
            drawn = image
        }
        var quality: CGFloat = 0.7
        var data = drawn.jpegData(compressionQuality: quality) ?? Data()
        while data.count > maxBytes && quality > 0.3 {
            quality -= 0.1
            data = drawn.jpegData(compressionQuality: quality) ?? data
        }
        return data
    }

    /// Center-crop to a square, then compress under maxBytes. For avatars + dog photos.
    static func squareJPEG(_ image: UIImage, maxEdge: CGFloat = 1000, maxBytes: Int = 950_000) -> Data {
        let side = min(image.size.width, image.size.height)
        let origin = CGPoint(x: (image.size.width - side) / 2, y: (image.size.height - side) / 2)
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: side, height: side))
        let square = renderer.image { _ in
            image.draw(at: CGPoint(x: -origin.x, y: -origin.y))
        }
        return jpeg(square, maxEdge: maxEdge, maxBytes: maxBytes)
    }
}
