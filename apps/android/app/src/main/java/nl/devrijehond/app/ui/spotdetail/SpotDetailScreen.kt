package nl.devrijehond.app.ui.spotdetail

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Flag
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.Navigation
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.Place
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.ThumbDown
import androidx.compose.material.icons.filled.ThumbUp
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import nl.devrijehond.app.AppGraph
import nl.devrijehond.app.api.models.SpotDetail
import nl.devrijehond.app.api.models.SpotStatus
import nl.devrijehond.app.api.models.UserRole
import nl.devrijehond.app.api.models.VoteValue
import nl.devrijehond.app.ui.theme.Brand
import nl.devrijehond.app.ui.theme.Dvh

/**
 * Spot detail. Loads the full detail + reviews for [slug], shows the community
 * verification state, and exposes the authed actions (vote, review, report,
 * route, share, edit, moderate). After a vote / moderation / edit the detail
 * reloads and [onChanged] fires so the presenter (map / list) can refresh.
 *
 * @param slug the spot slug (route key).
 * @param onChanged called after a vote, moderation or edit changed the spot.
 * @param onEdit open the editor for this slug (owner-while-unverified or staff).
 * @param onBack pop this screen.
 */
@Composable
fun SpotDetailScreen(
    slug: String,
    onChanged: () -> Unit,
    onEdit: (String) -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val vm: SpotDetailViewModel = viewModel()
    androidx.compose.runtime.LaunchedEffect(slug) { vm.start(slug) }
    val state by vm.state.collectAsState()
    val profile by AppGraph.session.profile.collectAsState()
    val isAuthenticated = AppGraph.session.token.collectAsState().value != null

    val context = LocalContext.current

    // Best-effort location proof: ask once, keep the latest fix for the vote.
    var proofGranted by remember { mutableStateOf(false) }
    val permLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { result -> proofGranted = result.values.any { it } }
    androidx.compose.runtime.LaunchedEffect(Unit) {
        permLauncher.launch(
            arrayOf(
                android.Manifest.permission.ACCESS_FINE_LOCATION,
                android.Manifest.permission.ACCESS_COARSE_LOCATION,
            ),
        )
    }

    var showRouteChooser by remember { mutableStateOf(false) }
    var showReview by remember { mutableStateOf(false) }
    var showReport by remember { mutableStateOf(false) }
    var showRemoveConfirm by remember { mutableStateOf(false) }

    val detail = state.detail
    val status = state.effectiveStatus
    val role = profile?.role
    val isStaff = role == UserRole.ADMIN || role == UserRole.MODERATOR
    val isOwner = profile?.id != null && detail?.submittedBy?.id == profile?.id
    val canEdit = isStaff || (isOwner && status == SpotStatus.UNVERIFIED.value)
    val canVote = isAuthenticated && detail != null && !isOwner && status == SpotStatus.UNVERIFIED.value

    Column(modifier = modifier.fillMaxSize().background(Brand.Sand)) {
        // Top bar (back + share)
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Dvh.s2, vertical = Dvh.s1),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Terug", tint = Brand.Ink)
            }
            Spacer(Modifier.weight(1f))
            if (detail != null) {
                IconButton(onClick = {
                    shareSpot(context, detail.name, spotWebUrl(detail.slug, detail.type))
                }) {
                    Icon(Icons.Filled.Share, contentDescription = "Deel", tint = Brand.Ink)
                }
            }
        }

        when {
            state.loading && detail == null -> Box(Modifier.fillMaxSize(), Alignment.Center) {
                CircularProgressIndicator(color = Brand.Moss)
            }

            detail == null -> Box(Modifier.fillMaxSize(), Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(state.error ?: "Kon de plek niet laden.", color = Brand.Rust)
                    Button(onClick = vm::load, modifier = Modifier.padding(top = Dvh.s3)) {
                        Text("Opnieuw")
                    }
                }
            }

            else -> DetailBody(
                detail = detail,
                state = state,
                status = status,
                isStaff = isStaff,
                isOwner = isOwner,
                canEdit = canEdit,
                canVote = canVote,
                isAuthenticated = isAuthenticated,
                onRoute = { showRouteChooser = true },
                onEdit = { onEdit(detail.slug) },
                onVote = { value ->
                    val proof = if (proofGranted) lastKnownLocation(context) else null
                    vm.vote(value, proof, onChanged)
                },
                onWriteReview = { showReview = true },
                onReport = { showReport = true },
                onModerate = { newStatus ->
                    if (newStatus == SpotStatus.REMOVED) showRemoveConfirm = true
                    else vm.moderate(newStatus, onChanged)
                },
            )
        }
    }

    // Route chooser
    val lat = detail?.lat
    val lng = detail?.lng
    if (showRouteChooser && detail != null && lat != null && lng != null) {
        RouteChooserDialog(
            apps = availableRouteApps(context),
            onPick = { app ->
                openRoute(context, app, lat.toDouble(), lng.toDouble(), detail.name)
                showRouteChooser = false
            },
            onDismiss = { showRouteChooser = false },
        )
    }

    // Write review
    if (showReview) {
        WriteReviewDialog(
            onSubmit = { stars, body, onResult -> vm.submitReview(stars, body, onResult) },
            onDismiss = { showReview = false },
        )
    }

    // Report
    if (showReport) {
        ReportDialog(
            onSubmit = { reason, note, onResult -> vm.submitReport(reason, note, onResult) },
            onDismiss = { showReport = false },
        )
    }

    // Remove confirm (staff)
    if (showRemoveConfirm) {
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { showRemoveConfirm = false },
            title = { Text("Plek verwijderen?") },
            text = { Text("Dit verwijdert de plek uit de community-kaart. Weet je het zeker?") },
            confirmButton = {
                Button(
                    onClick = {
                        showRemoveConfirm = false
                        vm.moderate(SpotStatus.REMOVED, onChanged)
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Brand.Rust),
                ) { Text("Verwijderen") }
            },
            dismissButton = {
                OutlinedButton(onClick = { showRemoveConfirm = false }) { Text("Annuleer") }
            },
        )
    }
}

