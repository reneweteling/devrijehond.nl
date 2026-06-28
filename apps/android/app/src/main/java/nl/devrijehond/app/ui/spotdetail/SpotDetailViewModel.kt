package nl.devrijehond.app.ui.spotdetail

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import nl.devrijehond.app.AppGraph
import nl.devrijehond.app.api.models.GeoPoint
import nl.devrijehond.app.api.models.ModerateSpotRequest
import nl.devrijehond.app.api.models.Review
import nl.devrijehond.app.api.models.SpotDetail
import nl.devrijehond.app.api.models.SpotStatus
import nl.devrijehond.app.api.models.SubmitReportRequest
import nl.devrijehond.app.api.models.SubmitReviewRequest
import nl.devrijehond.app.api.models.SubmitVoteRequest
import nl.devrijehond.app.api.models.ReportReason
import nl.devrijehond.app.api.models.ReportTarget
import nl.devrijehond.app.api.models.VoteResponse
import nl.devrijehond.app.api.models.VoteValue

/**
 * Drives SpotDetailScreen. Loads the full detail + reviews for a slug, then
 * handles the authed actions (vote, moderate, review, report). After a vote or
 * moderation the spot status can flip, so the screen calls back into its
 * `onChanged` lambda to let the presenter (map / list) refresh too.
 *
 * Mirrors the iOS SpotDetailView state machine: an optional `voteResult` and
 * `moderatedStatus` override the loaded `detail.status` for the live UI.
 */
class SpotDetailViewModel : ViewModel() {

    data class UiState(
        val loading: Boolean = true,
        val detail: SpotDetail? = null,
        val reviews: List<Review> = emptyList(),
        val error: String? = null,
        val voteResult: VoteResponse? = null,
        val voting: Boolean = false,
        val voteError: String? = null,
        val moderatedStatus: String? = null,
        val moderating: Boolean = false,
        val moderationMessage: String? = null,
    ) {
        /** Live status: a vote / moderation result wins over the loaded value. */
        val effectiveStatus: String
            get() = voteResult?.status
                ?: moderatedStatus
                ?: detail?.status?.value
                ?: SpotStatus.UNVERIFIED.value
    }

    private val _state = MutableStateFlow(UiState())
    val state: StateFlow<UiState> = _state.asStateFlow()

    private var slug: String? = null
    private var started = false

    /** Idempotent first load (safe to call from a LaunchedEffect). */
    fun start(slug: String) {
        if (started) return
        started = true
        this.slug = slug
        load()
    }

