package nl.devrijehond.app.ui.wensen

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import nl.devrijehond.app.AppGraph
import nl.devrijehond.app.api.models.CreateFeatureRequest
import nl.devrijehond.app.api.models.FeatureRequest
import nl.devrijehond.app.api.models.FeatureStatus

/**
 * Drives the Wensen tab: lists community feature requests, toggles upvotes and
 * creates new ones. Mirrors the iOS WensenScreen. Reads go through the public
 * feature-requests endpoint; voting + creating require a bearer token.
 */
class WensenViewModel : ViewModel() {

    data class UiState(
        val requests: List<FeatureRequest> = emptyList(),
        val filter: FeatureStatus? = null,   // null = "Populair" (all)
        val loading: Boolean = false,
        val error: String? = null,
        val votingIds: Set<String> = emptySet(),
    )

    private val _state = MutableStateFlow(UiState())
    val state: StateFlow<UiState> = _state.asStateFlow()

    init {
        load()
    }

    fun selectFilter(status: FeatureStatus?) {
        if (_state.value.filter == status && _state.value.requests.isNotEmpty()) return
        _state.update { it.copy(filter = status) }
        load()
    }

    fun load() {
        val status = _state.value.filter
        _state.update { it.copy(loading = true) }
        viewModelScope.launch {
            try {
                val response = AppGraph.api.featureRequests.apiV1FeatureRequestsGet(status = status)
                if (response.isSuccessful) {
                    _state.update {
                        it.copy(
                            requests = response.body()?.items.orEmpty(),
                            loading = false,
                            error = null,
                        )
                    }
                } else {
                    _state.update {
                        it.copy(
                            loading = false,
                            error = if (it.requests.isEmpty()) {
                                "Server gaf status ${response.code()}."
                            } else {
                                it.error
                            },
                        )
                    }
                }
            } catch (e: Exception) {
                _state.update {
                    it.copy(
                        loading = false,
                        error = if (it.requests.isEmpty()) {
                            "Er is iets misgegaan. Probeer het opnieuw."
                        } else {
                            it.error
                        },
                    )
                }
            }
        }
    }

    fun toggleVote(request: FeatureRequest) {
        val id = request.id.toString()
        if (_state.value.votingIds.contains(id)) return
        _state.update { it.copy(votingIds = it.votingIds + id) }
        viewModelScope.launch {
            try {
                val response = AppGraph.api.featureRequests.apiV1MeFeatureRequestsIdVotePost(id)
                val body = response.body()
                if (response.isSuccessful && body != null) {
                    _state.update { s ->
                        s.copy(
                            requests = s.requests.map {
                                if (it.id == request.id) {
                                    it.copy(
                                        upvoteCount = body.upvoteCount,
                                        viewerHasVoted = body.viewerHasVoted,
                                    )
                                } else {
                                    it
                                }
                            },
                        )
                    }
                }
            } catch (e: Exception) {
                // Leave the row unchanged on failure; the next load reconciles.
            } finally {
                _state.update { it.copy(votingIds = it.votingIds - id) }
            }
        }
    }

    /** Creates a request and prepends it on success. Invokes [onResult] with an error or null. */
    fun create(
        title: String,
        body: String?,
        component: String?,
        onResult: (error: String?) -> Unit,
    ) {
        viewModelScope.launch {
            try {
                val response = AppGraph.api.featureRequests.apiV1MeFeatureRequestsPost(
                    CreateFeatureRequest(
                        title = title.trim(),
                        body = body?.trim()?.ifBlank { null },
                        component = component?.trim()?.ifBlank { null },
                    ),
                )
                val created = response.body()
                if (response.isSuccessful && created != null) {
                    _state.update { it.copy(requests = listOf(created) + it.requests) }
                    onResult(null)
                } else {
                    onResult("Indienen mislukt (status ${response.code()}).")
                }
            } catch (e: Exception) {
                onResult("Indienen mislukt. Probeer het opnieuw.")
            }
        }
    }
}
