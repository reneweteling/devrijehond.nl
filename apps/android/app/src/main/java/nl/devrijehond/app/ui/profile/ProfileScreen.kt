package nl.devrijehond.app.ui.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Pets
import androidx.compose.material.icons.filled.Place
import androidx.compose.material.icons.filled.PersonAddAlt
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import nl.devrijehond.app.AppGraph
import nl.devrijehond.app.api.models.Dog
import nl.devrijehond.app.api.models.MeProfile
import nl.devrijehond.app.api.models.ModeratorApplicationStatus
import nl.devrijehond.app.ui.theme.Brand
import nl.devrijehond.app.ui.theme.Dvh

/**
 * Profiel tab. Signed-out shows a friendly sign-in CTA; signed-in shows the profile
 * header, dogs, submissions, moderator entry (gated behind a complete profile),
 * About and the account actions. Mirrors the iOS ProfileScreen. All navigation is
 * delegated to lambdas wired by the NavHost owner.
 */
@Composable
fun ProfileScreen(
    onRequireSignIn: () -> Unit,
    onEditProfile: () -> Unit,
    onAddDog: () -> Unit,
    onEditDog: (dogId: String) -> Unit,
    onMySpots: () -> Unit,
    onModeratorApply: () -> Unit,
    onAbout: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val vm: ProfileViewModel = viewModel()
    val state by vm.state.collectAsState()
    val token by AppGraph.session.token.collectAsState()
    val profile by AppGraph.session.profile.collectAsState()

    LaunchedEffect(token) { vm.hydrateIfNeeded() }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Brand.Sand),
    ) {
        when {
            token == null -> SignedOut(onRequireSignIn)
            profile == null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Brand.Moss)
            }
            else -> SignedIn(
                me = profile!!,
                vm = vm,
                modApplicationStatus = state.modApplication?.status,
                modLoaded = state.modLoaded,
                onEditProfile = onEditProfile,
                onAddDog = onAddDog,
                onEditDog = onEditDog,
                onMySpots = onMySpots,
                onModeratorApply = onModeratorApply,
                onAbout = onAbout,
            )
        }
    }
}

@Composable
private fun SignedOut(onRequireSignIn: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(Dvh.s6),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Box(
            modifier = Modifier
                .size(84.dp)
                .clip(CircleShape)
                .background(Brand.MossSoft),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Filled.Pets, contentDescription = null, tint = Brand.Moss, modifier = Modifier.size(40.dp))
        }
        Text(
            "Welkom bij De Vrije Hond",
            style = MaterialTheme.typography.titleLarge,
            color = Brand.Ink,
            modifier = Modifier.padding(top = Dvh.s4),
        )
        Text(
            "Log in om je honden toe te voegen, plekken in te zenden en mee te stemmen.",
            style = MaterialTheme.typography.bodyMedium,
            color = Brand.Ink2,
            modifier = Modifier.padding(top = Dvh.s2),
            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
        )
        Button(
            onClick = onRequireSignIn,
            colors = ButtonDefaults.buttonColors(containerColor = Brand.Moss),
            modifier = Modifier
                .padding(top = Dvh.s5)
                .fillMaxWidth()
                .height(Dvh.controlHeight),
        ) { Text("Inloggen of registreren") }
    }
}

