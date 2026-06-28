package nl.devrijehond.app.api.apis

import nl.devrijehond.app.api.infrastructure.CollectionFormats.*
import retrofit2.http.*
import retrofit2.Response
import okhttp3.RequestBody
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

import nl.devrijehond.app.api.models.ApiError
import nl.devrijehond.app.api.models.SubmitVoteRequest
import nl.devrijehond.app.api.models.VoteResponse

interface VotesApi {
    /**
     * POST api/v1/me/spots/{id}/vote
     * Cast a verification vote
     * 
     * Responses:
     *  - 200: Vote recorded; spot tally recomputed.
     *  - 400: Validation failed.
     *  - 401: Authentication required.
     *  - 404: Not found.
     *
     * @param id 
     * @param submitVoteRequest  (optional)
     * @return [VoteResponse]
     */
    @POST("api/v1/me/spots/{id}/vote")
    suspend fun apiV1MeSpotsIdVotePost(@Path("id") id: kotlin.String, @Body submitVoteRequest: SubmitVoteRequest? = null): Response<VoteResponse>

}
