package nl.devrijehond.app.api.apis

import nl.devrijehond.app.api.infrastructure.CollectionFormats.*
import retrofit2.http.*
import retrofit2.Response
import okhttp3.RequestBody
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

import nl.devrijehond.app.api.models.ApiError
import nl.devrijehond.app.api.models.CreateFeatureRequest
import nl.devrijehond.app.api.models.FeatureRequest
import nl.devrijehond.app.api.models.FeatureRequestsResponse
import nl.devrijehond.app.api.models.FeatureStatus
import nl.devrijehond.app.api.models.FeatureVoteResponse

interface FeatureRequestsApi {
    /**
     * GET api/v1/feature-requests
     * List community feature requests
     * 
     * Responses:
     *  - 200: Cursor-paginated feature requests.
     *
     * @param status Product-roadmap state of a community feature request. (optional)
     * @return [FeatureRequestsResponse]
     */
    @GET("api/v1/feature-requests")
    suspend fun apiV1FeatureRequestsGet(@Query("status") status: FeatureStatus? = null): Response<FeatureRequestsResponse>

    /**
     * POST api/v1/me/feature-requests/{id}/vote
     * Toggle an upvote on a feature request
     * 
     * Responses:
     *  - 200: Upvote toggled.
     *  - 400: Validation failed.
     *  - 401: Authentication required.
     *  - 404: Not found.
     *
     * @param id 
     * @return [FeatureVoteResponse]
     */
    @POST("api/v1/me/feature-requests/{id}/vote")
    suspend fun apiV1MeFeatureRequestsIdVotePost(@Path("id") id: kotlin.String): Response<FeatureVoteResponse>

    /**
     * POST api/v1/me/feature-requests
     * Create a feature request
     * 
     * Responses:
     *  - 201: Created feature request.
     *  - 400: Validation failed.
     *  - 401: Authentication required.
     *  - 404: Not found.
     *
     * @param createFeatureRequest  (optional)
     * @return [FeatureRequest]
     */
    @POST("api/v1/me/feature-requests")
    suspend fun apiV1MeFeatureRequestsPost(@Body createFeatureRequest: CreateFeatureRequest? = null): Response<FeatureRequest>

}
