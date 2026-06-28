package nl.devrijehond.app.ui.addspot

import android.app.Application
import android.net.Uri
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.google.android.gms.maps.model.LatLng
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import nl.devrijehond.app.AppGraph
import nl.devrijehond.app.api.models.Amenity
import nl.devrijehond.app.api.models.Category
import nl.devrijehond.app.api.models.GeoPoint
import nl.devrijehond.app.api.models.SpotType
import nl.devrijehond.app.api.models.SubmitSpotRequest
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.net.URI
import java.util.UUID

/**
 * State + logic for the add-spot flow. Mirrors the iOS AddScreen + SpotFormView:
 * step 1 places the geometry (a POI point or a REGION polygon) on the map, step 2
 * fills the descriptive form and submits via POST /api/v1/me/spots.
 *
 * Geometry lives here as the single source of truth; the map editor only reports
 * taps/drags back through the mutate methods, so undo/clear and a live polygon
 * redraw stay consistent (same approach as the iOS Coordinator).
 */
class AddSpotViewModel(app: Application) : AndroidViewModel(app) {

    enum class Step { GEOMETRY, FORM }

    /** A polygon vertex with a stable id so the map can keep its MarkerState across
     *  recompositions while we mutate the list (drag, undo). */
    data class Vertex(val id: Long, val position: LatLng)

    /** A picked photo: shown immediately from its local uri, uploaded in the
     *  background to get the publicUrl we submit. */
    data class PhotoItem(
        val id: Long,
        val localUri: Uri,
        val remoteUrl: String? = null,
        val uploading: Boolean = true,
        val failed: Boolean = false,
    )

    var step by mutableStateOf(Step.GEOMETRY)
        private set

    // Default to REGION, matching the iOS default (Gebied first).
    var isRegion by mutableStateOf(true)
        private set

    // Geometry source of truth.
    val vertices = mutableStateListOf<Vertex>()
    var poi by mutableStateOf<LatLng?>(null)
        private set
    private var nextVertexId = 0L

    // Form fields (two-way bound from the UI).
    var name by mutableStateOf("")
    var description by mutableStateOf("")
    var address by mutableStateOf("")
    var website by mutableStateOf("")

    var categoryId by mutableStateOf<UUID?>(null)
        private set

    var categories by mutableStateOf<List<Category>>(emptyList())
        private set
    var amenities by mutableStateOf<List<Amenity>>(emptyList())
        private set
    val selectedAmenities = mutableStateListOf<UUID>()

    val photos = mutableStateListOf<PhotoItem>()
    private var nextPhotoId = 0L

    var submitting by mutableStateOf(false)
        private set
    var error by mutableStateOf<String?>(null)

    val type: SpotType get() = if (isRegion) SpotType.REGION else SpotType.POI

    val canFinishGeometry: Boolean
        get() = if (isRegion) vertices.size >= 3 else poi != null

    val canSubmit: Boolean
        get() {
            val n = name.trim().length
            return n in 2..120 &&
                categoryId != null &&
                !submitting &&
                photos.none { it.uploading }
        }

    /** Categories valid for the current type, falling back to all if none tagged. */
    val pickableCategories: List<Category>
        get() {
            val matched = categories.filter { it.type == type }
            return matched.ifEmpty { categories }
        }

    init {
        loadCategories()
    }

    // MARK: - Type

    fun setType(region: Boolean) {
        if (region == isRegion) return
        isRegion = region
        vertices.clear()
        poi = null
        // Category set differs per type; reset the dependent selection.
        categoryId = null
        amenities = emptyList()
        selectedAmenities.clear()
    }

    // MARK: - Geometry mutations

    fun addVertex(p: LatLng) {
        vertices.add(Vertex(nextVertexId++, p))
    }

    fun moveVertex(id: Long, p: LatLng) {
        val i = vertices.indexOfFirst { it.id == id }
        if (i >= 0 && vertices[i].position != p) vertices[i] = vertices[i].copy(position = p)
    }

    fun undoVertex() {
        if (vertices.isNotEmpty()) vertices.removeAt(vertices.lastIndex)
    }

    fun clearVertices() {
        vertices.clear()
    }

    /** Drop the POI on first tap; afterwards the user drags it to refine. */
    fun placePoiIfEmpty(p: LatLng) {
        if (poi == null) poi = p
    }

    fun movePoi(p: LatLng) {
        if (poi != p) poi = p
    }

    /** Fallback used when the basemap can't render (no Maps key): place / move the
     *  POI onto the device's current location. */
    fun placePoiAt(p: LatLng) {
        poi = p
    }

    // MARK: - Steps

    fun goToForm() {
        error = null
        step = Step.FORM
    }

    fun backToGeometry() {
        step = Step.GEOMETRY
    }

    // MARK: - Form

    fun selectCategory(id: UUID) {
        categoryId = id
        selectedAmenities.clear()
        loadAmenities(id)
    }

    fun toggleAmenity(id: UUID) {
        if (!selectedAmenities.remove(id)) selectedAmenities.add(id)
    }

