package nl.devrijehond.app.api.apis

import nl.devrijehond.app.api.infrastructure.CollectionFormats.*
import retrofit2.http.*
import retrofit2.Response
import okhttp3.RequestBody
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

import nl.devrijehond.app.api.models.AccountDeletionResponse
import nl.devrijehond.app.api.models.ApiError
import nl.devrijehond.app.api.models.MeProfile
import nl.devrijehond.app.api.models.MeProfilePatch

interface MeApi {
    /**
     * DELETE api/v1/me/account
     * Delete my account
     * 
     * Responses:
     *  - 200: Account deleted (or already gone).
     *  - 401: Authentication required.
     *  - 500: Deletion failed.
     *
     * @return [AccountDeletionResponse]
     */
    @DELETE("api/v1/me/account")
    suspend fun apiV1MeAccountDelete(): Response<AccountDeletionResponse>

    /**
     * GET api/v1/me
     * Get my profile
     * 
     * Responses:
     *  - 200: Authenticated user profile.
     *  - 401: Authentication required.
     *
     * @return [MeProfile]
     */
    @GET("api/v1/me")
    suspend fun apiV1MeGet(): Response<MeProfile>

    /**
     * PATCH api/v1/me
     * Update my profile
     * 
     * Responses:
     *  - 200: Updated profile.
     *  - 400: Validation failed.
     *  - 401: Authentication required.
     *  - 404: Not found.
     *
     * @param meProfilePatch  (optional)
     * @return [MeProfile]
     */
    @PATCH("api/v1/me")
    suspend fun apiV1MePatch(@Body meProfilePatch: MeProfilePatch? = null): Response<MeProfile>

}
