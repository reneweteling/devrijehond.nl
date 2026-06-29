package nl.devrijehond.app.data.auth

import android.content.Context
import android.net.Uri
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.NoCredentialException
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.android.libraries.identity.googleid.GoogleIdTokenParsingException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import nl.devrijehond.app.AppGraph
import nl.devrijehond.app.BuildConfig
import nl.devrijehond.app.api.apis.AuthApi
import nl.devrijehond.app.api.infrastructure.Serializer
import nl.devrijehond.app.api.models.MagicLinkRequest
import nl.devrijehond.app.api.models.NativeIdTokenRequest
import nl.devrijehond.app.data.Session
import nl.devrijehond.app.data.network.AuthInterceptor
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import retrofit2.converter.scalars.ScalarsConverterFactory
import java.io.IOException
import java.util.concurrent.TimeUnit

/**
 * Drives the sign-in flows (magic link, Google) and stores the resulting bearer
 * via [Session]. Mirrors the iOS `AuthService` + `APIClient` auth
 * bridge. Bearer-only transport: the OkHttp clients keep no cookie jar, so a
 * BetterAuth Set-Cookie is never replayed (which would trip the CSRF guard).
 *
 * This repository owns its own Retrofit/OkHttp wiring rather than reaching into the
 * shared [nl.devrijehond.app.data.network.ApiModule], because the magic-link verify
 * step needs a client with redirects turned off (BetterAuth surfaces the bearer in
 * the `set-auth-token` header alongside a 302 we must NOT follow).
 */
