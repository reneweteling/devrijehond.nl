package nl.devrijehond.app.ui.map

import com.google.android.gms.maps.model.LatLng
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonPrimitive
import nl.devrijehond.app.BuildConfig
import nl.devrijehond.app.api.infrastructure.Serializer
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import retrofit2.http.GET
import retrofit2.http.Query
import java.util.concurrent.TimeUnit

/**
 * Lean, anonymous data source for the map viewport.
 *
 * The generated SpotsApi client is the primary API contract, but its generated
 * `SpotSummary` model omits the GeoJSON `geometry` that GET /api/v1/spots/map
 * returns for REGION outlines: the field is on the wire but is not declared in
 * the OpenAPI schema (SpotSummarySchema), so codegen drops it. This client
 * re-parses the same endpoint with `geometry` included so the map can draw region
 * polygons. The endpoint is a public, cacheable read, so no auth interceptor is
 * needed here.
 *
 * If `geometry` is later added to SpotSummarySchema and the client is
 * regenerated, this file can be deleted and the ViewModel switched back to
 * AppGraph.api.spots.apiV1SpotsMapGet.
 */
object MapDataSource {

    private val service: MapService by lazy {
        Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE_URL)
            .client(
                OkHttpClient.Builder()
                    .connectTimeout(20, TimeUnit.SECONDS)
                    .readTimeout(20, TimeUnit.SECONDS)
                    .build(),
            )
            .addConverterFactory(
                Serializer.kotlinxSerializationJson.asConverterFactory("application/json".toMediaType()),
            )
            .build()
            .create(MapService::class.java)
    }

    suspend fun fetch(
        minLng: Double,
        minLat: Double,
        maxLng: Double,
        maxLat: Double,
        categoryId: String?,
    ): MapResponseDto = service.map(
        minLng = minLng,
        minLat = minLat,
        maxLng = maxLng,
        maxLat = maxLat,
        cluster = true,
        categoryId = categoryId,
    )

    private interface MapService {
        @GET("api/v1/spots/map")
        suspend fun map(
            @Query("minLng") minLng: Double,
            @Query("minLat") minLat: Double,
            @Query("maxLng") maxLng: Double,
            @Query("maxLat") maxLat: Double,
            @Query("cluster") cluster: Boolean,
            @Query("categoryId") categoryId: String?,
        ): MapResponseDto
    }
}

@Serializable
data class MapResponseDto(
    val items: List<MapItemDto> = emptyList(),
    val clusters: List<MapClusterDto> = emptyList(),
)

/**
 * A single spot in the viewport. Mirrors the wire shape of /spots/map items;
 * unknown keys (rating, updatedAt, ...) are ignored by the shared Json config.
 */
@Serializable
data class MapItemDto(
    val id: String,
    val slug: String,
    val type: String,
    val name: String,
    val categoryId: String,
    val status: String,
    val lat: Double? = null,
    val lng: Double? = null,
    val photoUrl: String? = null,
    val geometry: MapGeometryDto? = null,
) {
    val isVerified: Boolean get() = status == "VERIFIED"
    val isRegion: Boolean get() = type == "REGION"

    val position: LatLng? get() = if (lat != null && lng != null) LatLng(lat, lng) else null

    /**
     * The polygon's outer ring as map points, or null when this is not a polygon
     * region. GeoJSON coordinates are [lng, lat]; the first ring is the outline.
     */
    fun outerRing(): List<LatLng>? {
        val g = geometry ?: return null
        if (!g.type.equals("Polygon", ignoreCase = true)) return null
        val rings = g.coordinates as? JsonArray ?: return null
        val ring = rings.firstOrNull() as? JsonArray ?: return null
        val points = ring.mapNotNull { point ->
            val pair = point as? JsonArray ?: return@mapNotNull null
            val lng = (pair.getOrNull(0) as? JsonPrimitive)?.content?.toDoubleOrNull()
            val lat = (pair.getOrNull(1) as? JsonPrimitive)?.content?.toDoubleOrNull()
            if (lng != null && lat != null) LatLng(lat, lng) else null
        }
        return if (points.size >= 3) points else null
    }
}

@Serializable
data class MapGeometryDto(
    val type: String,
    val coordinates: JsonElement? = null,
)

@Serializable
data class MapClusterDto(
    val lat: Double,
    val lng: Double,
    val count: Int,
)
