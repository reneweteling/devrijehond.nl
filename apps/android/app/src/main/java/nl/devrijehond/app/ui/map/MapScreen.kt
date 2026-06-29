package nl.devrijehond.app.ui.map

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.activity.compose.BackHandler
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.google.android.gms.maps.CameraUpdateFactory
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.MapStyleOptions
import com.google.maps.android.compose.CameraPositionState
import com.google.maps.android.compose.GoogleMap
import com.google.maps.android.compose.MapProperties
import com.google.maps.android.compose.MapType
import com.google.maps.android.compose.MapUiSettings
import com.google.maps.android.compose.MapsComposeExperimentalApi
import com.google.maps.android.compose.MarkerComposable
import com.google.maps.android.compose.Polygon
import com.google.maps.android.compose.rememberCameraPositionState
import com.google.maps.android.compose.rememberMarkerState
import kotlinx.coroutines.launch
import nl.devrijehond.app.api.models.Category
import nl.devrijehond.app.ui.location.DeviceLocation
import nl.devrijehond.app.ui.theme.Brand
import nl.devrijehond.app.ui.theme.Dvh
import nl.devrijehond.app.ui.theme.categoryIcon

/**
 * Kaart tab. Shows the live spots on a Google map with custom, category-tinted pins
 * that mirror the iOS MapKit markers, plus a category filter row and bottom-right
 * controls (satellite toggle + locate-me).
 *
 * @param onSelectSpot opens a spot detail by slug (marker tap).
 * @param refreshKey bump from the shell to force a refetch after a create/edit.
 */
@Composable
fun MapScreen(
    onSelectSpot: (slug: String) -> Unit,
    modifier: Modifier = Modifier,
    refreshKey: Int = 0,
) {
    val vm: MapViewModel = viewModel()
    val items by vm.items.collectAsState()
    val clusters by vm.clusters.collectAsState()
    val categories by vm.categories.collectAsState()
    val selectedCategoryId by vm.selectedCategoryId.collectAsState()

    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var isSatellite by remember { mutableStateOf(false) }
    var showSearch by remember { mutableStateOf(false) }
    val cameraPositionState = rememberCameraPositionState {
        position = CameraPosition.fromLatLngZoom(LatLng(52.3676, 4.9041), 11f)
    }

    val categoriesById = remember(categories) { categories.associateBy { it.id.toString() } }

    LaunchedEffect(refreshKey) { vm.retry() }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Brand.Sand),
    ) {
        SpotMap(
            vm = vm,
            items = items,
            clusters = clusters,
            categoriesById = categoriesById,
            cameraPositionState = cameraPositionState,
            isSatellite = isSatellite,
            onSelectSpot = onSelectSpot,
        )

        // Top overlay: search pill above the category filter chips, like iOS.
        Column(
            modifier = Modifier
                .align(Alignment.TopStart)
                .fillMaxWidth(),
        ) {
            SearchPill(
                onClick = { showSearch = true },
                modifier = Modifier.padding(horizontal = Dvh.s3, vertical = Dvh.s2),
            )
            if (categories.isNotEmpty()) {
                CategoryFilterRow(
                    categories = categories,
                    selectedId = selectedCategoryId,
                    onSelect = vm::setCategory,
                )
            }
        }

        // Legend pill, bottom-centre, lifted clear of the Google logo (bottom-left)
        // and the controls (bottom-right), mirroring iOS.
        MapLegend(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = Dvh.s4),
        )

        // Bottom-right stacked glass controls: satellite toggle + locate-me, mirroring iOS.
        MapControls(
            isSatellite = isSatellite,
            onToggleSatellite = { isSatellite = !isSatellite },
            onLocate = {
                scope.launch {
                    DeviceLocation.current(context)?.let { here ->
                        cameraPositionState.animate(
                            CameraUpdateFactory.newLatLngZoom(here, 14f),
                        )
                    }
                }
            },
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(Dvh.s4),
        )

        // Search surface, layered above the map. Picking a location recenters the
        // camera; picking a spot opens its detail sheet via onSelectSpot.
        if (showSearch) {
            BackHandler { showSearch = false }
            MapSearchScreen(
                spots = items,
                categoriesById = categoriesById,
                onSelectPlace = { lat, lng ->
                    showSearch = false
                    scope.launch {
                        cameraPositionState.animate(
                            CameraUpdateFactory.newLatLngZoom(LatLng(lat, lng), 14f),
                        )
                    }
                },
                onSelectSpot = { slug ->
                    showSearch = false
                    onSelectSpot(slug)
                },
                onClose = { showSearch = false },
                modifier = Modifier.fillMaxSize(),
            )
        }
    }
}

