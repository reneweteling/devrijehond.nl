package nl.devrijehond.app.api.apis

import nl.devrijehond.app.api.infrastructure.CollectionFormats.*
import retrofit2.http.*
import retrofit2.Response
import okhttp3.RequestBody
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

import nl.devrijehond.app.api.models.AmenitiesResponse

interface AmenitiesApi {
    /**
     * GET api/v1/amenities
     * List amenities
     * 
     * Responses:
     *  - 200: All visible amenities.
     *
     * @param categoryId  (optional)
     * @return [AmenitiesResponse]
     */
    @GET("api/v1/amenities")
    suspend fun apiV1AmenitiesGet(@Query("categoryId") categoryId: java.util.UUID? = null): Response<AmenitiesResponse>

}
