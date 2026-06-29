package nl.devrijehond.app.ui.addspot

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.MyLocation
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Undo
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.google.android.gms.location.LocationServices
import com.google.android.gms.maps.CameraUpdateFactory
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.google.maps.android.compose.GoogleMap
import com.google.maps.android.compose.MapProperties
import com.google.maps.android.compose.MapType
import com.google.maps.android.compose.MapUiSettings
import com.google.maps.android.compose.Marker
import com.google.maps.android.compose.MarkerState
import com.google.maps.android.compose.Polygon
import com.google.maps.android.compose.rememberCameraPositionState
import kotlinx.coroutines.launch
import nl.devrijehond.app.ui.map.MapControls
import nl.devrijehond.app.ui.map.MapItemDto
import nl.devrijehond.app.ui.map.MapSearchScreen
import nl.devrijehond.app.ui.theme.Brand
import nl.devrijehond.app.ui.theme.Dvh

// Centre of the Netherlands, used until a location fix or a placed point arrives.
private val NlCenter = LatLng(52.1326, 5.2913)

/**
 * Step 1: pick a type (Gebied/Plek) and place the geometry on a Google map.
 * POI = a single draggable marker (tap to drop, drag to refine). REGION = a
 * polygon editor: tap to add a vertex, drag a vertex to move it, with undo / clear.
 * The polygon overlay is rebuilt live from the vertex list while dragging.
 *
 * Maps SDK blocker: without the `com.google.android.geo.API_KEY` manifest meta-data
 * the basemap tiles render blank (auth failure in logcat), but taps + markers still
 * report coordinates, so the editor stays usable. A banner explains it, and the POI
 * path offers a "use my location" fallback.
 */
