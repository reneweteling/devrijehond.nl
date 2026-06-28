package nl.devrijehond.app.ui.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import nl.devrijehond.app.AppGraph
import nl.devrijehond.app.api.models.ModeratorApplicationResponseApplication

/**
 * Drives the signed-in ProfileScreen: hydrates the profile, loads the moderator
 * application status for the gating, and deletes the account. The cached profile
 * itself lives on the app-wide Session (observed directly by the screen).
 */
class ProfileViewModel : ViewModel() {

    data class UiState(
        val refreshing: Boolean = false,
        val modApplication: ModeratorApplicationResponseApplication? = null,
        val modLoaded: Boolean = false,
        val deleting: Boolean = false,
        val deleteError: String? = null,
    )

    private val _state = MutableStateFlow(UiState())
    val state: StateFlow<UiState> = _state.asStateFlow()

    fun hydrateIfNeeded() {
        if (!AppGraph.session.isAuthenticated) return
        if (AppGraph.session.profile.value == null) refresh()
        loadModeratorApplication()
    }

    fun refresh() {
        _state.update { it.copy(refreshing = true) }
        viewModelScope.launch {
            ProfileGateway.refresh()
            _state.update { it.copy(refreshing = false) }
            loadModeratorApplication()
        }
    }

    private fun loadModeratorApplication() {
        val me = AppGraph.session.profile.value
        if (me != null && me.isModerator) {
            _state.update { it.copy(modApplication = null, modLoaded = true) }
            return
        }
        viewModelScope.launch {
            val app = try {
                val response = AppGraph.api.moderator.apiV1MeModeratorApplicationGet()
                // The response wraps a possibly-null application; on a null payload the
                // generated (non-null) model fails to decode and we treat it as "none".
                if (response.isSuccessful) response.body()?.application else null
            } catch (e: Exception) {
                null
            }
            _state.update { it.copy(modApplication = app, modLoaded = true) }
        }
    }

    fun deleteAccount(onDeleted: () -> Unit) {
        if (_state.value.deleting) return
        _state.update { it.copy(deleting = true, deleteError = null) }
        viewModelScope.launch {
            try {
                val response = AppGraph.api.me.apiV1MeAccountDelete()
                if (response.isSuccessful) {
                    AppGraph.session.signOut()
                    _state.update { it.copy(deleting = false) }
                    onDeleted()
                } else {
                    _state.update {
                        it.copy(
                            deleting = false,
                            deleteError = "Verwijderen mislukt (status ${response.code()}).",
                        )
                    }
                }
            } catch (e: Exception) {
                _state.update {
                    it.copy(
                        deleting = false,
                        deleteError = "Verwijderen mislukt. Probeer het later opnieuw.",
                    )
                }
            }
        }
    }

    fun dismissDeleteError() {
        _state.update { it.copy(deleteError = null) }
    }
}
