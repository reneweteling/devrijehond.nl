package nl.devrijehond.app.api.apis

import nl.devrijehond.app.api.infrastructure.CollectionFormats.*
import retrofit2.http.*
import retrofit2.Response
import okhttp3.RequestBody
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

import nl.devrijehond.app.api.models.CategoriesResponse
import nl.devrijehond.app.api.models.SpotType

interface CategoriesApi {
    /**
     * GET api/v1/categories
     * List spot categories
     * 
     * Responses:
     *  - 200: All visible categories.
     *
     * @param type Kind of spot. &#x60;REGION&#x60; &#x3D; polygon area (off-leash zone, swim beach). &#x60;POI&#x60; &#x3D; point. (optional)
     * @return [CategoriesResponse]
     */
    @GET("api/v1/categories")
    suspend fun apiV1CategoriesGet(@Query("type") type: SpotType? = null): Response<CategoriesResponse>

}