@Composable
fun GeometryStep(
    vm: AddSpotViewModel,
    onContinue: () -> Unit,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val mapsKeyPresent = remember { mapsApiKeyPresent(context) }

    var showSearch by remember { mutableStateOf(false) }

    var userLocation by remember { mutableStateOf<LatLng?>(null) }
    var hasLocationPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.ACCESS_FINE_LOCATION,
            ) == PackageManager.PERMISSION_GRANTED,
        )
    }

    val cameraPositionState = rememberCameraPositionState {
        position = CameraPosition.fromLatLngZoom(NlCenter, 7.5f)
    }
    var didCenterOnUser by remember { mutableStateOf(false) }
    var isSatellite by remember { mutableStateOf(false) }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        hasLocationPermission = granted
        if (granted) requestLastLocation(context) { userLocation = it }
    }

    LaunchedEffect(hasLocationPermission) {
        if (hasLocationPermission) requestLastLocation(context) { userLocation = it }
    }
    // Centre on the user the first time a fix arrives (mirrors the iOS map).
    LaunchedEffect(userLocation) {
        val loc = userLocation
        if (loc != null && !didCenterOnUser) {
            didCenterOnUser = true
            cameraPositionState.position = CameraPosition.fromLatLngZoom(loc, 13f)
        }
    }

    Box(modifier = modifier.fillMaxSize().background(Brand.Sand)) {
        GoogleMap(
            modifier = Modifier.fillMaxSize(),
            cameraPositionState = cameraPositionState,
            properties = MapProperties(
                mapType = if (isSatellite) MapType.SATELLITE else MapType.NORMAL,
                // Blue current-location dot, matching the Kaart tab.
                isMyLocationEnabled = hasLocationPermission,
            ),
            // Hide the built-in my-location button; we use our own bottom-right control.
            uiSettings = MapUiSettings(
                myLocationButtonEnabled = false,
                zoomControlsEnabled = false,
                mapToolbarEnabled = false,
            ),
            onMapClick = { latLng ->
                if (vm.isRegion) vm.addVertex(latLng) else vm.placePoiIfEmpty(latLng)
            },
        ) {
            if (vm.isRegion) {
                vm.vertices.forEachIndexed { index, v ->
                    key(v.id) {
                        val markerState = remember { MarkerState(v.position) }
                        Marker(
                            state = markerState,
                            draggable = true,
                            title = "Punt ${index + 1}",
                        )
                        // ms.position updates per drag frame -> live polygon redraw.
                        LaunchedEffect(markerState.position) {
                            vm.moveVertex(v.id, markerState.position)
                        }
                    }
                }
                if (vm.vertices.size >= 3) {
                    Polygon(
                        points = vm.vertices.map { it.position },
                        fillColor = Brand.Moss.copy(alpha = 0.25f),
                        strokeColor = Brand.MossDark,
                        strokeWidth = 5f,
                    )
                }
            } else {
                vm.poi?.let { p ->
                    key("poi") {
                        val markerState = remember { MarkerState(p) }
                        Marker(state = markerState, draggable = true, title = "Plek")
                        LaunchedEffect(markerState.position) { vm.movePoi(markerState.position) }
                    }
                }
            }
        }

        // Top overlay: the search pill with the Gebied/Plek toggle on one row, at the
        // same height as the Kaart search pill, plus the optional Maps-key banner.
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = Dvh.s3, vertical = Dvh.s2),
            verticalArrangement = Arrangement.spacedBy(Dvh.s2),
        ) {
            // One row, mirroring iOS: the frosted search pill with the Gebied/Plek
            // toggle to its right. Tapping the pill opens the shared search surface
            // so the user can jump the map to an address or area.
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Dvh.s2),
            ) {
                AddSearchPill(
                    onClick = { showSearch = true },
                    modifier = Modifier.weight(1f),
                )
                TypeToggle(
                    isRegion = vm.isRegion,
                    onSelect = vm::setType,
                )
            }
            if (!mapsKeyPresent) {
                MapsKeyBanner()
            }
        }

        // Bottom-right stacked glass controls: satellite toggle + locate-me, mirroring the Kaart tab.
        MapControls(
            isSatellite = isSatellite,
            onToggleSatellite = { isSatellite = !isSatellite },
            onLocate = {
                val loc = userLocation
                if (loc != null) {
                    cameraPositionState.position = CameraPosition.fromLatLngZoom(loc, 14f)
                } else if (hasLocationPermission) {
                    requestLastLocation(context) {
                        userLocation = it
                        cameraPositionState.position = CameraPosition.fromLatLngZoom(it, 14f)
                    }
                } else {
                    permissionLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION)
                }
            },
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(Dvh.s4),
        )

        // Bottom controls card. Kept narrower than full width so it clears the
        // bottom-right map controls and sits to their left.
        Column(
            modifier = Modifier
                .align(Alignment.BottomStart)
                .fillMaxWidth()
                .padding(Dvh.s4),
        ) {
            Surface(
                color = Brand.Cream,
                shape = RoundedCornerShape(Dvh.rLg),
                shadowElevation = 6.dp,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(end = 44.dp + Dvh.s2),
            ) {
                Column(
                    modifier = Modifier.padding(Dvh.s4),
                    verticalArrangement = Arrangement.spacedBy(Dvh.s3),
                ) {
                    Text(
                        text = hintText(vm),
                        style = MaterialTheme.typography.bodyMedium,
                        color = Brand.Ink2,
                    )

                    if (vm.isRegion && vm.vertices.isNotEmpty()) {
                        Row(horizontalArrangement = Arrangement.spacedBy(Dvh.s2)) {
                            OutlinedButton(
                                onClick = vm::undoVertex,
                                modifier = Modifier.weight(1f),
                            ) {
                                Icon(Icons.Filled.Undo, contentDescription = null, modifier = Modifier.height(18.dp))
                                Spacer(Modifier.width(Dvh.s1))
                                Text("Ongedaan")
                            }
                            OutlinedButton(
                                onClick = vm::clearVertices,
                                colors = ButtonDefaults.outlinedButtonColors(contentColor = Brand.Terra),
                                modifier = Modifier.weight(1f),
                            ) {
                                Icon(Icons.Filled.Delete, contentDescription = null, modifier = Modifier.height(18.dp))
                                Spacer(Modifier.width(Dvh.s1))
                                Text("Wis alles")
                            }
                        }
                    }

                    // POI fallback: place the point on the current location. Handy when
                    // the basemap is blank (no Maps key) so tapping is hard to aim.
                    if (!vm.isRegion) {
                        OutlinedButton(
                            onClick = {
                                val loc = userLocation
                                if (loc != null) {
                                    vm.placePoiAt(loc)
                                    cameraPositionState.position = CameraPosition.fromLatLngZoom(loc, 15f)
                                } else if (hasLocationPermission) {
                                    requestLastLocation(context) {
                                        userLocation = it
                                        vm.placePoiAt(it)
                                    }
                                } else {
                                    permissionLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION)
                                }
                            },
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Icon(Icons.Filled.MyLocation, contentDescription = null, modifier = Modifier.height(18.dp))
                            Spacer(Modifier.width(Dvh.s1))
                            Text("Gebruik mijn locatie")
                        }
                    }

                    Button(
                        onClick = onContinue,
                        enabled = vm.canFinishGeometry,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Brand.Moss,
                            contentColor = Brand.Cream,
                        ),
                        modifier = Modifier.fillMaxWidth().height(Dvh.controlHeight),
                    ) {
                        Text(
                            text = if (vm.canFinishGeometry) {
                                if (vm.isRegion) "Verder, ${vm.vertices.size} punten" else "Verder"
                            } else {
                                "Verder"
                            },
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                }
            }
        }

        // Shared search surface, layered above the add-spot map. Picking a
        // geocoded location animates the camera there so the user can place the
        // spot; picking a known spot recenters on it if a coordinate is available.
        if (showSearch) {
            BackHandler { showSearch = false }
            MapSearchScreen(
                spots = emptyList<MapItemDto>(),
                categoriesById = emptyMap(),
                onSelectPlace = { lat, lng ->
                    showSearch = false
                    scope.launch {
                        cameraPositionState.animate(
                            CameraUpdateFactory.newLatLngZoom(LatLng(lat, lng), 15f),
                        )
                    }
                },
                onSelectSpot = { showSearch = false },
                onClose = { showSearch = false },
                modifier = Modifier.fillMaxSize(),
            )
        }
    }
}

