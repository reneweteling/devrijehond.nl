package nl.devrijehond.app.ui.map

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Map
import androidx.compose.material.icons.filled.MyLocation
import androidx.compose.material.icons.filled.Public
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import nl.devrijehond.app.ui.theme.Brand
import nl.devrijehond.app.ui.theme.Dvh

/**
 * Bottom-right stacked map controls, mirroring the iOS `mapControls`: a
 * satellite/standard toggle and a locate-me button. Both use the same frosted
 * glass surface as the filter chips and legend. Shared by the Kaart tab
 * (`MapScreen`) and the add-spot geometry editor (`GeometryStep`).
 */
@Composable
fun MapControls(
    isSatellite: Boolean,
    onToggleSatellite: () -> Unit,
    onLocate: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(Dvh.s2),
    ) {
        // Globe when standard (tap to go satellite), map when satellite (tap to return).
        MapControlButton(
            icon = if (isSatellite) Icons.Filled.Map else Icons.Filled.Public,
            contentDescription = if (isSatellite) "Toon standaardkaart" else "Toon satelliet",
            onClick = onToggleSatellite,
        )
        MapControlButton(
            icon = Icons.Filled.MyLocation,
            contentDescription = "Ga naar mijn locatie",
            onClick = onLocate,
        )
    }
}

@Composable
fun MapControlButton(
    icon: ImageVector,
    contentDescription: String,
    onClick: () -> Unit,
) {
    Box(
        modifier = Modifier
            .size(44.dp)
            .shadow(4.dp, RoundedCornerShape(Dvh.rSm), clip = false, spotColor = Brand.Ink)
            .clip(RoundedCornerShape(Dvh.rSm))
            .background(Brand.Cream)
            .border(1.dp, Brand.Ink.copy(alpha = 0.08f), RoundedCornerShape(Dvh.rSm))
            .clickable { onClick() },
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            imageVector = icon,
            contentDescription = contentDescription,
            tint = Brand.MossDark,
            modifier = Modifier.size(22.dp),
        )
    }
}