@Composable
private fun DetailBody(
    detail: SpotDetail,
    state: SpotDetailViewModel.UiState,
    status: String,
    isStaff: Boolean,
    isOwner: Boolean,
    canEdit: Boolean,
    canVote: Boolean,
    isAuthenticated: Boolean,
    onRoute: () -> Unit,
    onEdit: () -> Unit,
    onVote: (VoteValue) -> Unit,
    onWriteReview: () -> Unit,
    onReport: () -> Unit,
    onModerate: (SpotStatus) -> Unit,
) {
    val context = LocalContext.current
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState()),
    ) {
        HeroPhoto(detail)

        Column(
            modifier = Modifier.padding(Dvh.s4),
            verticalArrangement = Arrangement.spacedBy(Dvh.s5),
        ) {
            // Title block
            Column(verticalArrangement = Arrangement.spacedBy(Dvh.s2)) {
                Text(detail.name, style = MaterialTheme.typography.titleLarge, color = Brand.Ink)
                Text(detail.category.label, style = MaterialTheme.typography.bodyMedium, color = Brand.Ink2)
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Dvh.s3)) {
                    StatusPill(status)
                    if (detail.rating.count > 0) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            StarRow(detail.rating.average.toDouble(), size = 13)
                            Text(
                                " (${detail.rating.count})",
                                style = MaterialTheme.typography.labelSmall,
                                color = Brand.Ink2,
                            )
                        }
                    }
                }
            }

            // Route + share row
            Row(horizontalArrangement = Arrangement.spacedBy(Dvh.s2)) {
                if (detail.lat != null && detail.lng != null) {
                    SecondaryButton(
                        label = "Route",
                        icon = Icons.Filled.Navigation,
                        modifier = Modifier.weight(1f),
                        onClick = onRoute,
                    )
                }
                SecondaryButton(
                    label = "Deel",
                    icon = Icons.Filled.Share,
                    modifier = Modifier.weight(1f),
                    onClick = { shareSpot(context, detail.name, spotWebUrl(detail.slug, detail.type)) },
                )
            }

            // Edit (owners get it here; staff get it in the moderation card)
            if (canEdit && !isStaff) {
                SecondaryButton(
                    label = "Bewerken",
                    icon = Icons.Filled.Edit,
                    modifier = Modifier.fillMaxWidth(),
                    onClick = onEdit,
                )
            }

            // Description
            val description = detail.description?.let { stripHtml(it) }
            if (!description.isNullOrEmpty()) {
                Text(description, style = MaterialTheme.typography.bodyLarge, color = Brand.Ink2)
            }

            // Community-check card
            DvhCard {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Dvh.s2)) {
                    StatusPill(status)
                    Text(statusDescription(status), style = MaterialTheme.typography.labelSmall, color = Brand.Ink2)
                }
                val result = state.voteResult
                if (result != null) {
                    Spacer(Modifier.height(Dvh.s2))
                    Row(horizontalArrangement = Arrangement.spacedBy(Dvh.s4), verticalAlignment = Alignment.CenterVertically) {
                        Text("✓ ${result.confirmCount}", color = Brand.Moss, style = MaterialTheme.typography.labelLarge)
                        Text("✗ ${result.denyCount}", color = Brand.Terra, style = MaterialTheme.typography.labelLarge)
                        Text(
                            "Score: ${result.netScore.toInt()}",
                            color = Brand.Ink2,
                            style = MaterialTheme.typography.labelSmall,
                        )
                    }
                    Spacer(Modifier.height(Dvh.s2))
                    VoteProgressBar(result.netScore, modifier = Modifier.fillMaxWidth().height(4.dp))
                }
            }

            // Vote section
            VoteSection(
                state = state,
                status = status,
                isOwner = isOwner,
                canVote = canVote,
                isAuthenticated = isAuthenticated,
                onVote = onVote,
            )

            // Amenities
            if (detail.amenities.isNotEmpty()) {
                Column(verticalArrangement = Arrangement.spacedBy(Dvh.s2)) {
                    SectionHeader("Voorzieningen")
                    AmenityChips(detail)
                }
            }

            // POI info
            PoiInfo(detail)

            // Reviews
            ReviewsSection(state = state, onWriteReview = onWriteReview)

            // Report
            ReportRow(onReport = onReport)

            // Moderation card (staff only)
            if (isStaff) {
                ModerationCard(
                    currentStatus = status,
                    working = state.moderating,
                    message = state.moderationMessage,
                    onEdit = onEdit,
                    onModerate = onModerate,
                )
            }

            Spacer(Modifier.height(Dvh.s8))
        }
    }
}

