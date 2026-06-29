package nl.devrijehond.app.ui.map

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import nl.devrijehond.app.ui.theme.Brand

/**
 * Custom map markers that mirror the iOS MapKit pins: a teardrop tinted by the
 * category colour (verified) or terracotta (unverified), with the category glyph in
 * white and a soft white outline so it pops over the basemap. Rendered into a
 * bitmap by MarkerComposable, so a viewport full of pins stays cheap.
 */

private val PinWidth = 40.dp
private val PinHeight = 50.dp

/** Bottom tip points at the coordinate: anchor the rasterised bitmap at (0.5, 1.0). */
val SpotPinAnchor = Offset(0.5f, 1.0f)
val ClusterAnchor = Offset(0.5f, 0.5f)

@Composable
fun SpotPin(tint: Color, glyph: ImageVector) {
    Box(
        modifier = Modifier.size(PinWidth, PinHeight),
        contentAlignment = Alignment.TopCenter,
    ) {
        Canvas(modifier = Modifier.size(PinWidth, PinHeight)) {
            val w = size.width
            val r = w / 2f
            val cx = w / 2f
            val cy = r
            val ringStroke = 3.5f

            // Drop shadow (a soft offset circle under the head).
            drawCircle(
                color = Brand.Ink.copy(alpha = 0.18f),
                radius = r - 1f,
                center = Offset(cx, cy + 3f),
            )

            // Pointer triangle from the head down to the tip.
            val tail = Path().apply {
                moveTo(cx - r * 0.46f, cy + r * 0.42f)
                lineTo(cx, size.height - 1f)
                lineTo(cx + r * 0.46f, cy + r * 0.42f)
                close()
            }
            drawPath(tail, Color.White)
            drawPath(
                Path().apply {
                    moveTo(cx - r * 0.34f, cy + r * 0.42f)
                    lineTo(cx, size.height - ringStroke - 1f)
                    lineTo(cx + r * 0.34f, cy + r * 0.42f)
                    close()
                },
                tint,
            )

            // White ring + coloured head.
            drawCircle(color = Color.White, radius = r, center = Offset(cx, cy))
            drawCircle(color = tint, radius = r - ringStroke, center = Offset(cx, cy))
        }

        Icon(
            imageVector = glyph,
            contentDescription = null,
            tint = Color.White,
            modifier = Modifier
                .padding(top = 11.dp)
                .size(18.dp),
        )
    }
}

@Composable
fun ClusterBubble(count: Int) {
    val size = when {
        count >= 100 -> 52.dp
        count >= 20 -> 46.dp
        else -> 40.dp
    }
    Box(
        modifier = Modifier.size(size + 8.dp),
        contentAlignment = Alignment.Center,
    ) {
        Canvas(modifier = Modifier.size(size + 8.dp)) {
            val c = Offset(this.size.width / 2f, this.size.height / 2f)
            val r = size.toPx() / 2f
            drawCircle(Brand.Ink.copy(alpha = 0.18f), radius = r, center = c.copy(y = c.y + 3f))
            drawCircle(Color.White, radius = r, center = c)
            drawCircle(Brand.Moss, radius = r - 3f, center = c)
            // faint outer halo ring like the iOS cluster
            drawCircle(Brand.Moss.copy(alpha = 0.22f), radius = r + 4f, center = c, style = Stroke(width = 4f))
        }
        Text(
            text = count.toString(),
            color = Color.White,
            fontWeight = FontWeight.ExtraBold,
            fontSize = if (count >= 100) 15.sp else 16.sp,
        )
    }
}
