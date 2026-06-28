package nl.devrijehond.app.data.network

import okhttp3.Interceptor
import okhttp3.Response

/**
 * Adds the contract headers to every request (X-API-Version: v1, X-Client-Version,
 * Accept) and a Bearer token only for authenticated paths (the /api/v1/me subtree
 * and the BetterAuth bridge under /api/auth) when a token exists. Public reads stay
 * anonymous so they remain CDN-cacheable; never authenticate a public cache key.
 */
class AuthInterceptor(private val tokenProvider: () -> String?) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val original = chain.request()
        val path = original.url.encodedPath

        val builder = original.newBuilder()
            .header("X-API-Version", "v1")
            .header("X-Client-Version", CLIENT_VERSION)
            .header("Accept", "application/json")

        val needsAuth = path.startsWith("/api/v1/me") || path.startsWith("/api/auth")
        if (needsAuth) {
            tokenProvider()?.let { token ->
                builder.header("Authorization", "Bearer $token")
            }
        }

        return chain.proceed(builder.build())
    }

    private companion object {
        const val CLIENT_VERSION = "android-0.1.0"
    }
}
