package nl.devrijehond.app.ui.spotdetail

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material.icons.outlined.StarBorder
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import nl.devrijehond.app.api.models.Review
import nl.devrijehond.app.api.models.ReportReason
import nl.devrijehond.app.api.models.SpotDetail
import nl.devrijehond.app.api.models.SpotStatus
import nl.devrijehond.app.ui.theme.Brand
import nl.devrijehond.app.ui.theme.Dvh

// MARK: - Amenity chips

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun AmenityChips(detail: SpotDetail) {
    FlowRow(
        horizontalArrangement = Arrangement.spacedBy(Dvh.s2),
        verticalArrangement = Arrangement.spacedBy(Dvh.s2),
    ) {
        detail.amenities.forEach { amenity ->
            Row(
                modifier = Modifier
                    .clip(androidx.compose.foundation.shape.CircleShape)
                    .background(Brand.MossSoft)
                    .padding(horizontal = 10.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Icon(Icons.Filled.Check, contentDescription = null, tint = Brand.MossDark, modifier = Modifier.size(14.dp))
                Text(amenity.label, color = Brand.MossDark, style = MaterialTheme.typography.labelSmall)
            }
        }
    }
}

// MARK: - Review row

@Composable
fun ReviewRow(review: Review) {
    val name = review.author.name ?: review.author.handle ?: "Anoniem"
    Column(
        modifier = Modifier.fillMaxWidth().padding(vertical = Dvh.s2),
        verticalArrangement = Arrangement.spacedBy(Dvh.s2),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Dvh.s2)) {
            Box(
                modifier = Modifier.size(36.dp).clip(CircleShape).background(Brand.MossSoft),
                contentAlignment = Alignment.Center,
            ) {
                Text(name.take(1).uppercase(), color = Brand.MossDark, fontWeight = FontWeight.Bold)
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(name, color = Brand.Ink, fontWeight = FontWeight.SemiBold, style = MaterialTheme.typography.bodyMedium)
                Text(
                    review.createdAt.toLocalDate().toString(),
                    color = Brand.Ink2,
                    style = MaterialTheme.typography.labelSmall,
                )
            }
            StarRow(review.stars.toDouble(), size = 12)
        }
        val body = review.body
        if (!body.isNullOrEmpty()) {
            Text(body, color = Brand.Ink2, style = MaterialTheme.typography.bodyMedium)
        }
        if (review.helpfulCount > 0) {
            Text("${review.helpfulCount}× nuttig", color = Brand.Moss, style = MaterialTheme.typography.labelSmall)
        }
    }
}

// MARK: - Moderation card

private data class ModAction(val label: String, val icon: ImageVector, val status: SpotStatus, val tint: Color)

@Composable
fun ModerationCard(
    currentStatus: String,
    working: Boolean,
    message: String?,
    onEdit: () -> Unit,
    onModerate: (SpotStatus) -> Unit,
) {
    val actions = listOf(
        ModAction("Verifieer", Icons.Filled.Check, SpotStatus.VERIFIED, Brand.Moss),
        ModAction("Herstel", Icons.Filled.Check, SpotStatus.UNVERIFIED, Brand.Ink2),
        ModAction("Verberg", Icons.Filled.VisibilityOff, SpotStatus.HIDDEN, Brand.Terra),
        ModAction("Verwijder", Icons.Filled.Delete, SpotStatus.REMOVED, Brand.Rust),
    )
    DvhCard {
        Text("Moderatie", style = MaterialTheme.typography.titleMedium, color = Brand.Ink)
        Spacer(Modifier.height(Dvh.s3))
        OutlinedButton(
            onClick = onEdit,
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.outlinedButtonColors(contentColor = Brand.MossDark),
        ) {
            Icon(Icons.Filled.Edit, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(Dvh.s2))
            Text("Plek bewerken")
        }
        Spacer(Modifier.height(Dvh.s2))
        // 2x2 grid of actions
        Column(verticalArrangement = Arrangement.spacedBy(Dvh.s2)) {
            actions.chunked(2).forEach { rowActions ->
                Row(horizontalArrangement = Arrangement.spacedBy(Dvh.s2)) {
                    rowActions.forEach { action ->
                        val active = currentStatus == action.status.value
                        OutlinedButton(
                            onClick = { onModerate(action.status) },
                            enabled = !active && !working,
                            modifier = Modifier.weight(1f),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = action.tint),
                        ) {
                            Icon(action.icon, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(Dvh.s1))
                            Text(action.label, style = MaterialTheme.typography.labelSmall)
                        }
                    }
                }
            }
        }
        if (working) {
            Spacer(Modifier.height(Dvh.s2))
            CircularProgressIndicator(color = Brand.Moss, modifier = Modifier.size(20.dp))
        }
        if (message != null) {
            Spacer(Modifier.height(Dvh.s2))
            Text(message, color = Brand.Moss, style = MaterialTheme.typography.labelSmall)
        }
    }
}

// MARK: - Route chooser

@Composable
fun RouteChooserDialog(apps: List<RouteApp>, onPick: (RouteApp) -> Unit, onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Navigeer naar deze plek") },
        text = {
            Column {
                apps.forEach { app ->
                    Text(
                        app.label,
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(Dvh.rSm))
                            .clickable { onPick(app) }
                            .padding(vertical = Dvh.s3),
                        color = Brand.Ink,
                        style = MaterialTheme.typography.bodyLarge,
                    )
                }
            }
        },
        confirmButton = {},
        dismissButton = { TextButton(onClick = onDismiss) { Text("Annuleer") } },
    )
}

