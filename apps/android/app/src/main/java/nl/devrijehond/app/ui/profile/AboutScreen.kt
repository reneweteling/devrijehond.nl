package nl.devrijehond.app.ui.profile

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.OpenInNew
import androidx.compose.material.icons.filled.Code
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.Policy
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import nl.devrijehond.app.BuildConfig
import nl.devrijehond.app.ui.theme.Brand
import nl.devrijehond.app.ui.theme.Dvh

/** About + maker card, mirroring the iOS AboutView. Read-only info and outbound links. */
@Composable
fun AboutScreen(modifier: Modifier = Modifier) {
    val context = LocalContext.current
    fun open(url: String) {
        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(Brand.Sand)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = Dvh.s4, vertical = Dvh.s5),
        verticalArrangement = Arrangement.spacedBy(Dvh.s5),
    ) {
        // Hero
        Column(modifier = Modifier.dvhCard(), verticalArrangement = Arrangement.spacedBy(Dvh.s1)) {
            Text("De Vrije Hond", style = MaterialTheme.typography.titleLarge, color = Brand.Ink)
            Text(
                "Versie ${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})",
                style = MaterialTheme.typography.labelSmall,
                color = Brand.Ink2,
            )
        }

        // Intro
        Column(modifier = Modifier.dvhCard(), verticalArrangement = Arrangement.spacedBy(Dvh.s2)) {
            Text("Wat is De Vrije Hond?", style = MaterialTheme.typography.titleMedium, color = Brand.Ink)
            Text(
                "Een community-kaart van hondvriendelijke plekken in Nederland: losloopgebieden, " +
                    "hondenstranden, hondvriendelijke horeca, waterpunten en meer. Toegevoegd en " +
                    "geverifieerd door hondenbazen zelf. De community houdt zichzelf op orde: je " +
                    "stemt plekken naar geverifieerd, en moderators uit de community springen bij " +
                    "waar nodig.",
                style = MaterialTheme.typography.bodyMedium,
                color = Brand.Ink2,
            )
        }

        // Maker card
        Column(modifier = Modifier.dvhCard(), verticalArrangement = Arrangement.spacedBy(Dvh.s3)) {
            Text("Gemaakt door", style = MaterialTheme.typography.titleMedium, color = Brand.Ink)
            Column {
                Text("René Weteling", style = MaterialTheme.typography.bodyLarge, color = Brand.Ink, fontWeight = FontWeight.SemiBold)
                Text("Felobo B.V.", style = MaterialTheme.typography.labelSmall, color = Brand.Ink2)
            }
            Text(
                "Van idee tot productie: web, mobiel en AI. Deze app is van begin tot eind door mij " +
                    "gebouwd. Zelf een app, platform of AI-oplossing nodig? Ik help je graag.",
                style = MaterialTheme.typography.bodyMedium,
                color = Brand.Ink2,
            )
            Button(
                onClick = { open("https://www.weteling.com") },
                colors = ButtonDefaults.buttonColors(containerColor = Brand.Moss),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(Dvh.controlHeight),
            ) {
                Icon(Icons.AutoMirrored.Filled.OpenInNew, contentDescription = null, tint = Color.White, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(Dvh.s2))
                Text("Bekijk weteling.com")
            }
            Text(
                "Of mail rene@weteling.com",
                style = MaterialTheme.typography.bodyMedium,
                color = Brand.Moss,
                fontWeight = FontWeight.SemiBold,
                textAlign = TextAlign.Center,
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { open("mailto:rene@weteling.com") },
            )
        }

        // Contact links
        Column(modifier = Modifier.dvhCard(padding = 0.dp)) {
            LinkRow(Icons.Filled.Language, "Website", "devrijehond.nl") { open("https://devrijehond.nl") }
            HorizontalDivider(color = Brand.Ink2.copy(alpha = 0.1f))
            LinkRow(Icons.Filled.Code, "Open source, bouw mee", "github.com/reneweteling/devrijehond.nl") {
                open("https://github.com/reneweteling/devrijehond.nl")
            }
            HorizontalDivider(color = Brand.Ink2.copy(alpha = 0.1f))
            LinkRow(Icons.Filled.Email, "Contact", "info@devrijehond.nl") { open("mailto:info@devrijehond.nl") }
        }

        // Legal links
        Column(modifier = Modifier.dvhCard(padding = 0.dp)) {
            LinkRow(Icons.Filled.Policy, "Gebruiksvoorwaarden", null) { open("https://devrijehond.nl/terms") }
            HorizontalDivider(color = Brand.Ink2.copy(alpha = 0.1f))
            LinkRow(Icons.Filled.Policy, "Privacybeleid", null) { open("https://devrijehond.nl/privacy") }
        }

        Text(
            "Gebouwd met liefde voor honden en hun baasjes.",
            style = MaterialTheme.typography.labelSmall,
            color = Brand.Ink2.copy(alpha = 0.6f),
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

@Composable
private fun LinkRow(icon: ImageVector, label: String, detail: String?, onClick: () -> Unit) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() }
            .padding(horizontal = Dvh.s4, vertical = Dvh.s3),
    ) {
        Icon(icon, contentDescription = null, tint = Brand.Moss, modifier = Modifier.size(20.dp))
        Spacer(Modifier.width(Dvh.s3))
        Column(modifier = Modifier.weight(1f)) {
            Text(label, style = MaterialTheme.typography.bodyLarge, color = Brand.Ink)
            if (detail != null) {
                Text(detail, style = MaterialTheme.typography.labelSmall, color = Brand.Ink2)
            }
        }
        Icon(Icons.AutoMirrored.Filled.OpenInNew, contentDescription = null, tint = Brand.Ink2.copy(alpha = 0.5f), modifier = Modifier.size(18.dp))
    }
}
