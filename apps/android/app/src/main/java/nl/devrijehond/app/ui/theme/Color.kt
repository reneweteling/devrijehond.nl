package nl.devrijehond.app.ui.theme

import androidx.compose.ui.graphics.Color

/**
 * De Vrije Hond brand palette. Mirrors the iOS Theme.swift `Brand` enum and the web
 * globals.css: warm, earthy, friendly. The app is light-locked.
 */
object Brand {
    val Moss = Color(0xFF6E7B33)
    val MossDark = Color(0xFF4C5622)
    val MossSoft = Color(0xFFE7E9D5)
    val Cream = Color(0xFFFFFDF7)
    val Sand = Color(0xFFF3EFE3)
    val Terra = Color(0xFFC2762E)
    val Rust = Color(0xFFA33B2D)
    val Ink = Color(0xFF2B3320)
    val Ink2 = Color(0xFF5A6151)

    /** Category slug to marker tint, matching web/iOS category colours. */
    fun categoryColor(slug: String?): Color = when (slug) {
        "off-leash" -> Moss
        "swim-beach" -> Color(0xFFC9A24B)
        "horeca" -> Terra
        "wash" -> Color(0xFF4F7A86)
        "shop" -> Color(0xFF8A6BA0)
        "drinking-point" -> Color(0xFF6E7A82)
        "vet" -> Color(0xFFB5524A)
        else -> Moss
    }
}
