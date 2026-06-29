package nl.devrijehond.app.ui.nearby

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.android.gms.maps.model.LatLng
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull
import nl.devrijehond.app.AppGraph
import nl.devrijehond.app.api.models.Category
import nl.devrijehond.app.api.models.SpotSummary
import nl.devrijehond.app.ui.location.DeviceLocation
import java.math.BigDecimal
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * Drives the Nabij tab: resolves the device location (best-effort), then asks the API
 * for spots ordered by distance via the nearLat/nearLng query. Holds the origin so the
 * UI can render a per-row distance.
 */
class NearbyViewModel : ViewModel() {

    data class State(
        val loading: Boolean = false,
        val error: String? = null,
        val items: List<SpotSummary> = emptyList(),
    )

    private val _state = MutableStateFlow(State())
    val state: StateFlow<State> = _state.asStateFlow()

    // categoryId -> Category, for per-row colour + glyph (matches the iOS SpotRow).
    private val _categoriesById = MutableStateFlow<Map<String, Category>>(emptyMap())
    val categoriesById: StateFlow<Map<String, Category>> = _categoriesById.asStateFlow()

    // Default centre (Amsterdam) when there is no location fix yet.
    private var origin: LatLng = LatLng(52.3676, 4.9041)

    init {
        viewModelScope.launch {
            try {
                val resp = AppGraph.api.categories.apiV1CategoriesGet(type = null)
                if (resp.isSuccessful) {
                    _categoriesById.value = resp.body()?.items.orEmpty().associateBy { it.id.toString() }
                }
            } catch (_: Exception) {
                // Non-fatal: rows fall back to the default tint + paw glyph.
            }
        }
    }

    fun load(context: Context) {
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null)
            try {
                // Cap the location lookup: the fused provider can hang indefinitely on a
                // device with no fix (e.g. a fresh emulator). Fall back to the default origin.
                withTimeoutOrNull(4000) { DeviceLocation.current(context) }?.let { origin = it }
            } catch (_: Exception) {
                // Keep the default origin.
            }
            try {
                val resp = AppGraph.api.spots.apiV1SpotsGet(
                    nearLat = BigDecimal.valueOf(origin.latitude),
                    nearLng = BigDecimal.valueOf(origin.longitude),
                    limit = 50,
                )
                if (resp.isSuccessful) {
                    _state.value = State(loading = false, items = resp.body()?.items.orEmpty())
                } else {
                    _state.value = _state.value.copy(
                        loading = false,
                        error = "Kon plekken niet laden (${resp.code()}).",
                    )
                }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    loading = false,
                    error = e.message ?: "Geen verbinding.",
                )
            }
        }
    }

    /** Great-circle distance from the current origin to the spot, in metres. */
    fun distanceMeters(spot: SpotSummary): Double? {
        val lat = spot.lat?.toDouble() ?: return null
        val lng = spot.lng?.toDouble() ?: return null
        val r = 6_371_000.0
        val dLat = Math.toRadians(lat - origin.latitude)
        val dLng = Math.toRadians(lng - origin.longitude)
        val a = sin(dLat / 2) * sin(dLat / 2) +
            cos(Math.toRadians(origin.latitude)) * cos(Math.toRadians(lat)) *
            sin(dLng / 2) * sin(dLng / 2)
        return r * 2 * atan2(sqrt(a), sqrt(1 - a))
    }
}