@OptIn(MapsComposeExperimentalApi::class)
@Composable
private fun SpotMap(
    vm: MapViewModel,
    items: List<MapItemDto>,
    clusters: List<MapClusterDto>,
    categoriesById: Map<String, Category>,
    cameraPositionState: CameraPositionState,
    isSatellite: Boolean,
    onSelectSpot: (String) -> Unit,
) {
    val scope = rememberCoroutineScope()

    // Push the viewport bounds into the ViewModel once the camera settles.
    LaunchedEffect(cameraPositionState) {
        snapshotFlow { cameraPositionState.isMoving }
            .collect { moving ->
                if (!moving) {
                    cameraPositionState.projection?.visibleRegion?.latLngBounds?.let { b ->
                        vm.onBoundsChange(
                            MapViewModel.Bbox(
                                minLat = b.southwest.latitude,
                                minLng = b.southwest.longitude,
                                maxLat = b.northeast.latitude,
                                maxLng = b.northeast.longitude,
                            ),
                        )
                    }
                }
            }
    }

    val mapStyle = remember { MapStyleOptions(CLEAN_MAP_STYLE) }

    GoogleMap(
        modifier = Modifier.fillMaxSize(),
        cameraPositionState = cameraPositionState,
        properties = MapProperties(
            // The custom clean style only applies to the normal base map; on satellite
            // it is ignored, so drop it to avoid a no-op style pass.
            mapStyleOptions = if (isSatellite) null else mapStyle,
            mapType = if (isSatellite) MapType.SATELLITE else MapType.NORMAL,
            // Show the blue current-location dot (location permission is already granted).
            isMyLocationEnabled = true,
        ),
        // Hide the built-in my-location button; we have our own locate control.
        uiSettings = MapUiSettings(
            zoomControlsEnabled = false,
            mapToolbarEnabled = false,
            myLocationButtonEnabled = false,
        ),
        contentPadding = PaddingValues(top = 64.dp),
    ) {
        items.forEach { item ->
            val pos = item.position
            if (item.isRegion) {
                item.outerRing()?.let { ring ->
                    Polygon(
                        points = ring,
                        strokeColor = Brand.MossDark,
                        fillColor = Brand.Moss.copy(alpha = 0.20f),
                        strokeWidth = 4f,
                    )
                }
            }
            if (pos != null) {
                val cat = categoriesById[item.categoryId]
                val tint = if (item.isVerified) Brand.categoryColor(cat?.slug) else Brand.Terra
                val glyph = categoryIcon(cat?.slug)
                MarkerComposable(
                    keys = arrayOf(item.id, item.isVerified, item.categoryId),
                    state = rememberMarkerState(key = item.id, position = pos),
                    anchor = SpotPinAnchor,
                    title = item.name,
                    onClick = {
                        onSelectSpot(item.slug)
                        true
                    },
                ) {
                    SpotPin(tint = tint, glyph = glyph)
                }
            }
        }

        clusters.forEach { cluster ->
            val pos = LatLng(cluster.lat, cluster.lng)
            MarkerComposable(
                keys = arrayOf("cluster", cluster.lat, cluster.lng, cluster.count),
                state = rememberMarkerState(key = "c_${cluster.lat}_${cluster.lng}_${cluster.count}", position = pos),
                anchor = ClusterAnchor,
                onClick = {
                    scope.launch {
                        val target = (cameraPositionState.position.zoom + 2.5f).coerceAtMost(16f)
                        cameraPositionState.animate(
                            CameraUpdateFactory.newLatLngZoom(pos, target),
                        )
                    }
                    true
                },
            ) {
                ClusterBubble(count = cluster.count)
            }
        }
    }
}

