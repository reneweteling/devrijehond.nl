package nl.devrijehond.app.ui.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import nl.devrijehond.app.ui.theme.Brand
import nl.devrijehond.app.ui.theme.Dvh

/**
 * Shared building blocks for the Profiel stack. Mirrors the iOS DesignKit pieces
 * (dvhCard, SectionHeader, Avatar, ProfileActionRow) used across ProfileScreen and
 * its sub-screens.
 */

/** Cream rounded surface, the standard card used everywhere in the app. Soft
 *  shadow + hairline border so it lifts off the sand ground, matching iOS. */
fun Modifier.dvhCard(padding: Dp = Dvh.s4): Modifier = this
    .shadow(elevation = 6.dp, shape = RoundedCornerShape(Dvh.rLg), clip = false, spotColor = Brand.Ink)
    .clip(RoundedCornerShape(Dvh.rLg))
    .background(Brand.Cream)
    .border(1.dp, Brand.Ink.copy(alpha = 0.06f), RoundedCornerShape(Dvh.rLg))
    .padding(padding)

@Composable
fun SectionHeader(title: String, modifier: Modifier = Modifier) {
    Text(
        text = title,
        style = MaterialTheme.typography.labelLarge,
        color = Brand.Ink2,
        modifier = modifier.padding(start = Dvh.s1, bottom = Dvh.s1),
    )
}

/** Round avatar: remote image via Coil, or an initial on a moss surface. */
@Composable
fun Avatar(
    url: String?,
    name: String?,
    size: Dp,
    modifier: Modifier = Modifier,
) {
    val shape = CircleShape
    if (!url.isNullOrBlank()) {
        AsyncImage(
            model = url,
            contentDescription = name,
            contentScale = ContentScale.Crop,
            modifier = modifier
                .size(size)
                .clip(shape)
                .background(Brand.MossSoft),
        )
    } else {
        Box(
            modifier = modifier
                .size(size)
                .clip(shape)
                .background(Brand.MossSoft),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = initial(name),
                color = Brand.MossDark,
                fontWeight = FontWeight.Bold,
                fontSize = (size.value * 0.4f).sp,
            )
        }
    }
}

private fun initial(name: String?): String {
    val trimmed = name?.trim().orEmpty()
    return if (trimmed.isEmpty()) "?" else trimmed.first().uppercase()
}

/** Tappable list row with a leading icon, label and a trailing chevron. */
@Composable
fun ProfileActionRow(
    icon: ImageVector,
    label: String,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    tint: androidx.compose.ui.graphics.Color = Brand.Moss,
    labelColor: androidx.compose.ui.graphics.Color = Brand.Ink,
    trailingChevron: Boolean = true,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = Dvh.s4, vertical = Dvh.s4),
    ) {
        Icon(
            icon,
            contentDescription = null,
            tint = tint,
            modifier = Modifier.size(22.dp),
        )
        Spacer(Modifier.width(Dvh.s3))
        Text(label, style = MaterialTheme.typography.bodyLarge, color = labelColor)
        if (trailingChevron && enabled) {
            Spacer(Modifier.weight(1f))
            Icon(
                Icons.Filled.ChevronRight,
                contentDescription = null,
                tint = Brand.Ink2.copy(alpha = 0.4f),
                modifier = Modifier.size(20.dp),
            )
        }
    }
}
