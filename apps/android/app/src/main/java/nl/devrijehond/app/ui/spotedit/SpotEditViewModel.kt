package nl.devrijehond.app.ui.spotedit

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import nl.devrijehond.app.AppGraph
import nl.devrijehond.app.api.models.Amenity
import nl.devrijehond.app.api.models.Category
import nl.devrijehond.app.api.models.SpotDetail
import nl.devrijehond.app.api.models.UpdateSpotRequest
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.net.URI
import java.util.UUID

/**
 * Drives SpotEditScreen. Loads the spot detail + the category / amenity taxonomy,
 * holds the editable form, uploads a replacement photo, and PATCHes
 * /api/v1/me/spots/:id. The map geometry is not editable here, only the
 * descriptive fields + photo (mirrors the iOS SpotEditView).
 *
 * Authorisation matches the API policy: the owner may edit while the spot is
 * UNVERIFIED, staff (ADMIN/MODERATOR) may edit any spot. We don't re-check that
 * here, the server enforces it; the screen only opens when allowed.
 */
class SpotEditViewModel : ViewModel() {

    data class UiState(
        val loading: Boolean = true,
        val loadError: String? = null,
        val detail: SpotDetail? = null,
        val categories: List<Category> = emptyList(),
        val amenities: List<Amenity> = emptyList(),
        // editable fields
        val name: String = "",
        val description: String = "",
        val website: String = "",
        val phone: String = "",
        val address: String = "",
        val categoryId: String? = null,
        val selectedAmenityIds: Set<String> = emptySet(),
        // photo
        val currentPhotoUrl: String? = null,
        val uploadedPhotoUrl: String? = null,
        val uploadingPhoto: Boolean = false,
        // save
        val saving: Boolean = false,
        val saveError: String? = null,
    ) {
        val canSave: Boolean
            get() = name.trim().length in 2..120 && categoryId != null && !saving && !uploadingPhoto
    }

    private val _state = MutableStateFlow(UiState())
    val state: StateFlow<UiState> = _state.asStateFlow()

    private var slug: String? = null
    private var started = false

    fun start(slug: String) {
        if (started) return
        started = true
        this.slug = slug
        load()
    }

    private fun load() {
        val slug = slug ?: return
        _state.update { it.copy(loading = true, loadError = null) }
        viewModelScope.launch {
            try {
                val detailResp = AppGraph.api.spots.apiV1SpotsSlugGet(slug)
                val detail = detailResp.body()
                if (!detailResp.isSuccessful || detail == null) {
                    _state.update { it.copy(loading = false, loadError = "Kon de plek niet laden (${detailResp.code()}).") }
                    return@launch
                }
                val categories = runCatching {
                    AppGraph.api.categories.apiV1CategoriesGet(type = detail.type).body()?.items.orEmpty()
                }.getOrDefault(emptyList())
                _state.update {
                    it.copy(
                        loading = false,
                        detail = detail,
                        categories = categories,
                        name = detail.name,
                        description = detail.description ?: "",
                        website = detail.website?.toString() ?: "",
                        phone = detail.phone ?: "",
                        address = detail.address ?: "",
                        categoryId = detail.category.id.toString(),
                        selectedAmenityIds = detail.amenities.map { a -> a.id.toString() }.toSet(),
                        currentPhotoUrl = detail.photos.firstOrNull()?.url?.toString(),
                    )
                }
                loadAmenities(detail.category.id.toString())
            } catch (e: Exception) {
                _state.update { it.copy(loading = false, loadError = e.message ?: "Geen verbinding.") }
            }
        }
    }

    private fun loadAmenities(categoryId: String) {
        viewModelScope.launch {
            val amenities = runCatching {
                AppGraph.api.amenities.apiV1AmenitiesGet(categoryId = UUID.fromString(categoryId)).body()?.items.orEmpty()
            }.getOrDefault(emptyList())
            _state.update { it.copy(amenities = amenities) }
        }
    }

    // MARK: - Field setters