    fun addPhoto(uri: Uri) {
        if (photos.size >= 10) return
        val id = nextPhotoId++
        photos.add(PhotoItem(id, uri))
        viewModelScope.launch {
            try {
                val url = uploadPhoto(uri)
                replacePhoto(id) { it.copy(remoteUrl = url, uploading = false) }
            } catch (e: Exception) {
                replacePhoto(id) { it.copy(uploading = false, failed = true) }
            }
        }
    }

    fun removePhoto(id: Long) {
        val i = photos.indexOfFirst { it.id == id }
        if (i >= 0) photos.removeAt(i)
    }

    private inline fun replacePhoto(id: Long, transform: (PhotoItem) -> PhotoItem) {
        val i = photos.indexOfFirst { it.id == id }
        if (i >= 0) photos[i] = transform(photos[i])
    }

    // MARK: - Submit

    /**
     * Build the friendly SubmitSpot body and POST it. Requires auth; the caller
     * gates on [nl.devrijehond.app.AppGraph].session.isAuthenticated and surfaces
     * the sign-in prompt before calling this.
     */
    fun submit(onCreated: (String) -> Unit) {
        val cat = categoryId ?: return
        if (!AppGraph.session.isAuthenticated) return
        submitting = true
        error = null
        viewModelScope.launch {
            try {
                val body = SubmitSpotRequest(
                    type = type,
                    categoryId = cat,
                    name = name.trim(),
                    description = description.trim().ifBlank { null },
                    point = if (!isRegion) {
                        poi?.let { GeoPoint(it.latitude.toBigDecimal(), it.longitude.toBigDecimal()) }
                    } else {
                        null
                    },
                    polygon = if (isRegion) {
                        vertices.map {
                            GeoPoint(it.position.latitude.toBigDecimal(), it.position.longitude.toBigDecimal())
                        }
                    } else {
                        null
                    },
                    amenityIds = selectedAmenities.toList().ifEmpty { null },
                    photos = photos.mapNotNull { it.remoteUrl }.map { URI(it) }.ifEmpty { null },
                    address = if (!isRegion) address.trim().ifBlank { null } else null,
                    website = if (!isRegion) normalizedWebsite()?.let { URI(it) } else null,
                )
                val resp = AppGraph.api.spots.apiV1MeSpotsPost(body)
                val created = resp.body()
                when {
                    resp.isSuccessful && created != null -> onCreated(created.slug)
                    resp.code() == 401 -> {
                        AppGraph.session.signOut()
                        error = "Je sessie is verlopen. Log opnieuw in."
                    }
                    else -> error = "Plaatsen mislukt (${resp.code()}). Probeer het opnieuw."
                }
            } catch (e: Exception) {
                error = e.message ?: "Plaatsen mislukt. Probeer het opnieuw."
            }
            submitting = false
        }
    }

    /** Reset everything so the tab is clean after a successful submit. */
    fun reset() {
        step = Step.GEOMETRY
        vertices.clear()
        poi = null
        name = ""
        description = ""
        address = ""
        website = ""
        categoryId = null
        amenities = emptyList()
        selectedAmenities.clear()
        photos.clear()
        error = null
        submitting = false
    }

    // MARK: - Data

    private fun loadCategories() {
        viewModelScope.launch {
            try {
                val resp = AppGraph.api.categories.apiV1CategoriesGet(type = null)
                if (resp.isSuccessful) categories = resp.body()?.items.orEmpty()
            } catch (_: Exception) {
                // Categories load on demand; a transient failure just shows a spinner.
            }
        }
    }

    private fun loadAmenities(id: UUID) {
        viewModelScope.launch {
            amenities = try {
                val resp = AppGraph.api.amenities.apiV1AmenitiesGet(categoryId = id)
                if (resp.isSuccessful) resp.body()?.items.orEmpty() else emptyList()
            } catch (_: Exception) {
                emptyList()
            }
        }
    }

    private suspend fun uploadPhoto(uri: Uri): String {
        val resolver = getApplication<Application>().contentResolver
        val bytes = withContext(Dispatchers.IO) {
            resolver.openInputStream(uri)?.use { it.readBytes() }
                ?: throw IllegalStateException("Kon de foto niet lezen.")
        }
        val reqBody = bytes.toRequestBody("image/jpeg".toMediaType())
        val part = MultipartBody.Part.createFormData("file", "photo.jpg", reqBody)
        val resp = AppGraph.api.uploads.apiV1MeUploadsPost(part)
        val out = resp.body()
        if (resp.isSuccessful && out != null) return out.publicUrl.toString()
        throw IllegalStateException("Upload mislukt (${resp.code()}).")
    }

    /**
     * zod's z.string().url() requires a scheme; a user typing "example.com" would
     * 400. Prefix https:// when no scheme is present.
     */
    private fun normalizedWebsite(): String? {
        val s = website.trim()
        if (s.isEmpty()) return null
        val lower = s.lowercase()
        return if (lower.startsWith("http://") || lower.startsWith("https://")) s else "https://$s"
    }
}
