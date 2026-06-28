package nl.devrijehond.app.ui.map

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.launch
import nl.devrijehond.app.AppGraph
import nl.devrijehond.app.api.models.Category

/**
 * Drives the Kaart tab. Holds the live category list (for the filter chips and
 * marker colours) plus the spots/clusters for the current viewport. The viewport
 * and the selected category are combined and debounced, so panning the map or
 * flipping a chip triggers at most one refetch per 300 ms.
 */
@OptIn(FlowPreview::class)
class MapViewModel : ViewModel() {

    data class Bbox(
        val minLat: Double,
        val minLng: Double,
        val maxLat: Double,
        val maxLng: Double,
    )

    private val _categories = MutableStateFlow<List<Category>>(emptyList())
    val categories: StateFlow<List<Category>> = _categories.asStateFlow()

    private val _items = MutableStateFlow<List<MapItemDto>>(emptyList())
    val items: StateFlow<List<MapItemDto>> = _items.asStateFlow()

    private val _clusters = MutableStateFlow<List<MapClusterDto>>(emptyList())
    val clusters: StateFlow<List<MapClusterDto>> = _clusters.asStateFlow()

    private val _selectedCategoryId = MutableStateFlow<String?>(null)
    val selectedCategoryId: StateFlow<String?> = _selectedCategoryId.asStateFlow()

    private val _loading = MutableStateFlow(false)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    // Seeded with a default Amsterdam viewport so the list fallback already has
    // data before the map reports its first camera bounds (and so a device with
    // no Maps key still shows spots).
    private val bbox = MutableStateFlow(
        Bbox(minLat = 52.305, minLng = 4.83, maxLat = 52.425, maxLng = 4.95),
    )

    init {
        loadCategories()
        viewModelScope.launch {
            combine(bbox, _selectedCategoryId) { b, c -> b to c }
                .debounce(300)
                .distinctUntilChanged()
                .collect { (b, c) -> fetch(b, c) }
        }
    }

    fun loadCategories() {
        viewModelScope.launch {
            try {
                val resp = AppGraph.api.categories.apiV1CategoriesGet(type = null)
                if (resp.isSuccessful) {
                    _categories.value = resp.body()?.items.orEmpty()
                }
            } catch (_: Exception) {
                // Categories are non-fatal for the map; markers fall back to a
                // default tint and the chip row simply stays empty.
            }
        }
    }

    fun onBoundsChange(b: Bbox) {
        bbox.value = b
    }

    fun setCategory(id: String?) {
        _selectedCategoryId.value = id
    }

    fun retry() {
        viewModelScope.launch { fetch(bbox.value, _selectedCategoryId.value) }
    }

    private suspend fun fetch(b: Bbox, categoryId: String?) {
        _loading.value = true
        try {
            val resp = MapDataSource.fetch(
                minLng = b.minLng,
                minLat = b.minLat,
                maxLng = b.maxLng,
                maxLat = b.maxLat,
                categoryId = categoryId,
            )
            _items.value = resp.items
            _clusters.value = resp.clusters
            _error.value = null
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            _error.value = e.message ?: "Geen verbinding."
        } finally {
            _loading.value = false
        }
    }
}