// MARK: - Write review

@Composable
fun WriteReviewDialog(
    onSubmit: (stars: Int, body: String?, onResult: (Boolean, String?) -> Unit) -> Unit,
    onDismiss: () -> Unit,
) {
    var rating by remember { mutableIntStateOf(0) }
    var comment by remember { mutableStateOf("") }
    var submitting by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    AlertDialog(
        onDismissRequest = { if (!submitting) onDismiss() },
        title = { Text("Schrijf recensie") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(Dvh.s3)) {
                Text("Jouw beoordeling", color = Brand.Ink, fontWeight = FontWeight.SemiBold)
                Row {
                    for (i in 1..5) {
                        Icon(
                            imageVector = if (i <= rating) Icons.Filled.Star else Icons.Outlined.StarBorder,
                            contentDescription = "$i sterren",
                            tint = Brand.Terra,
                            modifier = Modifier.size(32.dp).clickable { rating = i },
                        )
                    }
                }
                OutlinedTextField(
                    value = comment,
                    onValueChange = { if (it.length <= 4000) comment = it },
                    label = { Text("Reactie (optioneel)") },
                    modifier = Modifier.fillMaxWidth().height(120.dp),
                )
                if (error != null) Text(error!!, color = Brand.Terra, style = MaterialTheme.typography.labelSmall)
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    submitting = true
                    error = null
                    val body = comment.trim().ifEmpty { null }
                    onSubmit(rating, body) { ok, msg ->
                        submitting = false
                        if (ok) onDismiss() else error = msg
                    }
                },
                enabled = rating > 0 && !submitting,
                colors = ButtonDefaults.buttonColors(containerColor = Brand.Moss),
            ) {
                if (submitting) {
                    CircularProgressIndicator(color = Color.White, modifier = Modifier.size(18.dp))
                } else {
                    Text("Verstuur")
                }
            }
        },
        dismissButton = { TextButton(onClick = onDismiss, enabled = !submitting) { Text("Annuleer") } },
    )
}

// MARK: - Report

private fun reasonLabel(reason: ReportReason): String = when (reason) {
    ReportReason.DUPLICATE -> "Dubbele plek"
    ReportReason.SPAM -> "Spam"
    ReportReason.WRONG_INFO -> "Verkeerde informatie"
    ReportReason.INAPPROPRIATE -> "Ongepast"
    ReportReason.OTHER -> "Anders"
}

@Composable
fun ReportDialog(
    onSubmit: (reason: ReportReason, note: String?, onResult: (Boolean, String?) -> Unit) -> Unit,
    onDismiss: () -> Unit,
) {
    var selected by remember { mutableStateOf<ReportReason?>(null) }
    var note by remember { mutableStateOf("") }
    var submitting by remember { mutableStateOf(false) }
    var submitted by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    AlertDialog(
        onDismissRequest = { if (!submitting) onDismiss() },
        title = { Text(if (submitted) "Bedankt!" else "Probleem melden") },
        text = {
            if (submitted) {
                Text("Bedankt, we kijken ernaar.", color = Brand.Ink2)
            } else {
                Column(verticalArrangement = Arrangement.spacedBy(Dvh.s2)) {
                    Text("Wat klopt er niet?", color = Brand.Ink, fontWeight = FontWeight.SemiBold)
                    ReportReason.entries.forEach { reason ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(Dvh.rSm))
                                .clickable { selected = reason }
                                .padding(vertical = Dvh.s2),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(reasonLabel(reason), color = Brand.Ink, modifier = Modifier.weight(1f))
                            if (selected == reason) {
                                Icon(Icons.Filled.Check, contentDescription = null, tint = Brand.Moss)
                            }
                        }
                    }
                    OutlinedTextField(
                        value = note,
                        onValueChange = { note = it },
                        label = { Text("Toelichting (optioneel)") },
                        modifier = Modifier.fillMaxWidth(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text),
                    )
                    if (error != null) Text(error!!, color = Brand.Terra, style = MaterialTheme.typography.labelSmall)
                }
            }
        },
        confirmButton = {
            if (submitted) {
                Button(onClick = onDismiss, colors = ButtonDefaults.buttonColors(containerColor = Brand.Moss)) {
                    Text("Sluiten")
                }
            } else {
                Button(
                    onClick = {
                        val reason = selected ?: return@Button
                        submitting = true
                        error = null
                        onSubmit(reason, note.trim().ifEmpty { null }) { ok, msg ->
                            submitting = false
                            if (ok) submitted = true else error = msg
                        }
                    },
                    enabled = selected != null && !submitting,
                    colors = ButtonDefaults.buttonColors(containerColor = Brand.Terra),
                ) {
                    if (submitting) {
                        CircularProgressIndicator(color = Color.White, modifier = Modifier.size(18.dp))
                    } else {
                        Text("Meld")
                    }
                }
            }
        },
        dismissButton = {
            if (!submitted) TextButton(onClick = onDismiss, enabled = !submitting) { Text("Annuleer") }
        },
    )
}
