package nl.devrijehond.app.api.apis

import nl.devrijehond.app.api.infrastructure.CollectionFormats.*
import retrofit2.http.*
import retrofit2.Response
import okhttp3.RequestBody
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

import nl.devrijehond.app.api.models.ApiError
import nl.devrijehond.app.api.models.MeSpotsResponse
import nl.devrijehond.app.api.models.ModerateSpotRequest
import nl.devrijehond.app.api.models.OkResponse
import nl.devrijehond.app.api.models.SpotDetail
import nl.devrijehond.app.api.models.SpotType
import nl.devrijehond.app.api.models.SpotsMapResponse
import nl.devrijehond.app.api.models.SpotsResponse
import nl.devrijehond.app.api.models.SubmitSpotRequest
import nl.devrijehond.app.api.models.SubmitSpotResponse
import nl.devrijehond.app.api.models.UpdateSpotRequest

interface SpotsApi {
    /**
     * GET api/v1/me/spots
     * List my submitted spots
     * 
     * Responses:
     *  - 200: My spots across all statuses, newest first.
     *  - 401: Authentication required.
     *
     * @return [MeSpotsResponse]
     */
    @GET("api/v1/me/spots")
    suspend fun apiV1MeSpotsGet(): Response<MeSpotsResponse>

    /**
     * PATCH api/v1/me/spots/{id}/moderate
     * Set spot status (staff only)
     * 
     * Responses:
     *  - 200: Status updated.
     *  - 400: Validation failed.
     *  - 401: Authentication required.
     *  - 403: Staff role required.
     *  - 404: Not found.
     *
     * @param id 
     * @param moderateSpotRequest  (optional)
     * @return [OkResponse]
     */
    @PATCH("api/v1/me/spots/{id}/moderate")
    suspend fun apiV1MeSpotsIdModeratePatch(@Path("id") id: kotlin.String, @Body moderateSpotRequest: ModerateSpotRequest? = null): Response<OkResponse>

    /**
     * PATCH api/v1/me/spots/{id}
     * Edit my unverified spot
     * 
     * Responses:
     *  - 200: Updated spot.
     *  - 400: Validation failed.
     *  - 401: Authentication required.
     *  - 404: Not found.
     *
     * @param id 
     * @param updateSpotRequest  (optional)
     * @return [SubmitSpotResponse]
     */
    @PATCH("api/v1/me/spots/{id}")
    suspend fun apiV1MeSpotsIdPatch(@Path("id") id: kotlin.String, @Body updateSpotRequest: UpdateSpotRequest? = null): Response<SubmitSpotResponse>

    /**
     * POST api/v1/me/spots
     * Submit a new spot
     * 
     * Responses:
     *  - 201: Created spot (UNVERIFIED).
     *  - 400: Validation failed.
     *  - 401: Authentication required.
     *  - 404: Not found.
     *
     * @param submitSpotRequest  (optional)
     * @return [SubmitSpotResponse]
     */
    @POST("api/v1/me/spots")
    suspend fun apiV1MeSpotsPost(@Body submitSpotRequest: SubmitSpotRequest? = null): Response<SubmitSpotResponse>

    /**
     * GET api/v1/spots
     * List spots (paginated, delta-sync)
     * 
     * Responses:
     *  - 200: Cursor-paginated spots.
     *
     * @param type Kind of spot. &#x60;REGION&#x60; &#x3D; polygon area (off-leash zone, swim beach). &#x60;POI&#x60; &#x3D; point. (optional)
     * @param categoryId RFC 4122 UUID (v4). (optional)
     * @param cursor  (optional)
     * @param since Delta-sync cursor, return only spots changed at/after this timestamp. (optional)
     * @param nearLat  (optional)
     * @param nearLng  (optional)
     * @param limit  (optional, default to 50)
     * @return [SpotsResponse]
     */
    @GET("api/v1/spots")
    suspend fun apiV1SpotsGet(@Query("type") type: SpotType? = null, @Query("categoryId") categoryId: java.util.UUID? = null, @Query("cursor") cursor: kotlin.String? = null, @Query("since") since: java.time.OffsetDateTime? = null, @Query("nearLat") nearLat: java.math.BigDecimal? = null, @Query("nearLng") nearLng: java.math.BigDecimal? = null, @Query("limit") limit: kotlin.Int? = 50): Response<SpotsResponse>

    /**
     * GET api/v1/spots/map
     * Spots within a map viewport (bbox)
     * 
     * Responses:
     *  - 200: Spots intersecting the viewport.
     *
     * @param minLng West edge of the viewport.
     * @param minLat South edge of the viewport.
     * @param maxLng East edge of the viewport.
     * @param maxLat North edge of the viewport.
     * @param since Return only spots changed at or after this timestamp (delta refresh). (optional)
     * @param type Kind of spot. &#x60;REGION&#x60; &#x3D; polygon area (off-leash zone, swim beach). &#x60;POI&#x60; &#x3D; point. (optional)
     * @param categoryId RFC 4122 UUID (v4). (optional)
     * @param cluster When true, collapse dense viewport grid cells into &#x60;clusters&#x60; (count bubbles) and return only lone spots in &#x60;items&#x60;, keeping the payload bounded. When false/omitted, every spot is returned in &#x60;items&#x60;. (optional)
     * @return [SpotsMapResponse]
     */
    @GET("api/v1/spots/map")
    suspend fun apiV1SpotsMapGet(@Query("minLng") minLng: java.math.BigDecimal, @Query("minLat") minLat: java.math.BigDecimal, @Query("maxLng") maxLng: java.math.BigDecimal, @Query("maxLat") maxLat: java.math.BigDecimal, @Query("since") since: java.time.OffsetDateTime? = null, @Query("type") type: SpotType? = null, @Query("categoryId") categoryId: java.util.UUID? = null, @Query("cluster") cluster: kotlin.Boolean? = null): Response<SpotsMapResponse>

    /**
     * GET api/v1/spots/{slug}
     * Spot detail
     * 
     * Responses:
     *  - 200: Full spot detail.
     *  - 404: Not found.
     *
     * @param slug 
     * @return [SpotDetail]
     */
    @GET("api/v1/spots/{slug}")
    suspend fun apiV1SpotsSlugGet(@Path("slug") slug: kotlin.String): Response<SpotDetail>

}
