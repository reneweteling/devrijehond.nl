package nl.devrijehond.app.ui

import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import nl.devrijehond.app.R
import nl.devrijehond.app.ui.theme.Brand
import nl.devrijehond.app.ui.theme.Dvh

/**
 * Brand splash, the Android mirror of the iOS SplashView. The real dog logo (uncropped,
 * never circle-masked) on the warm sand ground, with the tagline just below, animated in
 * with a subtle scale-up (0.86 -> 1.0) + fade. The system splash holds the same sand
 * background before this draws, so the hand-off is seamless.
 */
@Composable
fun SplashScreen(modifier: Modifier = Modifier) {
    var appear by remember { mutableStateOf(false) }
    val scale by animateFloatAsState(
        targetValue = if (appear) 1f else 0.86f,
        animationSpec = spring(dampingRatio = 0.75f, stiffness = Spring.StiffnessLow),
        label = "splashScale",
    )
    val contentAlpha by animateFloatAsState(
        targetValue = if (appear) 1f else 0f,
        animationSpec = tween(durationMillis = 450),
        label = "splashAlpha",
    )
    val taglineShift by animateFloatAsState(
        targetValue = if (appear) 0f else 8f,
        animationSpec = spring(dampingRatio = 0.75f, stiffness = Spring.StiffnessLow),
        label = "splashTagline",
    )

    LaunchedEffect(Unit) { appear = true }

    Surface(color = Brand.Sand, modifier = modifier.fillMaxSize()) {
        Column(
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Image(
                painter = painterResource(R.drawable.dvh_logo),
                contentDescription = "De Vrije Hond",
                modifier = Modifier
                    .width(230.dp)
                    .graphicsLayer {
                        scaleX = scale
                        scaleY = scale
                        alpha = contentAlpha
                    },
            )
            Text(
                text = "Honden los, zorgen los.",
                style = MaterialTheme.typography.bodyLarge,
                color = Brand.Ink2,
                modifier = Modifier
                    .padding(top = Dvh.s4)
                    .alpha(contentAlpha)
                    .graphicsLayer { translationY = taglineShift },
            )
        }
    }
}
