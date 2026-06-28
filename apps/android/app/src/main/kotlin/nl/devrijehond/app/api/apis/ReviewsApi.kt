package nl.devrijehond.app.api.apis

import nl.devrijehond.app.api.infrastructure.CollectionFormats.*
import retrofit2.http.*
import retrofit2.Response
import okhttp3.RequestBody
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

import nl.devrijehond.app.api.models.ApiError
import nl.devrijehond.app.api.models.Review
import nl.devrijehond.app.api.models.ReviewsResponse
import nl.devrijehond.app.api.models.SubmitReviewRequest

interface ReviewsApi {
    /**
     * POST api/v1/me/spots/{id}/reviews
     * Write a review
     * 
     * Responses:
     *  - 201: Created review.
     *  - 400: Validation failed.
     *  - 401: Authentication required.
     *  - 404: Not found.
     *
     * @param id 
     * @param submitReviewRequest  (optional)
     * @return [Review]
     */
    @POST("api/v1/me/spots/{id}/reviews")
    suspend fun apiV1MeSpotsIdReviewsPost(@Path("id") id: kotlin.String, @Body submitReviewRequest: SubmitReviewRequest? = null): Response<Review>

    /**
     * GET api/v1/spots/{slug}/reviews
     * List reviews for a spot
     * 
     * Responses:
     *  - 200: Cursor-paginated reviews.
     *
     * @param slug 
     * @param cursor  (optional)
     * @return [ReviewsResponse]
     */
    @GET("api/v1/spots/{slug}/reviews")
    suspend fun apiV1SpotsSlugReviewsGet(@Path("slug") slug: kotlin.String, @Query("cursor") cursor: kotlin.String? = null): Response<ReviewsResponse>

}
