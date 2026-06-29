package nl.devrijehond.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import nl.devrijehond.app.R

// Spacing scale (mirrors DVH.s* in the iOS DesignKit): 4/8/12/16/20/24/32.
object Dvh {
    val s1 = 4.dp
    val s2 = 8.dp
    val s3 = 12.dp
    val s4 = 16.dp
    val s5 = 20.dp
    val s6 = 24.dp
    val s8 = 32.dp

    // Radii: 10/14/20/28.
    val rSm = 10.dp
    val rMd = 14.dp
    val rLg = 20.dp
    val rXl = 28.dp

    val controlHeight = 52.dp
}

private val DvhColorScheme = lightColorScheme(
    primary = Brand.Moss,
    onPrimary = Brand.Cream,
    primaryContainer = Brand.MossSoft,
    onPrimaryContainer = Brand.MossDark,
    secondary = Brand.Terra,
    onSecondary = Brand.Cream,
    tertiary = Brand.Terra,
    error = Brand.Rust,
    background = Brand.Sand,
    onBackground = Brand.Ink,
    surface = Brand.Cream,
    onSurface = Brand.Ink,
    surfaceVariant = Brand.MossSoft,
    onSurfaceVariant = Brand.Ink2,
    outline = Brand.Ink2,
)

// Nunito (bundled variable font) is the Android stand-in for the iOS "SF Rounded"
// system face: a warm, humanist, rounded sans that matches the brand voice. One
// variable .ttf serves every weight via FontVariation, so the type scale below
// reads as the same friendly family as iOS instead of stock Roboto.
@OptIn(androidx.compose.ui.text.ExperimentalTextApi::class)
private fun nunito(weight: FontWeight, axis: Int) = Font(
    R.font.nunito,
    weight = weight,
    variationSettings = FontVariation.Settings(FontVariation.weight(axis)),
)

private val Rounded = FontFamily(
    nunito(FontWeight.Normal, 400),
    nunito(FontWeight.Medium, 500),
    nunito(FontWeight.SemiBold, 600),
    nunito(FontWeight.Bold, 700),
    nunito(FontWeight.ExtraBold, 800),
)

private val DvhTypography = Typography(
    displaySmall = TextStyle(
        fontFamily = Rounded, fontWeight = FontWeight.ExtraBold, fontSize = 30.sp,
        letterSpacing = (-0.5).sp,
    ),
    headlineMedium = TextStyle(
        fontFamily = Rounded, fontWeight = FontWeight.ExtraBold, fontSize = 24.sp,
        letterSpacing = (-0.3).sp,
    ),
    titleLarge = TextStyle(
        fontFamily = Rounded, fontWeight = FontWeight.Bold, fontSize = 22.sp,
        letterSpacing = (-0.2).sp,
    ),
    titleMedium = TextStyle(fontFamily = Rounded, fontWeight = FontWeight.Bold, fontSize = 17.sp),
    bodyLarge = TextStyle(fontFamily = Rounded, fontWeight = FontWeight.Normal, fontSize = 16.sp),
    bodyMedium = TextStyle(fontFamily = Rounded, fontWeight = FontWeight.Normal, fontSize = 15.sp),
    labelLarge = TextStyle(fontFamily = Rounded, fontWeight = FontWeight.SemiBold, fontSize = 14.sp),
    labelSmall = TextStyle(fontFamily = Rounded, fontWeight = FontWeight.SemiBold, fontSize = 12.sp),
)

private val DvhShapes = Shapes(
    small = RoundedCornerShape(Dvh.rSm),
    medium = RoundedCornerShape(Dvh.rMd),
    large = RoundedCornerShape(Dvh.rLg),
)

@Composable
fun DeVrijeHondTheme(
    // Light-locked on purpose: the brand identity is light-mode only, matching iOS.
    @Suppress("UNUSED_PARAMETER") darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = DvhColorScheme,
        typography = DvhTypography,
        shapes = DvhShapes,
        content = content,
    )
}
