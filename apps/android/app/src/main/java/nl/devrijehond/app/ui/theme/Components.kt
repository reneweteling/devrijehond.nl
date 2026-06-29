package nl.devrijehond.app.ui.theme

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.LocalCafe
import androidx.compose.material.icons.filled.LocalHospital
import androidx.compose.material.icons.filled.Pets
import androidx.compose.material.icons.filled.Pool
import androidx.compose.material.icons.filled.Shower
import androidx.compose.material.icons.filled.Storefront
import androidx.compose.material.icons.filled.WaterDrop
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * Shared brand UI helpers, the Android counterpart to the iOS DesignKit. Keeps the
 * card surface, category glyphs and pin colours consistent across every screen so
 * the app reads as one warm, rounded design language (matching the native iOS app).
 */

/** Category slug -> a friendly Material glyph, mirroring the iOS SF Symbol per slug. */
fun categoryIcon(slug: String?): ImageVector = when (slug) {
    "off-leash" -> Icons.Filled.Pets
    "swim-beach" -> Icons.Filled.Pool
    "horeca" -> Icons.Filled.LocalCafe
    "wash" -> Icons.Filled.Shower
    "shop" -> Icons.Filled.Storefront
    "drinking-point" -> Icons.Filled.WaterDrop
    "vet" -> Icons.Filled.LocalHospital
    else -> Icons.Filled.Pets
}

/**
 * The standard cream card surface: generous radius, a soft low-contrast shadow and
 * a hairline border on the warm sand ground. Mirrors iOS `dvhCard`. Apply before
 * any inner padding so the shadow sits under the whole card.
 */
fun Modifier.dvhCard(radius: Dp = Dvh.rLg, padding: Dp = Dvh.s4): Modifier = this
    .shadow(elevation = 6.dp, shape = RoundedCornerShape(radius), clip = false, ambientColor = Brand.Ink, spotColor = Brand.Ink)
    .clip(RoundedCornerShape(radius))
    .background(Brand.Cream)
    .border(1.dp, Brand.Ink.copy(alpha = 0.06f), RoundedCornerShape(radius))
    .padding(padding)

/** Card surface without inner padding, for rows that manage their own spacing. */
fun Modifier.dvhCardSurface(radius: Dp = Dvh.rLg): Modifier = this
    .shadow(elevation = 6.dp, shape = RoundedCornerShape(radius), clip = false, ambientColor = Brand.Ink, spotColor = Brand.Ink)
    .clip(RoundedCornerShape(radius))
    .background(Brand.Cream)
    .border(1.dp, Brand.Ink.copy(alpha = 0.06f), RoundedCornerShape(radius))
