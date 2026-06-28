package nl.devrijehond.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import nl.devrijehond.app.ui.theme.Brand
import nl.devrijehond.app.ui.theme.Dvh

/**
 * Generic stub used by the not-yet-built tabs (Nabij, Toevoegen, Wensen, Profiel).
 * Each will be replaced by a full screen by a follow-up agent. See the report's
 * "how to add a screen" section.
 */
@Composable
fun PlaceholderScreen(
    title: String,
    message: String,
    icon: ImageVector,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .background(Brand.Sand)
            .padding(Dvh.s6),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        androidx.compose.foundation.layout.Box(
            modifier = Modifier
                .size(84.dp)
                .clip(CircleShape)
                .background(Brand.MossSoft),
            contentAlignment = Alignment.Center,
        ) {
            Icon(icon, contentDescription = null, tint = Brand.Moss, modifier = Modifier.size(40.dp))
        }
        Text(
            text = title,
            style = MaterialTheme.typography.titleLarge,
            color = Brand.Ink,
            modifier = Modifier
                .padding(top = Dvh.s4)
                .clip(RoundedCornerShape(Dvh.rSm)),
        )
        Text(
            text = message,
            style = MaterialTheme.typography.bodyMedium,
            color = Brand.Ink2,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = Dvh.s2),
        )
    }
}
