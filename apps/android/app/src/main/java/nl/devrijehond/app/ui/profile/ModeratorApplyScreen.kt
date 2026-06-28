package nl.devrijehond.app.ui.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material.icons.filled.Cancel
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import nl.devrijehond.app.AppGraph
import nl.devrijehond.app.api.models.ApplyModeratorRequest
import nl.devrijehond.app.api.models.ModeratorApplicationStatus
import nl.devrijehond.app.ui.theme.Brand
import nl.devrijehond.app.ui.theme.Dvh

class ModeratorApplyViewModel : ViewModel() {
    data class UiState(
        val loading: Boolean = true,
        val status: ModeratorApplicationStatus? = null,
        val submitting: Boolean = false,
        val submitted: Boolean = false,
        val error: String? = null,
    )

    private val _state = MutableStateFlow(UiState())
    val state: StateFlow<UiState> = _state.asStateFlow()

    init {
        load()
    }

    fun load() {
        _state.update { it.copy(loading = true) }
        viewModelScope.launch {
            val status = try {
                val response = AppGraph.api.moderator.apiV1MeModeratorApplicationGet()
                if (response.isSuccessful) response.body()?.application?.status else null
            } catch (e: Exception) {
                null
            }
            _state.update { it.copy(loading = false, status = status) }
        }
    }

    fun submit(motivation: String) {
        _state.update { it.copy(submitting = true, error = null) }
        viewModelScope.launch {
            try {
                val response = AppGraph.api.moderator.apiV1MeModeratorApplicationPost(
                    ApplyModeratorRequest(motivation = motivation.trim()),
                )
                when {
                    response.isSuccessful -> _state.update {
                        it.copy(submitting = false, submitted = true, status = response.body()?.status)
                    }
                    response.code() == 409 -> _state.update {
                        it.copy(submitting = false, error = "Je hebt al een aanmelding ingediend.")
                    }
                    else -> _state.update {
                        it.copy(submitting = false, error = "Indienen mislukt (status ${response.code()}).")
                    }
                }
            } catch (e: Exception) {
                _state.update { it.copy(submitting = false, error = "Indienen mislukt. Probeer het opnieuw.") }
            }
        }
    }
}

/** Apply to become a moderator, or view the status of an existing application. */
@Composable
fun ModeratorApplyScreen(modifier: Modifier = Modifier) {
    val vm: ModeratorApplyViewModel = viewModel()
    val state by vm.state.collectAsState()

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Brand.Sand),
    ) {
        when {
            state.loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Brand.Moss)
            }

            state.submitted -> StatusCard(
                icon = Icons.Filled.CheckCircle,
                color = Brand.Moss,
                title = "Aanmelding ingediend",
                body = "We beoordelen je aanvraag en laten het weten. Bedankt voor je betrokkenheid.",
            )

            state.status != null -> {
                val status = state.status!!
                StatusCard(
                    icon = statusIcon(status),
                    color = statusColor(status),
                    title = statusTitle(status),
                    body = statusBody(status),
                )
            }

            else -> ApplyForm(
                submitting = state.submitting,
                error = state.error,
                onSubmit = vm::submit,
            )
        }
    }
}

@Composable
private fun ApplyForm(
    submitting: Boolean,
    error: String?,
    onSubmit: (String) -> Unit,
) {
    var motivation by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf("") }
    val trimmed = motivation.trim()
    val canSubmit = trimmed.length >= 10 && !submitting

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = Dvh.s4, vertical = Dvh.s5),
        verticalArrangement = Arrangement.spacedBy(Dvh.s4),
    ) {
        Column(modifier = Modifier.dvhCard(), verticalArrangement = Arrangement.spacedBy(Dvh.s2)) {
            Text("Word moderator", style = MaterialTheme.typography.titleLarge, color = Brand.Ink)
            Text(
                "Moderatoren helpen de kaart schoon te houden: ze beoordelen gemelde of " +
                    "betwiste plekken. Vertel ons waarom je moderator wilt worden en wat je " +
                    "bijdrage aan de community is.",
                style = MaterialTheme.typography.bodyMedium,
                color = Brand.Ink2,
            )
        }

        OutlinedTextField(
            value = motivation,
            onValueChange = { if (it.length <= 1000) motivation = it },
            label = { Text("Motivatie") },
            supportingText = { Text("${trimmed.length}/1000", color = Brand.Ink2) },
            minLines = 5,
            modifier = Modifier.fillMaxWidth(),
            colors = TextFieldDefaults.colors(
                focusedContainerColor = Brand.Cream,
                unfocusedContainerColor = Brand.Cream,
                focusedIndicatorColor = Brand.Moss,
                unfocusedIndicatorColor = Brand.Ink2.copy(alpha = 0.25f),
                cursorColor = Brand.Moss,
            ),
        )

        if (trimmed.isNotEmpty() && trimmed.length < 10) {
            Text("Vul minstens 10 tekens in.", color = Brand.Terra, style = MaterialTheme.typography.labelSmall)
        }
        if (error != null) {
            Text(error, color = Brand.Rust, style = MaterialTheme.typography.bodyMedium)
        }

        Button(
            onClick = { onSubmit(motivation) },
            enabled = canSubmit,
            colors = ButtonDefaults.buttonColors(containerColor = Brand.Moss),
            modifier = Modifier
                .fillMaxWidth()
                .height(Dvh.controlHeight),
        ) {
            if (submitting) {
                CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(Dvh.s2))
            }
            Text("Aanmelding indienen")
        }
    }
}

@Composable
private fun StatusCard(icon: ImageVector, color: Color, title: String, body: String) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(Dvh.s4),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .dvhCard(padding = Dvh.s6),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(Dvh.s3),
        ) {
            Box(
                modifier = Modifier
                    .size(72.dp)
                    .clip(CircleShape)
                    .background(color.copy(alpha = 0.15f)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(34.dp))
            }
            Text(title, style = MaterialTheme.typography.titleLarge, color = Brand.Ink)
            Text(body, style = MaterialTheme.typography.bodyMedium, color = Brand.Ink2, textAlign = TextAlign.Center)
        }
    }
}

private fun statusColor(status: ModeratorApplicationStatus): Color = when (status) {
    ModeratorApplicationStatus.APPROVED -> Brand.Moss
    ModeratorApplicationStatus.REJECTED -> Brand.Rust
    ModeratorApplicationStatus.PENDING -> Brand.Terra
}

private fun statusIcon(status: ModeratorApplicationStatus): ImageVector = when (status) {
    ModeratorApplicationStatus.APPROVED -> Icons.Filled.Verified
    ModeratorApplicationStatus.REJECTED -> Icons.Filled.Cancel
    ModeratorApplicationStatus.PENDING -> Icons.Filled.Schedule
}

private fun statusTitle(status: ModeratorApplicationStatus): String = when (status) {
    ModeratorApplicationStatus.APPROVED -> "Je bent moderator"
    ModeratorApplicationStatus.REJECTED -> "Aanvraag afgewezen"
    ModeratorApplicationStatus.PENDING -> "Aanvraag in behandeling"
}

private fun statusBody(status: ModeratorApplicationStatus): String = when (status) {
    ModeratorApplicationStatus.APPROVED -> "Je aanvraag is goedgekeurd. Je kunt nu plekken verifiëren en beheren."
    ModeratorApplicationStatus.REJECTED -> "Je aanvraag is helaas afgewezen. Neem contact op als je vragen hebt."
    ModeratorApplicationStatus.PENDING -> "Je aanvraag wordt bekeken. We nemen contact op zodra er een beslissing is."
}
