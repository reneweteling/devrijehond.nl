package nl.devrijehond.app.data

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import nl.devrijehond.app.api.models.MeProfile
import nl.devrijehond.app.data.auth.TokenStore

/**
 * Holds the signed-in bearer token (persisted via TokenStore) and the cached
 * profile, exposed as StateFlows. Mirrors the iOS `Session`. Anonymous until a
 * token is set. A 401 on an authed call drops back to anonymous.
 */
class Session(private val tokens: TokenStore) {

    private val _token = MutableStateFlow(tokens.token)
    val token: StateFlow<String?> = _token.asStateFlow()

    private val _profile = MutableStateFlow<MeProfile?>(null)
    val profile: StateFlow<MeProfile?> = _profile.asStateFlow()

    val isAuthenticated: Boolean get() = _token.value != null

    /** Read by the OkHttp auth interceptor on every request. */
    fun currentToken(): String? = _token.value

    fun signIn(token: String, expiresAt: String?) {
        tokens.token = token
        tokens.expiresAt = expiresAt
        _token.value = token
    }

    fun setProfile(profile: MeProfile?) {
        _profile.value = profile
    }

    fun signOut() {
        tokens.clear()
        _token.value = null
        _profile.value = null
    }
}
