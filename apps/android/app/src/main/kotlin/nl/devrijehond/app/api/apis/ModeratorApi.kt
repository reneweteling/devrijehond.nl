package nl.devrijehond.app.api.apis

import nl.devrijehond.app.api.infrastructure.CollectionFormats.*
import retrofit2.http.*
import retrofit2.Response
import okhttp3.RequestBody
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

import nl.devrijehond.app.api.models.ApiError
import nl.devrijehond.app.api.models.ApplyModeratorRequest
import nl.devrijehond.app.api.models.ModeratorApplication
import nl.devrijehond.app.api.models.ModeratorApplicationResponse

interface ModeratorApi {
    /**
     * GET api/v1/me/moderator-application
     * Get my moderator application
     * 
     * Responses:
     *  - 200: My application, or null if none.
     *  - 401: Authentication required.
     *
     * @return [ModeratorApplicationResponse]
     */
    @GET("api/v1/me/moderator-application")
    suspend fun apiV1MeModeratorApplicationGet(): Response<ModeratorApplicationResponse>

    /**
     * POST api/v1/me/moderator-application
     * Apply to become a moderator
     * 
     * Responses:
     *  - 201: Application filed.
     *  - 400: Validation failed.
     *  - 401: Authentication required.
     *  - 404: Not found.
     *  - 409: An application already exists.
     *
     * @param applyModeratorRequest  (optional)
     * @return [ModeratorApplication]
     */
    @POST("api/v1/me/moderator-application")
    suspend fun apiV1MeModeratorApplicationPost(@Body applyModeratorRequest: ApplyModeratorRequest? = null): Response<ModeratorApplication>

}