    fun setName(v: String) = _state.update { it.copy(name = v.take(120)) }
    fun setDescription(v: String) = _state.update { it.copy(description = v.take(4000)) }
    fun setWebsite(v: String) = _state.update { it.copy(website = v) }
    fun setPhone(v: String) = _state.update { it.copy(phone = v.take(40)) }
    fun setAddress(v: String) = _state.update { it.copy(address = v.take(240)) }

    fun setCategory(id: String) {
        _state.update { it.copy(categoryId = id, selectedAmenityIds = emptySet(), amenities = emptyList()) }
        loadAmenities(id)
    }

    fun toggleAmenity(id: String) = _state.update {
        val next = it.selectedAmenityIds.toMutableSet()
        if (!next.add(id)) next.remove(id)
        it.copy(selectedAmenityIds = next)
    }

    // MARK: - Photo

    /** Upload picked image bytes, store the returned public URL for the save. */
    fun uploadPhoto(bytes: ByteArray) {
        _state.update { it.copy(uploadingPhoto = true, saveError = null) }
        viewModelScope.launch {
            try {
                val body = bytes.toRequestBody("image/jpeg".toMediaType())
                val part = MultipartBody.Part.createFormData("file", "photo.jpg", body)
                val resp = AppGraph.api.uploads.apiV1MeUploadsPost(part)
                if (resp.isSuccessful) {
                    _state.update { it.copy(uploadingPhoto = false, uploadedPhotoUrl = resp.body()?.publicUrl?.toString()) }
                } else {
                    if (resp.code() == 401) AppGraph.session.signOut()
                    _state.update { it.copy(uploadingPhoto = false, saveError = "Foto uploaden mislukt (${resp.code()}).") }
                }
            } catch (e: Exception) {
                _state.update { it.copy(uploadingPhoto = false, saveError = "Foto uploaden mislukt. Probeer het opnieuw.") }
            }
        }
    }

    // MARK: - Save

    fun save(onSaved: () -> Unit) {
        val s = _state.value
        val detail = s.detail ?: return
        val categoryId = s.categoryId ?: return
        _state.update { it.copy(saving = true, saveError = null) }
        viewModelScope.launch {
            try {
                val req = UpdateSpotRequest(
                    name = s.name.trim(),
                    description = s.description.trim(),
                    categoryId = UUID.fromString(categoryId),
                    amenityIds = s.selectedAmenityIds.map { UUID.fromString(it) },
                    address = s.address.trim().ifEmpty { null },
                    phone = s.phone.trim().ifEmpty { null },
                    website = normalizedWebsite(s.website),
                    photoUrls = s.uploadedPhotoUrl?.let { listOf(URI.create(it)) },
                )
                val resp = AppGraph.api.spots.apiV1MeSpotsIdPatch(detail.id.toString(), req)
                if (resp.isSuccessful) {
                    _state.update { it.copy(saving = false) }
                    onSaved()
                } else {
                    if (resp.code() == 401) AppGraph.session.signOut()
                    _state.update {
                        it.copy(
                            saving = false,
                            saveError = when (resp.code()) {
                                401 -> "Je sessie is verlopen. Log opnieuw in."
                                403 -> "Je mag deze plek niet bewerken."
                                404 -> "Deze plek bestaat niet of is niet bewerkbaar."
                                else -> "Opslaan mislukt (${resp.code()})."
                            },
                        )
                    }
                }
            } catch (e: Exception) {
                _state.update { it.copy(saving = false, saveError = "Opslaan mislukt. Probeer het opnieuw.") }
            }
        }
    }

    /**
     * zod's z.string().url() needs a scheme; "example.com" would 400. Prefix
     * https:// when missing. Empty clears the field (null).
     */
    private fun normalizedWebsite(raw: String): URI? {
        val s = raw.trim()
        if (s.isEmpty()) return null
        val withScheme = if (s.startsWith("http://") || s.startsWith("https://")) s else "https://$s"
        return runCatching { URI.create(withScheme) }.getOrNull()
    }
}
