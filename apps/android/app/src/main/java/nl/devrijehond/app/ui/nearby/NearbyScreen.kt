package nl.devrijehond.app.ui.nearby

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Place
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import nl.devrijehond.app.api.models.SpotSummary
import nl.devrijehond.app.ui.theme.Brand
import nl.devrijehond.app.ui.theme.Dvh

/**
 * Nabij tab. A nearest-first list of spots, fetched from GET /api/v1/spots with the
 * device location as nearLat/nearLng so the backend orders by distance. Mirrors the
 * iOS NearbyScreen. Tapping a row opens the spot detail via [onSelectSpot].
 *
 * Location is best-effort: if the permission is denied or no fix is available, the
 * list still loads around a default centre, so the tab never stalls.
 *
 * @param refreshKey bump from the shell to force a reload after a create/edit.
 */
@Composable
fun NearbyScreen(
    onSelectSpot: (slug: String) -> Unit,
    modifier: Modifier = Modifier,
    refreshKey: Int = 0,
) {
    val vm: NearbyViewModel = viewModel()
    val state by vm.state.collectAsState()
    val context = LocalContext.current

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { vm.load(context) }

    LaunchedEffect(refreshKey) {
        val granted = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_COARSE_LOCATION,
        ) == PackageManager.PERMISSION_GRANTED
        if (granted) {
            vm.load(context)
        } else {
            permissionLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION)
        }
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(Brand.Sand),
    ) {
        Text(
            text = "Nabij",
            style = MaterialTheme.typography.displaySmall,
            color = Brand.Ink,
            modifier = Modifier.padding(start = Dvh.s4, top = Dvh.s4),
        )
        Text(
            text = "Plekken dichtbij, dichtstbijzijnde eerst.",
            style = MaterialTheme.typography.bodyMedium,
            color = Brand.Ink2,
            modifier = Modifier.padding(start = Dvh.s4, top = Dvh.s1, bottom = Dvh.s3),
        )

        when {
            state.loading && state.items.isEmpty() -> CenterBox {
                CircularProgressIndicator(color = Brand.Moss)
            }

            state.error != null && state.items.isEmpty() -> CenterBox {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(state.error!!, color = Brand.Rust)
                    Button(
                        onClick = { vm.load(context) },
                        modifier = Modifier.padding(top = Dvh.s3),
                        colors = ButtonDefaults.buttonColors(containerColor = Brand.Moss),
                    ) { Text("Opnieuw") }
                }
            }

            state.items.isEmpty() -> CenterBox {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("Geen plekken gevonden", color = Brand.Ink, fontWeight = FontWeight.SemiBold)
                    Text(
                        "Probeer het later opnieuw.",
                        color = Brand.Ink2,
                        modifier = Modifier.padding(top = Dvh.s1),
                    )
                }
            }

            else -> LazyColumn(
                contentPadding = androidx.compose.foundation.layout.PaddingValues(
                    start = Dvh.s4,
                    end = Dvh.s4,
                    bottom = Dvh.s6,
                ),
                verticalArrangement = Arrangement.spacedBy(Dvh.s3),
            ) {
                items(state.items, key = { it.id.toString() }) { spot ->
                    NearbyRow(
                        spot = spot,
                        distanceMeters = vm.distanceMeters(spot),
                        onClick = { onSelectSpot(spot.slug) },
                    )
                }
            }
        }
    }
}

@Composable
private fun NearbyRow(
    spot: SpotSummary,
    distanceMeters: Double?,
    onClick: () -> Unit,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(Dvh.rLg))
            .background(Brand.Cream)
            .clickable { onClick() }
            .padding(Dvh.s3),
    ) {
        val photo = spot.photoUrl?.toString()
        if (photo != null) {
            AsyncImage(
                model = photo,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .size(56.dp)
                    .clip(RoundedCornerShape(Dvh.rMd)),
            )
        } else {
            Box(
                modifier = Modifier
                    .size(56.dp)
                    .clip(RoundedCornerShape(Dvh.rMd))
                    .background(Brand.MossSoft),
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Filled.Place, contentDescription = null, tint = Brand.Moss)
            }
        }

        Column(
            modifier = Modifier
                .weight(1f)
                .padding(horizontal = Dvh.s3),
        ) {
            Text(
                spot.name,
                style = MaterialTheme.typography.titleMedium,
                color = Brand.Ink,
            )
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.padding(top = Dvh.s1),
            ) {
                if (spot.rating.count > 0) {
                    Icon(
                        Icons.Filled.Star,
                        contentDescription = null,
                        tint = Brand.Terra,
                        modifier = Modifier.size(14.dp),
                    )
                    Spacer(Modifier.width(4.dp))
                    Text(
                        text = "${"%.1f".format(spot.rating.average.toDouble())} (${spot.rating.count})",
                        style = MaterialTheme.typography.labelSmall,
                        color = Brand.Ink2,
                    )
                }
                val distance = distanceMeters
                if (distance != null) {
                    if (spot.rating.count > 0) {
                        Text(
                            "  ·  ",
                            style = MaterialTheme.typography.labelSmall,
                            color = Brand.Ink2,
                        )
                    }
                    Text(
                        text = formatDistance(distance),
                        style = MaterialTheme.typography.labelSmall,
                        color = Brand.Ink2,
                    )
                }
            }
        }

        Icon(
            Icons.Filled.ChevronRight,
            contentDescription = null,
            tint = Brand.Ink2.copy(alpha = 0.4f),
        )
    }
}

private fun formatDistance(meters: Double): String =
    if (meters >= 1000) "%.1f km".format(meters / 1000.0) else "${meters.toInt()} m"

@Composable
private fun CenterBox(content: @Composable () -> Unit) {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { content() }
}
