package nl.devrijehond.app.ui.profile

import android.content.Context
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PhotoCamera
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
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
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
import nl.devrijehond.app.api.models.MeProfilePatch
import nl.devrijehond.app.ui.theme.Brand
import nl.devrijehond.app.ui.theme.Dvh
import java.net.URI

private val HANDLE_REGEX = Regex("^[a-z0-9_]{3,30}$")

class EditProfileViewModel : ViewModel() {
    data class UiState(
        val imageUrl: String? = null,
        val uploading: Boolean = false,
        val saving: Boolean = false,
        val error: String? = null,
    )

    private val _state = MutableStateFlow(UiState(imageUrl = AppGraph.session.profile.value?.image?.toString()))
    val state: StateFlow<UiState> = _state.asStateFlow()

    fun uploadAvatar(context: Context, uri: Uri) {
        _state.update { it.copy(uploading = true, error = null) }
        viewModelScope.launch {
            try {
                val part = ImageUpload.squareJpegPart(context, uri)
                val response = AppGraph.api.uploads.apiV1MeUploadsPost(part)
                val body = response.body()
                if (response.isSuccessful && body != null) {
                    _state.update { it.copy(uploading = false, imageUrl = body.publicUrl.toString()) }
                } else {
                    _state.update { it.copy(uploading = false, error = "Foto uploaden mislukt.") }
                }
            } catch (e: Exception) {
                _state.update { it.copy(uploading = false, error = "Foto uploaden mislukt.") }
            }
        }
    }

    fun save(name: String, handle: String, bio: String, onDone: () -> Unit) {
        val nameTrimmed = name.trim()
        val handleTrimmed = handle.trim()
        val bioTrimmed = bio.trim()
        _state.update { it.copy(saving = true, error = null) }
        viewModelScope.launch {
            try {
                val patch = MeProfilePatch(
                    name = nameTrimmed.ifBlank { null },
                    handle = handleTrimmed.ifBlank { null },
                    bio = bioTrimmed.ifBlank { null },
                    image = _state.value.imageUrl?.let { runCatching { URI(it) }.getOrNull() },
                )
                val response = AppGraph.api.me.apiV1MePatch(patch)
                val updated = response.body()
                if (response.isSuccessful && updated != null) {
                    AppGraph.session.setProfile(updated)
                    _state.update { it.copy(saving = false) }
                    onDone()
                } else {
                    _state.update { it.copy(saving = false, error = "Opslaan mislukt (status ${response.code()}).") }
                }
            } catch (e: Exception) {
                _state.update { it.copy(saving = false, error = "Opslaan mislukt. Probeer het opnieuw.") }
            }
        }
    }
}

/** Edit name, handle, bio and avatar. Calls [onDone] (navigate back) on a successful save. */
@Composable
fun EditProfileScreen(
    onDone: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val vm: EditProfileViewModel = viewModel()
    val state by vm.state.collectAsState()
    val context = LocalContext.current
    val me = AppGraph.session.profile.collectAsState().value

    var name by remember { mutableStateOf(me?.name ?: "") }
    var handle by remember { mutableStateOf(me?.handle ?: "") }
    var bio by remember { mutableStateOf(me?.bio ?: "") }

    val handleValid = handle.trim().isEmpty() || HANDLE_REGEX.matches(handle.trim())
    val canSave = !state.saving && !state.uploading && handleValid

    val picker = rememberLauncherForActivityResult(
        ActivityResultContracts.PickVisualMedia(),
    ) { uri: Uri? -> if (uri != null) vm.uploadAvatar(context, uri) }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(Brand.Sand)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = Dvh.s4, vertical = Dvh.s5),
        verticalArrangement = Arrangement.spacedBy(Dvh.s5),
    ) {
        Text("Profiel bewerken", style = MaterialTheme.typography.titleLarge, color = Brand.Ink)

        // Avatar
        Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
            Box(
                modifier = Modifier.clickable {
                    picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
                },
                contentAlignment = Alignment.BottomEnd,
            ) {
                Avatar(url = state.imageUrl, name = name.ifBlank { me?.name }, size = 88.dp)
                Box(
                    modifier = Modifier
                        .size(28.dp)
                        .clip(CircleShape)
                        .background(Brand.Moss),
                    contentAlignment = Alignment.Center,
                ) {
                    if (state.uploading) {
                        CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.size(14.dp))
                    } else {
                        Icon(Icons.Filled.PhotoCamera, contentDescription = "Foto wijzigen", tint = Color.White, modifier = Modifier.size(15.dp))
                    }
                }
            }
        }

        val fieldColors = TextFieldDefaults.colors(
            focusedContainerColor = Brand.Cream,
            unfocusedContainerColor = Brand.Cream,
            focusedIndicatorColor = Brand.Moss,
            unfocusedIndicatorColor = Brand.Ink2.copy(alpha = 0.25f),
            cursorColor = Brand.Moss,
        )

        Column(modifier = Modifier.dvhCard(), verticalArrangement = Arrangement.spacedBy(Dvh.s4)) {
            OutlinedTextField(
                value = name,
                onValueChange = { if (it.length <= 80) name = it },
                label = { Text("Naam") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                colors = fieldColors,
            )

            OutlinedTextField(
                value = handle,
                onValueChange = { v ->
                    val cleaned = v.lowercase().filter { it.isLetterOrDigit() || it == '_' }.take(30)
                    handle = cleaned
                },
                label = { Text("Gebruikersnaam") },
                prefix = { Text("@") },
                singleLine = true,
                isError = !handleValid,
                supportingText = if (!handleValid) {
                    { Text("Gebruik 3-30 letters, cijfers of underscores.", color = Brand.Rust) }
                } else null,
                modifier = Modifier.fillMaxWidth(),
                colors = fieldColors,
            )

            OutlinedTextField(
                value = bio,
                onValueChange = { if (it.length <= 280) bio = it },
                label = { Text("Bio") },
                supportingText = { Text("${bio.length}/280", color = Brand.Ink2) },
                minLines = 3,
                modifier = Modifier.fillMaxWidth(),
                colors = fieldColors,
            )
        }

        if (state.error != null) {
            Text(state.error!!, color = Brand.Rust, style = MaterialTheme.typography.bodyMedium)
        }

        Button(
            onClick = { vm.save(name, handle, bio, onDone) },
            enabled = canSave,
            colors = ButtonDefaults.buttonColors(containerColor = Brand.Moss),
            modifier = Modifier
                .fillMaxWidth()
                .height(Dvh.controlHeight),
        ) {
            if (state.saving) {
                CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(Dvh.s2))
            }
            Text("Opslaan")
        }
    }
}