class AuthRepository(
    private val session: Session = AppGraph.session,
) {

    /** Outcome of a sign-in step. [Cancelled] is the user backing out (show nothing). */
    sealed interface AuthResult {
        data object Success : AuthResult
        data object Cancelled : AuthResult
        data class Error(val message: String) : AuthResult
    }

    private val json = Serializer.kotlinxSerializationJson

    // Shared base client: contract headers via the AuthInterceptor, no cookie jar.
    private val baseClient: OkHttpClient = OkHttpClient.Builder()
        .addInterceptor(AuthInterceptor(session::currentToken))
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build()

    // For magic-link verify only: hold back the 302 so we can read `set-auth-token`.
    private val noRedirectClient: OkHttpClient = baseClient.newBuilder()
        .followRedirects(false)
        .followSslRedirects(false)
        .build()

    private val authApi: AuthApi = Retrofit.Builder()
        .baseUrl(BuildConfig.API_BASE_URL)
        .client(baseClient)
        .addConverterFactory(ScalarsConverterFactory.create())
        .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
        .build()
        .create(AuthApi::class.java)

    // MARK: - Magic link

    /**
     * POST /api/auth/sign-in/magic-link. Returns [AuthResult.Success] when the email
     * was accepted (this does not sign you in; that happens on the verify round trip).
     */
    suspend fun requestMagicLink(email: String): AuthResult = withContext(Dispatchers.IO) {
        try {
            val response = authApi.apiAuthSignInMagicLinkPost(
                MagicLinkRequest(email = email.trim(), callbackURL = MAGIC_LINK_CALLBACK),
            )
            when {
                response.isSuccessful -> AuthResult.Success
                response.code() == 429 ->
                    AuthResult.Error("Te veel pogingen. Probeer het straks opnieuw.")
                else ->
                    AuthResult.Error("Kon de link niet versturen. Probeer het later opnieuw.")
            }
        } catch (e: IOException) {
            AuthResult.Error("Geen verbinding met de server. Controleer je internet en probeer opnieuw.")
        } catch (e: Exception) {
            AuthResult.Error("Kon de link niet versturen. Probeer het later opnieuw.")
        }
    }

    /**
     * Redeems a magic-link token. BetterAuth returns the bearer in the
     * `set-auth-token` response header next to a 302, so we run a no-redirect client
     * and read the header. On success the token is stored via [Session].
     */
    suspend fun verifyMagicLink(token: String): AuthResult = withContext(Dispatchers.IO) {
        try {
            val url = BuildConfig.API_BASE_URL.toHttpUrl().newBuilder()
                .addPathSegments("api/auth/magic-link/verify")
                .addQueryParameter("token", token)
                .build()
            val request = Request.Builder().url(url).get().build()
            noRedirectClient.newCall(request).execute().use { response ->
                // 2xx and 3xx (the redirect we held back) both mean the token redeemed.
                if (response.code !in 200..399) {
                    return@withContext AuthResult.Error(
                        "De link is verlopen of ongeldig. Vraag een nieuwe aan.",
                    )
                }
                val bearer = response.header("set-auth-token")
                    ?: response.header("x-auth-token")
                if (bearer.isNullOrEmpty()) {
                    return@withContext AuthResult.Error("Geen sessie ontvangen. Probeer het opnieuw.")
                }
                // The header path does not surface an expiry; boot-verify refreshes it.
                session.signIn(bearer, null)
                AuthResult.Success
            }
        } catch (e: IOException) {
            AuthResult.Error("Geen verbinding met de server. Controleer je internet en probeer opnieuw.")
        } catch (e: Exception) {
            AuthResult.Error("Kon niet inloggen. Probeer het opnieuw.")
        }
    }

    /**
     * Pulls the magic-link token out of an inbound deep link / App Link. Handles both
     * channels: `vrijehond://verify?token=...` and the https interstitial
     * `https://<host>/verify-mobile?token=...`. Returns null when [uri] is not a
     * magic link. Entry point the orchestrator wires into MainActivity.
     */
    fun extractMagicLinkToken(uri: Uri): String? {
        val scheme = uri.scheme ?: return null
        val isAppScheme = scheme == "vrijehond" && uri.host == "verify"
        val isWebLink = scheme == "https" && uri.path?.endsWith("/verify-mobile") == true
        if (!isAppScheme && !isWebLink) return null
        return uri.getQueryParameter("token")?.takeIf { it.isNotEmpty() }
    }

    /**
     * Convenience for MainActivity: verify an inbound magic-link [uri] in one call.
     * Returns null when the uri is not a magic link (so the caller can ignore it).
     */
    suspend fun handleMagicLinkUri(uri: Uri): AuthResult? {
        val token = extractMagicLinkToken(uri) ?: return null
        return verifyMagicLink(token)
    }

    // MARK: - Google

    /**
     * Google sign-in via Credential Manager. Asks for a Google ID token whose `aud`
     * is the WEB OAuth client id (the server validates against that), then exchanges
     * it at the native bridge for a bearer. Needs an Activity-backed [context] so the
     * account chooser can show. On success the token is stored via [Session].
     */
    suspend fun signInWithGoogle(context: Context): AuthResult {
        val idToken = try {
            val option = GetGoogleIdOption.Builder()
                .setServerClientId(GOOGLE_WEB_CLIENT_ID)
                // Show the chooser, never silently reuse a stale account (mirrors iOS).
                .setFilterByAuthorizedAccounts(false)
                .setAutoSelectEnabled(false)
                .build()
            val request = GetCredentialRequest.Builder()
                .addCredentialOption(option)
                .build()
            val response = CredentialManager.create(context).getCredential(context, request)
            val credential = response.credential
            if (
                credential is CustomCredential &&
                credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL
            ) {
                GoogleIdTokenCredential.createFrom(credential.data).idToken
            } else {
                return AuthResult.Error("Google inloggen mislukt.")
            }
        } catch (e: GetCredentialCancellationException) {
            return AuthResult.Cancelled
        } catch (e: NoCredentialException) {
            // Also fires when the Android OAuth client (SHA-1) is not registered yet.
            return AuthResult.Error("Geen Google-account beschikbaar op dit toestel.")
        } catch (e: GoogleIdTokenParsingException) {
            return AuthResult.Error("Google inloggen mislukt.")
        } catch (e: GetCredentialException) {
            return AuthResult.Error("Google inloggen mislukt.")
        }
        return exchangeIdToken(provider = "google-native", idToken = idToken)
    }

    /** Exchanges a native idToken for a bearer and stores it via [Session]. */
    private suspend fun exchangeIdToken(provider: String, idToken: String): AuthResult =
        withContext(Dispatchers.IO) {
            try {
                val body = NativeIdTokenRequest(idToken = idToken)
                val response = when (provider) {
                    "google-native" -> authApi.apiAuthMobileGoogleNativePost(body)
                    else -> authApi.apiAuthMobileAppleNativePost(body)
                }
                if (response.isSuccessful) {
                    val token = response.body()
                        ?: return@withContext AuthResult.Error("Geen sessie ontvangen.")
                    session.signIn(token.token, token.expiresAt?.toString())
                    AuthResult.Success
                } else {
                    AuthResult.Error("Inloggen mislukt. Probeer het opnieuw.")
                }
            } catch (e: IOException) {
                AuthResult.Error("Geen verbinding met de server. Controleer je internet en probeer opnieuw.")
            } catch (e: Exception) {
                AuthResult.Error("Inloggen mislukt. Probeer het opnieuw.")
            }
        }

    private companion object {
        const val MAGIC_LINK_CALLBACK = "vrijehond://verify"

        // The server validates the Google idToken `aud` against the WEB OAuth client
        // id, so Credential Manager's serverClientId must be this web id (not an
        // Android client id). From mobile-app-spec.md section 2.1.
        //
        // TODO(blocker): an Android OAuth client keyed on the app's signing SHA-1 must
        // also exist in the devrijehond GCP project, or Credential Manager throws
        // NoCredentialException at runtime. That is console config, not a value here.
        const val GOOGLE_WEB_CLIENT_ID =
            "762592672284-cr47iv5jq6d0p2ghvmrcrf1lar90vpiq.apps.googleusercontent.com"
    }
}
