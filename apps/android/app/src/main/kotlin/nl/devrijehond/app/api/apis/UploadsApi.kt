package nl.devrijehond.app.api.apis

import nl.devrijehond.app.api.infrastructure.CollectionFormats.*
import retrofit2.http.*
import retrofit2.Response
import okhttp3.RequestBody
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

import nl.devrijehond.app.api.models.ApiError
import nl.devrijehond.app.api.models.UploadResponse

import okhttp3.MultipartBody

interface UploadsApi {
    /**
     * POST api/v1/me/uploads
     * Upload an image
     * Multipart upload (&#x60;multipart/form-data&#x60;, field &#x60;file&#x60;). The image is resized + JPEG-compressed server-side and stored on S3; the response carries the public URL + key.
     * Responses:
     *  - 200: The stored image.
     *  - 400: Validation failed.
     *  - 401: Authentication required.
     *  - 404: Not found.
     *
     * @param file 
     * @return [UploadResponse]
     */
    @Multipart
    @POST("api/v1/me/uploads")
    suspend fun apiV1MeUploadsPost(@Part file: MultipartBody.Part): Response<UploadResponse>

}