@Composable
private fun HeroPhoto(detail: SpotDetail) {
    val url = detail.photos.firstOrNull()?.url?.toString()
    Box(
        modifier = Modifier.fillMaxWidth().height(240.dp).background(Brand.MossSoft),
        contentAlignment = Alignment.Center,
    ) {
        if (url != null) {
            AsyncImage(
                model = url,
                contentDescription = detail.name,
                modifier = Modifier.fillMaxSize(),
                contentScale = androidx.compose.ui.layout.ContentScale.Crop,
            )
        } else {
            Icon(
                Icons.Filled.Place,
                contentDescription = null,
                tint = Brand.MossDark,
                modifier = Modifier.size(52.dp),
            )
        }
    }
}

@Composable
private fun VoteSection(
    state: SpotDetailViewModel.UiState,
    status: String,
    isOwner: Boolean,
    canVote: Boolean,
    isAuthenticated: Boolean,
    onVote: (VoteValue) -> Unit,
) {
    val result = state.voteResult
    when {
        result != null -> DvhCard {
            val confirmed = result.vote.value == VoteValue.CONFIRM
            Text(
                if (confirmed) "Je hebt deze plek bevestigd" else "Je hebt deze plek afgewezen",
                color = if (confirmed) Brand.MossDark else Brand.Terra,
                fontWeight = FontWeight.Medium,
            )
            Text(
                if (result.vote.proximityVerified) "Je was in de buurt, dus je stem telt extra mee."
                else "Je stem is geteld. (Niet in de buurt: halve weging.)",
                style = MaterialTheme.typography.labelSmall,
                color = Brand.Ink2,
            )
        }

        isOwner -> DvhCard {
            Text(
                "Dit is jouw plek. Anderen bevestigen hem.",
                style = MaterialTheme.typography.labelSmall,
                color = Brand.Ink2,
            )
        }

        status == SpotStatus.UNVERIFIED.value && !isAuthenticated -> DvhCard {
            Text(
                "Log in om deze plek te bevestigen of af te wijzen.",
                style = MaterialTheme.typography.labelSmall,
                color = Brand.Ink2,
            )
        }

        canVote -> DvhCard {
            Text("Ken je deze plek?", style = MaterialTheme.typography.titleMedium, color = Brand.Ink)
            Spacer(Modifier.height(Dvh.s3))
            Row(horizontalArrangement = Arrangement.spacedBy(Dvh.s2)) {
                Button(
                    onClick = { onVote(VoteValue.CONFIRM) },
                    enabled = !state.voting,
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.buttonColors(containerColor = Brand.Moss),
                ) {
                    Icon(Icons.Filled.ThumbUp, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(Dvh.s2))
                    Text("Bevestigen")
                }
                Button(
                    onClick = { onVote(VoteValue.DENY) },
                    enabled = !state.voting,
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.buttonColors(containerColor = Brand.Terra),
                ) {
                    Icon(Icons.Filled.ThumbDown, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(Dvh.s2))
                    Text("Afwijzen")
                }
            }
            if (state.voting) {
                Spacer(Modifier.height(Dvh.s2))
                CircularProgressIndicator(color = Brand.Moss, modifier = Modifier.size(20.dp))
            }
            val voteError = state.voteError
            if (voteError != null) {
                Spacer(Modifier.height(Dvh.s2))
                Text(voteError, color = Brand.Terra, style = MaterialTheme.typography.labelSmall)
            }
        }
    }
}