@Composable
private fun SignedIn(
    me: MeProfile,
    vm: ProfileViewModel,
    modApplicationStatus: ModeratorApplicationStatus?,
    modLoaded: Boolean,
    onEditProfile: () -> Unit,
    onAddDog: () -> Unit,
    onEditDog: (String) -> Unit,
    onMySpots: () -> Unit,
    onModeratorApply: () -> Unit,
    onAbout: () -> Unit,
) {
    val state by vm.state.collectAsState()
    var showDeleteConfirm by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = Dvh.s4, vertical = Dvh.s5),
        verticalArrangement = Arrangement.spacedBy(Dvh.s5),
    ) {
        HeaderCard(me)

        OutlinedButton(
            onClick = onEditProfile,
            modifier = Modifier
                .fillMaxWidth()
                .height(Dvh.controlHeight),
        ) { Text("Profiel bewerken", color = Brand.Moss) }

        // Dogs
        Column {
            SectionHeader("Mijn honden")
            Column(modifier = Modifier.dvhCard(padding = 0.dp)) {
                val dogs = me.dogs
                if (dogs.isEmpty()) {
                    Box(Modifier.clickable { onAddDog() }) {
                        ProfileActionRow(Icons.Filled.Add, "Voeg je eerste hond toe")
                    }
                } else {
                    dogs.forEachIndexed { index, dog ->
                        DogRow(dog) { onEditDog(dog.id.toString()) }
                        if (index < dogs.size - 1) {
                            HorizontalDivider(color = Brand.Ink2.copy(alpha = 0.1f))
                        }
                    }
                    HorizontalDivider(color = Brand.Ink2.copy(alpha = 0.1f))
                    Box(Modifier.clickable { onAddDog() }) {
                        ProfileActionRow(Icons.Filled.Add, "Hond toevoegen")
                    }
                }
            }
        }

        // Submissions
        Column {
            SectionHeader("Inzendingen")
            Column(modifier = Modifier.dvhCard(padding = 0.dp)) {
                Box(Modifier.clickable { onMySpots() }) {
                    ProfileActionRow(Icons.Filled.Place, "Mijn inzendingen")
                }
            }
        }

        // Moderation
        Column {
            SectionHeader("Moderatie")
            Column(modifier = Modifier.dvhCard(padding = 0.dp)) {
                ModerationRow(me, modApplicationStatus, modLoaded, onModeratorApply)
            }
        }

        // Footer: About + sign out
        Column(modifier = Modifier.dvhCard(padding = 0.dp)) {
            Box(Modifier.clickable { onAbout() }) {
                ProfileActionRow(Icons.Filled.Info, "Over De Vrije Hond")
            }
            HorizontalDivider(color = Brand.Ink2.copy(alpha = 0.1f))
            Box(Modifier.clickable { AppGraph.session.signOut() }) {
                ProfileActionRow(
                    icon = Icons.AutoMirrored.Filled.Logout,
                    label = "Uitloggen",
                    tint = Brand.Rust,
                    labelColor = Brand.Rust,
                    trailingChevron = false,
                )
            }
        }

        // Danger zone
        Column(modifier = Modifier.dvhCard(padding = 0.dp)) {
            Box(Modifier.clickable(enabled = !state.deleting) { showDeleteConfirm = true }) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = Dvh.s4, vertical = Dvh.s4),
                ) {
                    if (state.deleting) {
                        CircularProgressIndicator(
                            color = Brand.Rust,
                            strokeWidth = 2.dp,
                            modifier = Modifier.size(22.dp),
                        )
                    } else {
                        Icon(Icons.Filled.Delete, contentDescription = null, tint = Brand.Rust, modifier = Modifier.size(22.dp))
                    }
                    Spacer(Modifier.width(Dvh.s3))
                    Text("Account verwijderen", style = MaterialTheme.typography.bodyLarge, color = Brand.Rust)
                }
            }
        }

        if (state.deleteError != null) {
            Text(state.deleteError!!, color = Brand.Rust, style = MaterialTheme.typography.bodyMedium)
        }
    }

    if (showDeleteConfirm) {
        AlertDialog(
            onDismissRequest = { showDeleteConfirm = false },
            containerColor = Brand.Cream,
            title = { Text("Account verwijderen?") },
            text = {
                Text(
                    "Dit verwijdert je account en je gegevens definitief. " +
                        "Dit kan niet ongedaan worden gemaakt.",
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    showDeleteConfirm = false
                    vm.deleteAccount(onDeleted = {})
                }) { Text("Verwijderen", color = Brand.Rust) }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteConfirm = false }) { Text("Annuleren", color = Brand.Ink2) }
            },
        )
    }
}