@Composable
private fun AddSearchPill(onClick: () -> Unit, modifier: Modifier = Modifier) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Dvh.s2),
        modifier = modifier
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
            text = "Zoek locatie",
            style = MaterialTheme.typography.bodyLarge,
            color = Brand.Ink2,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

@Composable
private fun TypeToggle(
    isRegion: Boolean,
    onSelect: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(
        color = Brand.Cream,
        shape = RoundedCornerShape(Dvh.rXl),
        shadowElevation = 4.dp,
        modifier = modifier,
    ) {
        Row(modifier = Modifier.padding(3.dp)) {
            ToggleSegment("Gebied", selected = isRegion) { onSelect(true) }
            ToggleSegment("Plek", selected = !isRegion) { onSelect(false) }
        }
    }
}

@Composable
private fun ToggleSegment(
    label: String,
    selected: Boolean,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(Dvh.rXl))
            .background(if (selected) Brand.Moss else Brand.Cream)
            .height(38.dp)
            .clickable(onClick = onClick)
            .padding(horizontal = Dvh.s3),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = label,
            color = if (selected) Brand.Cream else Brand.Ink2,
            fontWeight = FontWeight.SemiBold,
            style = MaterialTheme.typography.labelLarge,
        )
    }
}

@Composable
private fun MapsKeyBanner() {
    Surface(
        color = Brand.Terra.copy(alpha = 0.12f),
        shape = RoundedCornerShape(Dvh.rSm),
    ) {
        Text(
            text = "Kaart-key ontbreekt: de ondergrond blijft mogelijk leeg. " +
                "Tikken en slepen werken wel; voor een plek kun je 'Gebruik mijn locatie' nemen.",
            style = MaterialTheme.typography.labelSmall,
            color = Brand.Ink2,
            modifier = Modifier.padding(Dvh.s2),
        )
    }
}

private fun hintText(vm: AddSpotViewModel): String {
    if (vm.isRegion) {
        return when {
            vm.vertices.isEmpty() ->
                "Tik op de kaart om de omtrek te tekenen. Sleep een punt om te verplaatsen."
            vm.vertices.size < 3 -> {
                val left = 3 - vm.vertices.size
                "Nog $left punt${if (left == 1) "" else "en"} nodig voor een geldig gebied."
            }
            else -> "Gebied klaar. Voeg meer punten toe of ga verder."
        }
    }
    return if (vm.poi == null) {
        "Tik op de kaart om de plek neer te zetten."
    } else {
        "Sleep de pin om de plek precies te plaatsen."
    }
}

/** True when a real Maps SDK key is wired into the manifest meta-data. */
private fun mapsApiKeyPresent(context: Context): Boolean {
    return try {
        val ai = context.packageManager.getApplicationInfo(
            context.packageName,
            PackageManager.GET_META_DATA,
        )
        val key = ai.metaData?.getString("com.google.android.geo.API_KEY")
        !key.isNullOrBlank() && !key.contains("YOUR_", ignoreCase = true)
    } catch (_: Exception) {
        false
    }
}

@SuppressLint("MissingPermission")
private fun requestLastLocation(context: Context, onResult: (LatLng) -> Unit) {
    if (ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) !=
        PackageManager.PERMISSION_GRANTED
    ) {
        return
    }
    try {
        LocationServices.getFusedLocationProviderClient(context).lastLocation
            .addOnSuccessListener { loc ->
                if (loc != null) onResult(LatLng(loc.latitude, loc.longitude))
            }
    } catch (_: SecurityException) {
        // Permission revoked between the check and the call; ignore.
    }
}