@Composable
private fun SearchPill(onClick: () -> Unit, modifier: Modifier = Modifier) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Dvh.s2),
        modifier = modifier
            .fillMaxWidth()
            .shadow(4.dp, CircleShape, clip = false, spotColor = Brand.Ink)
            .clip(CircleShape)
            .background(Brand.Cream)
            .border(1.dp, Brand.Ink.copy(alpha = 0.08f), CircleShape)
            .clickable { onClick() }
            .padding(horizontal = Dvh.s4, vertical = 14.dp),
    ) {
        Icon(
            imageVector = Icons.Filled.Search,
            contentDescription = null,
            tint = Brand.Moss,
            modifier = Modifier.size(20.dp),
        )
        Text(
            text = "Zoek een plek, gebied of adres",
            style = MaterialTheme.typography.bodyLarge,
            color = Brand.Ink2,
        )
    }
}

@Composable
private fun CategoryFilterRow(
    categories: List<Category>,
    selectedId: String?,
    onSelect: (String?) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState())
            .padding(horizontal = Dvh.s3, vertical = Dvh.s2),
        horizontalArrangement = Arrangement.spacedBy(Dvh.s2),
    ) {
        FilterPill(label = "Alles", selected = selectedId == null, tint = Brand.Moss) { onSelect(null) }
        categories.forEach { cat ->
            val id = cat.id.toString()
            FilterPill(
                label = cat.label,
                glyph = cat.slug,
                selected = selectedId == id,
                tint = Brand.categoryColor(cat.slug),
            ) {
                onSelect(if (selectedId == id) null else id)
            }
        }
    }
}

@Composable
private fun FilterPill(
    label: String,
    selected: Boolean,
    tint: Color,
    glyph: String? = null,
    onClick: () -> Unit,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        modifier = Modifier
            .shadow(4.dp, CircleShape, clip = false, spotColor = Brand.Ink)
            .clip(CircleShape)
            .background(if (selected) tint else Brand.Cream)
            .then(
                if (selected) Modifier
                else Modifier.border(1.dp, Brand.Ink.copy(alpha = 0.08f), CircleShape),
            )
            .clickable { onClick() }
            .padding(horizontal = Dvh.s3, vertical = Dvh.s2),
    ) {
        if (glyph != null) {
            Icon(
                imageVector = categoryIcon(glyph),
                contentDescription = null,
                tint = if (selected) Color.White else tint,
                modifier = Modifier.size(16.dp),
            )
        }
        Text(
            text = label,
            style = MaterialTheme.typography.labelLarge,
            color = if (selected) Color.White else Brand.MossDark,
        )
    }
}

@Composable
private fun MapLegend(modifier: Modifier = Modifier) {
    Row(
        modifier = modifier
            .shadow(4.dp, CircleShape, clip = false, spotColor = Brand.Ink)
            .clip(CircleShape)
            .background(Brand.Cream)
            .border(1.dp, Brand.Ink.copy(alpha = 0.08f), CircleShape)
            .padding(horizontal = Dvh.s3, vertical = Dvh.s2),
        horizontalArrangement = Arrangement.spacedBy(Dvh.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        LegendDot(color = Brand.Moss, dashed = false, label = "Geverifieerd")
        LegendDot(color = Brand.Terra, dashed = false, label = "Niet geverifieerd")
    }
}

@Composable
private fun LegendDot(color: Color, dashed: Boolean, label: String) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Box(
            modifier = Modifier
                .size(12.dp)
                .clip(CircleShape)
                .background(color),
        )
        Text(label, style = MaterialTheme.typography.labelSmall, color = Brand.Ink2)
    }
}

/** A pared-back Google Maps style: POIs and busy labels off, so the brand pins are
 *  the focus, closer to the iOS map's clean look. */
private const val CLEAN_MAP_STYLE = """
[
  {"featureType":"poi","stylers":[{"visibility":"off"}]},
  {"featureType":"poi.park","elementType":"geometry","stylers":[{"visibility":"on"}]},
  {"featureType":"transit","stylers":[{"visibility":"off"}]},
  {"featureType":"road","elementType":"labels.icon","stylers":[{"visibility":"off"}]}
]
"""