@Composable
private fun PoiInfo(detail: SpotDetail) {
    val context = LocalContext.current
    val address = detail.address
    val phone = detail.phone
    val website = detail.website?.toString()
    if (address.isNullOrEmpty() && phone.isNullOrEmpty() && website.isNullOrEmpty()) return

    DvhCard {
        if (!address.isNullOrEmpty()) {
            InfoRow(Icons.Filled.Place, address, Brand.Ink2) { openAddressInMaps(context, address) }
        }
        if (!phone.isNullOrEmpty()) {
            InfoRow(Icons.Filled.Phone, phone, Brand.Moss) { openDialer(context, phone) }
        }
        if (!website.isNullOrEmpty()) {
            InfoRow(Icons.Filled.Language, "Website", Brand.Moss) { openWebsite(context, website) }
        }
    }
}

@Composable
private fun InfoRow(icon: ImageVector, text: String, tint: androidx.compose.ui.graphics.Color, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(Dvh.rSm))
            .androidxClickable(onClick)
            .padding(vertical = Dvh.s2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Dvh.s2),
    ) {
        Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(18.dp))
        Text(text, color = tint, style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
private fun ReviewsSection(state: SpotDetailViewModel.UiState, onWriteReview: () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(Dvh.s3)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("Recensies", style = MaterialTheme.typography.titleMedium, color = Brand.Ink)
            Spacer(Modifier.weight(1f))
            Text(
                "Schrijf recensie",
                color = Brand.Moss,
                style = MaterialTheme.typography.labelLarge,
                modifier = Modifier.clip(RoundedCornerShape(Dvh.rSm)).androidxClickable(onWriteReview).padding(Dvh.s1),
            )
        }
        if (state.reviews.isEmpty()) {
            Text("Nog geen recensies.", color = Brand.Ink2, style = MaterialTheme.typography.bodyMedium)
        } else {
            DvhCard {
                state.reviews.forEachIndexed { index, review ->
                    ReviewRow(review)
                    if (index != state.reviews.lastIndex) {
                        androidx.compose.material3.HorizontalDivider(color = Brand.Ink.copy(alpha = 0.08f))
                    }
                }
            }
        }
    }
}

@Composable
private fun ReportRow(onReport: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(Dvh.rSm))
            .androidxClickable(onReport)
            .padding(vertical = Dvh.s2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Dvh.s2),
    ) {
        Icon(Icons.Filled.Flag, contentDescription = null, tint = Brand.Ink2, modifier = Modifier.size(18.dp))
        Text("Probleem melden", color = Brand.Ink2, style = MaterialTheme.typography.bodyMedium)
    }
}

// MARK: - Reusable bits

@Composable
private fun SectionHeader(title: String) {
    Text(title, style = MaterialTheme.typography.titleMedium, color = Brand.Ink)
}

@Composable
private fun SecondaryButton(label: String, icon: ImageVector, modifier: Modifier = Modifier, onClick: () -> Unit) {
    OutlinedButton(
        onClick = onClick,
        modifier = modifier,
        colors = ButtonDefaults.outlinedButtonColors(contentColor = Brand.MossDark),
    ) {
        Icon(icon, contentDescription = null, modifier = Modifier.size(18.dp))
        Spacer(Modifier.width(Dvh.s2))
        Text(label)
    }
}

@Composable
fun DvhCard(content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(Dvh.rMd))
            .background(Brand.Cream)
            .padding(Dvh.s4),
        content = content,
    )
}

private fun stripHtml(s: String): String =
    s.replace(Regex("<[^>]+>"), " ").replace("&nbsp;", " ").trim()

/** Local clickable wrapper for compact call sites. */
private fun Modifier.androidxClickable(onClick: () -> Unit): Modifier =
    this.clickable(onClick = onClick)