    fun load() {
        val slug = slug ?: return
        _state.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            try {
                val detailResp = AppGraph.api.spots.apiV1SpotsSlugGet(slug)
                if (detailResp.isSuccessful) {
                    _state.update { it.copy(loading = false, detail = detailResp.body()) }
                } else {
                    _state.update {
                        it.copy(loading = false, error = "Server gaf status ${detailResp.code()}.")
                    }
                }
            } catch (e: Exception) {
                _state.update { it.copy(loading = false, error = e.message ?: "Geen verbinding.") }
            }
            loadReviews()
        }
    }

    /** Re-fetch only the detail, keeping the screen mounted (after an edit). */
    fun refreshDetail() {
        val slug = slug ?: return
        viewModelScope.launch {
            try {
                val resp = AppGraph.api.spots.apiV1SpotsSlugGet(slug)
                if (resp.isSuccessful) {
                    _state.update { it.copy(detail = resp.body(), voteResult = null, moderatedStatus = null) }
                }
            } catch (_: Exception) {
                // best-effort refresh; keep showing what we have
            }
            loadReviews()
        }
    }

    private fun loadReviews() {
        val slug = slug ?: return
        viewModelScope.launch {
            try {
                val resp = AppGraph.api.reviews.apiV1SpotsSlugReviewsGet(slug)
                if (resp.isSuccessful) {
                    _state.update { it.copy(reviews = resp.body()?.items.orEmpty()) }
                }
            } catch (_: Exception) {
                // reviews are non-critical; leave the list as-is
            }
        }
    }

    /** Cast a verification vote. `proof` is best-effort device location. */
    fun vote(value: VoteValue, proof: GeoPoint?, onChanged: () -> Unit) {
        val id = _state.value.detail?.id?.toString() ?: return
        _state.update { it.copy(voting = true, voteError = null) }
        viewModelScope.launch {
            try {
                val resp = AppGraph.api.votes.apiV1MeSpotsIdVotePost(
                    id = id,
                    submitVoteRequest = SubmitVoteRequest(value = value, proof = proof),
                )
                if (resp.isSuccessful) {
                    _state.update { it.copy(voting = false, voteResult = resp.body()) }
                    onChanged()
                } else {
                    handleAuth(resp.code())
                    _state.update {
                        it.copy(
                            voting = false,
                            voteError = when (resp.code()) {
                                401 -> "Je sessie is verlopen. Log opnieuw in."
                                400 -> "Je kunt niet op je eigen plek stemmen."
                                else -> "Stemmen mislukt (${resp.code()})."
                            },
                        )
                    }
                }
            } catch (e: Exception) {
                _state.update { it.copy(voting = false, voteError = "Stemmen mislukt. Probeer het opnieuw.") }
            }
        }
    }

    /** Staff-only status change. */
    fun moderate(status: SpotStatus, onChanged: () -> Unit) {
        val id = _state.value.detail?.id?.toString() ?: return
        _state.update { it.copy(moderating = true, moderationMessage = null) }
        viewModelScope.launch {
            try {
                val resp = AppGraph.api.spots.apiV1MeSpotsIdModeratePatch(
                    id = id,
                    moderateSpotRequest = ModerateSpotRequest(status = status),
                )
                if (resp.isSuccessful) {
                    _state.update {
                        it.copy(
                            moderating = false,
                            moderatedStatus = status.value,
                            moderationMessage = moderationLabel(status),
                        )
                    }
                    onChanged()
                } else {
                    handleAuth(resp.code())
                    _state.update {
                        it.copy(moderating = false, moderationMessage = "Actie mislukt (${resp.code()}).")
                    }
                }
            } catch (e: Exception) {
                _state.update { it.copy(moderating = false, moderationMessage = "Actie mislukt. Probeer het opnieuw.") }
            }
        }
    }

    /** Write a review, then reload the list. Reports success/failure via callback. */
    fun submitReview(stars: Int, body: String?, onResult: (Boolean, String?) -> Unit) {
        val id = _state.value.detail?.id?.toString() ?: return
        viewModelScope.launch {
            try {
                val resp = AppGraph.api.reviews.apiV1MeSpotsIdReviewsPost(
                    id = id,
                    submitReviewRequest = SubmitReviewRequest(stars = stars, body = body),
                )
                if (resp.isSuccessful) {
                    loadReviews()
                    onResult(true, null)
                } else {
                    handleAuth(resp.code())
                    onResult(false, "Versturen mislukt (${resp.code()}).")
                }
            } catch (e: Exception) {
                onResult(false, "Versturen mislukt. Probeer het opnieuw.")
            }
        }
    }

    fun submitReport(reason: ReportReason, note: String?, onResult: (Boolean, String?) -> Unit) {
        val targetId = _state.value.detail?.id ?: return
        viewModelScope.launch {
            try {
                val resp = AppGraph.api.reports.apiV1MeReportsPost(
                    submitReportRequest = SubmitReportRequest(
                        targetType = ReportTarget.SPOT,
                        targetId = targetId,
                        reason = reason,
                        note = note,
                    ),
                )
                if (resp.isSuccessful) {
                    onResult(true, null)
                } else {
                    handleAuth(resp.code())
                    onResult(false, "Melden mislukt (${resp.code()}).")
                }
            } catch (e: Exception) {
                onResult(false, "Melden mislukt. Probeer het opnieuw.")
            }
        }
    }

    private fun handleAuth(code: Int) {
        if (code == 401) AppGraph.session.signOut()
    }

    private fun moderationLabel(status: SpotStatus): String = when (status) {
        SpotStatus.VERIFIED -> "Plek geverifieerd."
        SpotStatus.UNVERIFIED -> "Plek teruggezet naar onbevestigd."
        SpotStatus.HIDDEN -> "Plek verborgen."
        SpotStatus.REMOVED -> "Plek verwijderd."
    }
}