@Composable
private fun HeaderCard(me: MeProfile) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .dvhCard(padding = Dvh.s5),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Dvh.s3),
    ) {
        Avatar(url = me.image?.toString(), name = me.name ?: me.handle, size = 72.dp)
        Text(
            me.name ?: me.handle ?: "Hondenbaas",
            style = MaterialTheme.typography.titleLarge,
            color = Brand.Ink,
        )
        me.handle?.let {
            Text("@$it", style = MaterialTheme.typography.bodyMedium, color = Brand.Ink2)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(Dvh.s2)) {
            Pill("${me.reputation} punten")
            if (me.isModerator) {
                Pill(if (me.isAdmin) "Beheerder" else "Moderator", icon = Icons.Filled.Verified)
            }
        }
    }
}

@Composable
private fun Pill(text: String, icon: androidx.compose.ui.graphics.vector.ImageVector? = null) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Dvh.s1),
        modifier = Modifier
            .clip(CircleShape)
            .background(Brand.MossSoft)
            .padding(horizontal = Dvh.s3, vertical = Dvh.s2),
    ) {
        if (icon != null) {
            Icon(icon, contentDescription = null, tint = Brand.MossDark, modifier = Modifier.size(16.dp))
        }
        Text(text, style = MaterialTheme.typography.labelLarge, color = Brand.MossDark)
    }
}

@Composable
private fun DogRow(dog: Dog, onClick: () -> Unit) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() }
            .padding(horizontal = Dvh.s4, vertical = Dvh.s3),
    ) {
        Avatar(url = dog.photoUrl?.toString(), name = dog.name, size = 44.dp)
        Spacer(Modifier.width(Dvh.s3))
        Column(modifier = Modifier.weight(1f)) {
            Text(dog.name, style = MaterialTheme.typography.bodyLarge, color = Brand.Ink, fontWeight = FontWeight.Medium)
            dog.breed?.takeIf { it.isNotBlank() }?.let {
                Text(it, style = MaterialTheme.typography.labelSmall, color = Brand.Ink2)
            }
        }
        Icon(
            Icons.Filled.ChevronRight,
            contentDescription = null,
            tint = Brand.Ink2.copy(alpha = 0.4f),
        )
    }
}

@Composable
private fun ModerationRow(
    me: MeProfile,
    status: ModeratorApplicationStatus?,
    modLoaded: Boolean,
    onModeratorApply: () -> Unit,
) {
    when {
        me.isModerator -> Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = Dvh.s4, vertical = Dvh.s4),
        ) {
            Icon(Icons.Filled.Verified, contentDescription = null, tint = Brand.Moss, modifier = Modifier.size(22.dp))
            Spacer(Modifier.width(Dvh.s3))
            Text("Je bent moderator", style = MaterialTheme.typography.bodyLarge, color = Brand.Ink)
        }

        !modLoaded -> Box(Modifier.padding(Dvh.s4)) {
            CircularProgressIndicator(color = Brand.Moss, strokeWidth = 2.dp, modifier = Modifier.size(22.dp))
        }

        status != null -> Box(Modifier.clickable { onModeratorApply() }) {
            val label = when (status) {
                ModeratorApplicationStatus.APPROVED -> "Aanvraag goedgekeurd"
                ModeratorApplicationStatus.REJECTED -> "Aanvraag afgewezen"
                ModeratorApplicationStatus.PENDING -> "Aanvraag wordt bekeken"
            }
            ProfileActionRow(Icons.Filled.Verified, label)
        }

        me.isComplete() -> Box(Modifier.clickable { onModeratorApply() }) {
            ProfileActionRow(Icons.Filled.PersonAddAlt, "Word moderator")
        }

        else -> Column {
            ProfileActionRow(
                icon = Icons.Filled.PersonAddAlt,
                label = "Word moderator",
                enabled = false,
                tint = Brand.Ink2.copy(alpha = 0.4f),
                labelColor = Brand.Ink2.copy(alpha = 0.5f),
                trailingChevron = false,
            )
            Text(
                "Voeg eerst een profielfoto en je naam toe.",
                style = MaterialTheme.typography.labelSmall,
                color = Brand.Ink2,
                modifier = Modifier.padding(start = Dvh.s4, bottom = Dvh.s4, end = Dvh.s4),
            )
        }
    }
}
