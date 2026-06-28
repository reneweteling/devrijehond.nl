package nl.devrijehond.app.ui.profile

import nl.devrijehond.app.AppGraph
import nl.devrijehond.app.api.models.MeProfile
import nl.devrijehond.app.api.models.UserRole

/**
 * Small data helper shared by the Profiel sub-screens. Loads `GET /api/v1/me` and
 * pushes the result into the app-wide [nl.devrijehond.app.data.Session] so the
 * cached `profile` StateFlow updates everywhere (header, dogs, gating). Mirrors the
 * iOS `Session.hydrate()`.
 */
object ProfileGateway {

    /** Re-fetch the profile and update the session cache. Returns it, or null on failure. */
    suspend fun refresh(): MeProfile? = try {
        val response = AppGraph.api.me.apiV1MeGet()
        if (response.isSuccessful) {
            response.body()?.also { AppGraph.session.setProfile(it) }
        } else {
            null
        }
    } catch (e: Exception) {
        null
    }
}

val MeProfile.isModerator: Boolean
    get() = role == UserRole.MODERATOR || role == UserRole.ADMIN

val MeProfile.isAdmin: Boolean
    get() = role == UserRole.ADMIN

/** A moderator application only unlocks once people can recognise you: photo + name. */
fun MeProfile.isComplete(): Boolean {
    val hasPhoto = !(image?.toString().isNullOrBlank())
    val hasName = !(name?.trim().isNullOrEmpty())
    return hasPhoto && hasName
}
