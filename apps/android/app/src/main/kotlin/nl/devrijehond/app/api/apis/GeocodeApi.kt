package nl.devrijehond.app.api.apis

import nl.devrijehond.app.api.infrastructure.CollectionFormats.*
import retrofit2.http.*
import retrofit2.Response
import okhttp3.RequestBody
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

import nl.devrijehond.app.api.models.ApiError
import nl.devrijehond.app.api.models.GeocodeResponse

interface GeocodeApi {
    /**
     * GET api/v1/geocode
     * Forward geocoding (place/address search)
     * 
     * Responses:
     *  - 200: Ranked geocoding results (NL-biased).
     *  - 502: Geocoding provider unavailable.
     *
     * @param q Free-text place / street / address query (min 2 chars).
     * @return [GeocodeResponse]
     */
    @GET("api/v1/geocode")
    suspend fun apiV1GeocodeGet(@Query("q") q: kotlin.String): Response<GeocodeResponse>

}
