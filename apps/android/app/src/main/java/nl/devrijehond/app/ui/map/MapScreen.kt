package nl.devrijehond.app.ui.map

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.Map
import androidx.compose.material.icons.filled.Place
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SmallFloatingActionButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.google.maps.android.compose.GoogleMap
import com.google.maps.android.compose.MapProperties
import com.google.maps.android.compose.MapUiSettings
import com.google.maps.android.compose.Marker
import com.google.maps.android.compose.Polygon
import com.google.maps.android.compose.rememberCameraPositionState
import com.google.maps.android.compose.rememberMarkerState
import nl.devrijehond.app.BuildConfig
import nl.devrijehond.app.ui.theme.Brand
import nl.devrijehond.app.ui.theme.Dvh

/**
 * Kaart tab. Shows the live spots on a Google map and lets the user tap a marker to
 * open the detail. A list view is always available as a fallback (and is the default
 * when no Maps key is configured), so the tab works even when the basemap can't
 * authorize on this device.
 *
 * @param onSelectSpot opens a spot detail by slug (marker tap or list-row tap).
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
    val error by vm.error.collectAsState()

    val hasMapsKey = BuildConfig.MAPS_API_KEY.isNotBlank()
    var listMode by remember { mutableStateOf(!hasMapsKey) }

    LaunchedEffect(refreshKey) { vm.retry() }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Brand.Sand),
    ) {
        if (listMode) {
            MapList(items = items, error = error, onSelectSpot = onSelectSpot)
        } else {
            SpotMap(vm = vm, items = items, onSelectSpot = onSelectSpot)
        }

        SmallFloatingActionButton(
            onClick = { listMode = !listMode },
            containerColor = Brand.Cream,
            contentColor = Brand.Moss,
            modifier = Modifier
                .align(Alignment.TopEnd)
                .padding(Dvh.s4),
        ) {
            if (listMode) {
                Icon(Icons.Filled.Map, contentDescription = "Toon kaart")
            } else {
                Icon(Icons.AutoMirrored.Filled.List, contentDescription = "Toon lijst")
            }
        }
    }
}

@Composable
private fun SpotMap(
    vm: MapViewModel,
    items: List<MapItemDto>,
    onSelectSpot: (String) -> Unit,
) {
    val cameraPositionState = rememberCameraPositionState {
        position = CameraPosition.fromLatLngZoom(LatLng(52.3676, 4.9041), 11f)
    }

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

    GoogleMap(
        modifier = Modifier.fillMaxSize(),
        cameraPositionState = cameraPositionState,
        properties = MapProperties(),
        uiSettings = MapUiSettings(zoomControlsEnabled = false),
    ) {
        items.forEach { item ->
            val pos = item.position
            if (item.isRegion) {
                item.outerRing()?.let { ring ->
                    Polygon(
                        points = ring,
                        strokeColor = Brand.Moss,
                        fillColor = Brand.Moss.copy(alpha = 0.18f),
                        strokeWidth = 4f,
                    )
                }
            }
            if (pos != null) {
                Marker(
                    state = rememberMarkerState(key = item.id, position = pos),
                    title = item.name,
                    onClick = {
                        onSelectSpot(item.slug)
                        true
                    },
                )
            }
        }
    }
}

@Composable
private fun MapList(
    items: List<MapItemDto>,
    error: String?,
    onSelectSpot: (String) -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize()) {
        Text(
            text = "Kaart",
            style = MaterialTheme.typography.displaySmall,
            color = Brand.Ink,
            modifier = Modifier.padding(start = Dvh.s4, top = Dvh.s4),
        )
        Text(
            text = "Plekken in beeld. Tik om te openen.",
            style = MaterialTheme.typography.bodyMedium,
            color = Brand.Ink2,
            modifier = Modifier.padding(start = Dvh.s4, top = Dvh.s1, bottom = Dvh.s3),
        )

        if (error != null && items.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("Kon niet laden: $error", color = Brand.Rust)
            }
            return@Column
        }

        LazyColumn(
            contentPadding = androidx.compose.foundation.layout.PaddingValues(
                start = Dvh.s4,
                end = Dvh.s4,
                bottom = Dvh.s6,
            ),
            verticalArrangement = Arrangement.spacedBy(Dvh.s3),
        ) {
            items(items, key = { it.id }) { item ->
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Dvh.rLg))
                        .background(Brand.Cream)
                        .clickable { onSelectSpot(item.slug) }
                        .padding(Dvh.s3),
                ) {
                    Box(
                        modifier = Modifier
                            .size(40.dp)
                            .clip(CircleShape)
                            .background(Brand.MossSoft),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(Icons.Filled.Place, contentDescription = null, tint = Brand.Moss)
                    }
                    Column(modifier = Modifier.padding(start = Dvh.s3)) {
                        Text(item.name, color = Brand.Ink, fontWeight = FontWeight.SemiBold)
                        Text(
                            text = if (item.isVerified) "Geverifieerd" else "Nog niet geverifieerd",
                            style = MaterialTheme.typography.labelSmall,
                            color = if (item.isVerified) Brand.MossDark else Brand.Ink2,
                        )
                    }
                }
            }
        }
    }
}
