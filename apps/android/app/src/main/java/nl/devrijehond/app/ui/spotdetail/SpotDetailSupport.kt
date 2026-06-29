package nl.devrijehond.app.ui.spotdetail

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.LocationManager
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.outlined.StarBorder
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import nl.devrijehond.app.api.models.GeoPoint
import nl.devrijehond.app.api.models.SpotStatus
import nl.devrijehond.app.api.models.SpotType
import nl.devrijehond.app.ui.theme.Brand
import nl.devrijehond.app.ui.theme.Dvh
import java.math.BigDecimal

// MARK: - Status labels + colours

/** Dutch label for the status pill, matching the iOS copy. */
fun statusLabel(status: String): String = when (status) {
    SpotStatus.VERIFIED.value -> "Geverifieerd"
    SpotStatus.HIDDEN.value -> "Verborgen"
    SpotStatus.REMOVED.value -> "Verwijderd"
    else -> "Niet geverifieerd"
}

fun statusDescription(status: String): String = when (status) {
    SpotStatus.VERIFIED.value -> "Deze plek is geverifieerd door de community."
    SpotStatus.HIDDEN.value -> "Deze plek is verborgen."
    SpotStatus.REMOVED.value -> "Deze plek is verwijderd."
    else -> "Nog niet bevestigd door de community."
}

private fun statusColor(status: String): Color = when (status) {
    SpotStatus.VERIFIED.value -> Brand.Moss
    SpotStatus.HIDDEN.value -> Brand.Terra
    SpotStatus.REMOVED.value -> Brand.Rust
    else -> Brand.Ink2
}

// MARK: - Small composables

@Composable
fun StatusPill(status: String, modifier: Modifier = Modifier) {
    val color = statusColor(status)
    Box(
        modifier = modifier
            .background(color.copy(alpha = 0.15f), androidx.compose.foundation.shape.CircleShape)
            .padding(horizontal = Dvh.s3, vertical = Dvh.s1 + 1.dp),
    ) {
        Text(
            text = statusLabel(status),
            style = MaterialTheme.typography.labelSmall,
            color = color,
        )
    }
}

/** Net-score progress, clamped 0..5 (verify threshold is +5). */
@Composable
fun VoteProgressBar(netScore: BigDecimal, modifier: Modifier = Modifier) {
    val fraction = (netScore.toFloat().coerceIn(0f, 5f)) / 5f
    Box(
        modifier = modifier
            .background(Brand.Ink.copy(alpha = 0.08f), RoundedCornerShape(2.dp)),
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidthFraction(fraction)
                .background(Brand.Moss, RoundedCornerShape(2.dp))
                .padding(2.dp),
        )
    }
}

/** Inline star rating, read-only. */
@Composable
fun StarRow(value: Double, size: Int = 14, modifier: Modifier = Modifier) {
    Row(modifier = modifier) {
        for (i in 1..5) {
            val filled = value >= i - 0.25
            Icon(
                imageVector = if (filled) Icons.Filled.Star else Icons.Outlined.StarBorder,
                contentDescription = null,
                tint = Brand.Terra,
                modifier = Modifier.size(size.dp).padding(end = 1.dp),
            )
        }
    }
}

// MARK: - Location proof (best-effort)

/**
 * Last known device location as a [GeoPoint], or null when we have no permission
 * or no cached fix. Best-effort proximity proof for a vote; the server still
 * decides whether it falls inside the proximity gate.
 */
fun lastKnownLocation(context: Context): GeoPoint? {
    val granted = ContextCompat.checkSelfPermission(
        context, Manifest.permission.ACCESS_FINE_LOCATION,
    ) == PackageManager.PERMISSION_GRANTED || ContextCompat.checkSelfPermission(
        context, Manifest.permission.ACCESS_COARSE_LOCATION,
    ) == PackageManager.PERMISSION_GRANTED
    if (!granted) return null
    val lm = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager ?: return null
    return try {
        val providers = lm.getProviders(true)
        val best = providers
            .mapNotNull { runCatching { lm.getLastKnownLocation(it) }.getOrNull() }
            .maxByOrNull { it.time }
        best?.let { GeoPoint(lat = BigDecimal.valueOf(it.latitude), lng = BigDecimal.valueOf(it.longitude)) }
    } catch (e: SecurityException) {
        null
    }
}

// MARK: - Intents

/** Public web URL for sharing / universal links. */
fun spotWebUrl(slug: String, type: SpotType): String {
    val kind = if (type == SpotType.REGION) "gebied" else "plek"
    return "https://www.devrijehond.nl/$kind/$slug"
}

fun isPackageInstalled(context: Context, pkg: String): Boolean = try {
    context.packageManager.getPackageInfo(pkg, 0)
    true
} catch (e: PackageManager.NameNotFoundException) {
    false
}

fun shareSpot(context: Context, name: String, url: String) {
    val send = Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"
        putExtra(Intent.EXTRA_SUBJECT, name)
        putExtra(Intent.EXTRA_TEXT, url)
    }
    context.startActivity(Intent.createChooser(send, "Deel deze plek"))
}

fun openDialer(context: Context, phone: String) {
    val digits = buildString {
        phone.forEachIndexed { index, c ->
            if (c.isDigit() || (c == '+' && index == 0)) append(c)
        }
    }
    if (digits.isEmpty()) return
    runCatching {
        context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:$digits")))
    }
}

fun openWebsite(context: Context, website: String) {
    val url = if (website.startsWith("http://") || website.startsWith("https://")) website else "https://$website"
    runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
}

fun openAddressInMaps(context: Context, address: String) {
    val encoded = Uri.encode(address)
    runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("geo:0,0?q=$encoded"))) }
}

/** The route targets the chooser exposes, given which apps are installed. */
enum class RouteApp(val label: String) {
    GOOGLE_MAPS("Google Maps"),
    WAZE("Waze"),
    OTHER("Andere kaarten-app"),
}

fun availableRouteApps(context: Context): List<RouteApp> = buildList {
    add(RouteApp.GOOGLE_MAPS)
    if (isPackageInstalled(context, "com.waze")) add(RouteApp.WAZE)
    add(RouteApp.OTHER)
}

fun openRoute(context: Context, app: RouteApp, lat: Double, lng: Double, name: String) {
    val intent = when (app) {
        RouteApp.GOOGLE_MAPS -> Intent(
            Intent.ACTION_VIEW, Uri.parse("google.navigation:q=$lat,$lng"),
        ).apply { setPackage("com.google.android.apps.maps") }

        RouteApp.WAZE -> Intent(
            Intent.ACTION_VIEW, Uri.parse("waze://?ll=$lat,$lng&navigate=yes"),
        ).apply { setPackage("com.waze") }

        RouteApp.OTHER -> Intent(
            Intent.ACTION_VIEW, Uri.parse("geo:$lat,$lng?q=$lat,$lng(${Uri.encode(name)})"),
        )
    }
    val result = runCatching { context.startActivity(intent) }
    // Google Maps not installed: fall back to a generic geo: chooser.
    if (result.isFailure && app == RouteApp.GOOGLE_MAPS) {
        runCatching {
            context.startActivity(
                Intent(Intent.ACTION_VIEW, Uri.parse("geo:$lat,$lng?q=$lat,$lng(${Uri.encode(name)})")),
            )
        }
    }
}

// MARK: - tiny layout helper

/** Width fraction modifier without pulling in fillMaxWidth(fraction) edge cases. */
private fun Modifier.fillMaxWidthFraction(fraction: Float): Modifier =
    this.then(Modifier.fillMaxWidth(fraction.coerceIn(0f, 1f)))
