package nl.devrijehond.app.ui.profile

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import android.net.Uri
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.ByteArrayOutputStream
import kotlin.math.min

/**
 * Turns a picked gallery [Uri] into a square, downscaled JPEG multipart part for
 * `POST /api/v1/me/uploads`. This is the lightweight "crop" used for avatars: a
 * centre-crop to square plus a downscale, matching iOS `ImageUtil.squareJPEG`. No
 * interactive crop UI and no external dependency; the server resizes again anyway.
 */
object ImageUpload {

    private const val MAX_EDGE = 1024
    private const val JPEG_QUALITY = 85

    suspend fun squareJpegPart(context: Context, uri: Uri): MultipartBody.Part =
        withContext(Dispatchers.IO) {
            val bitmap = decodeOriented(context, uri)
                ?: error("Kon de afbeelding niet lezen.")
            val square = centerCropSquare(bitmap)
            val scaled = if (square.width > MAX_EDGE) {
                Bitmap.createScaledBitmap(square, MAX_EDGE, MAX_EDGE, true)
            } else {
                square
            }
            val out = ByteArrayOutputStream()
            scaled.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, out)
            val bytes = out.toByteArray()
            val body = bytes.toRequestBody("image/jpeg".toMediaType(), 0, bytes.size)
            MultipartBody.Part.createFormData("file", "upload.jpg", body)
        }

    private fun decodeOriented(context: Context, uri: Uri): Bitmap? {
        val bitmap = context.contentResolver.openInputStream(uri).use { input ->
            BitmapFactory.decodeStream(input)
        } ?: return null
        val rotation = context.contentResolver.openInputStream(uri).use { input ->
            if (input == null) 0 else exifRotation(ExifInterface(input))
        }
        if (rotation == 0) return bitmap
        val matrix = Matrix().apply { postRotate(rotation.toFloat()) }
        return Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
    }

    private fun exifRotation(exif: ExifInterface): Int =
        when (exif.getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)) {
            ExifInterface.ORIENTATION_ROTATE_90 -> 90
            ExifInterface.ORIENTATION_ROTATE_180 -> 180
            ExifInterface.ORIENTATION_ROTATE_270 -> 270
            else -> 0
        }

    private fun centerCropSquare(src: Bitmap): Bitmap {
        val edge = min(src.width, src.height)
        val x = (src.width - edge) / 2
        val y = (src.height - edge) / 2
        return Bitmap.createBitmap(src, x, y, edge, edge)
    }
}
