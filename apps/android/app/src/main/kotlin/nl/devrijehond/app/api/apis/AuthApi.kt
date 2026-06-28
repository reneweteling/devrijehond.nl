package nl.devrijehond.app.api.apis

import nl.devrijehond.app.api.infrastructure.CollectionFormats.*
import retrofit2.http.*
import retrofit2.Response
import okhttp3.RequestBody
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

import nl.devrijehond.app.api.models.ApiError
import nl.devrijehond.app.api.models.AuthToken
import nl.devrijehond.app.api.models.MagicLinkRequest
import nl.devrijehond.app.api.models.NativeIdTokenRequest

interface AuthApi {
    /**
     * GET api/auth/magic-link/verify
     * Redeem a magic-link token
     * Redeems the token from the magic-link email. BetterAuth returns the bearer in the &#x60;set-auth-token&#x60; response header (alongside a redirect), so native clients must NOT follow the redirect. The body shape below mirrors the token surfaced to the client.
     * Responses:
     *  - 200: Token redeemed; bearer in `set-auth-token` header.
     *  - 302: Redirect to the callback (header carries the bearer).
     *  - 401: Invalid or expired token.
     *
     * @param token 
     * @return [AuthToken]
     */
    @GET("api/auth/magic-link/verify")
    suspend fun apiAuthMagicLinkVerifyGet(@Query("token") token: kotlin.String): Response<AuthToken>

    /**
     * POST api/auth/mobile/apple-native
     * Exchange a native Apple idToken for a bearer
     * 
     * Responses:
     *  - 200: Bearer session token.
     *  - 400: Invalid body.
     *  - 401: Sign-in failed.
     *
     * @param nativeIdTokenRequest  (optional)
     * @return [AuthToken]
     */
    @POST("api/auth/mobile/apple-native")
    suspend fun apiAuthMobileAppleNativePost(@Body nativeIdTokenRequest: NativeIdTokenRequest? = null): Response<AuthToken>

    /**
     * POST api/auth/mobile/google-native
     * Exchange a native Google idToken for a bearer
     * 
     * Responses:
     *  - 200: Bearer session token.
     *  - 400: Invalid body.
     *  - 401: Sign-in failed.
     *
     * @param nativeIdTokenRequest  (optional)
     * @return [AuthToken]
     */
    @POST("api/auth/mobile/google-native")
    suspend fun apiAuthMobileGoogleNativePost(@Body nativeIdTokenRequest: NativeIdTokenRequest? = null): Response<AuthToken>

    /**
     * POST api/auth/sign-in/magic-link
     * Request a magic-link email
     * 
     * Responses:
     *  - 200: Magic-link email sent (if the address exists).
     *  - 400: Invalid body.
     *
     * @param magicLinkRequest  (optional)
     * @return [Unit]
     */
    @POST("api/auth/sign-in/magic-link")
    suspend fun apiAuthSignInMagicLinkPost(@Body magicLinkRequest: MagicLinkRequest? = null): Response<Unit>

}
