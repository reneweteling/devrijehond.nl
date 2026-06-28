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
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.material3.rememberDatePickerState
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
import nl.devrijehond.app.api.models.CreateDogRequest
import nl.devrijehond.app.api.models.Dog
import nl.devrijehond.app.api.models.UpdateDogRequest
import nl.devrijehond.app.ui.theme.Brand
import nl.devrijehond.app.ui.theme.Dvh
import java.net.URI
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset

class DogEditViewModel : ViewModel() {
    data class UiState(
        val photoUrl: String? = null,
        val uploading: Boolean = false,
        val saving: Boolean = false,
        val deleting: Boolean = false,
        val error: String? = null,
    )

    private val _state = MutableStateFlow(UiState())
    val state: StateFlow<UiState> = _state.asStateFlow()

    fun prefill(dog: Dog?) {
        if (dog != null && _state.value.photoUrl == null) {
            _state.update { it.copy(photoUrl = dog.photoUrl?.toString()) }
        }
    }

    fun uploadPhoto(context: Context, uri: Uri) {
        _state.update { it.copy(uploading = true, error = null) }
        viewModelScope.launch {
            try {
                val part = ImageUpload.squareJpegPart(context, uri)
                val response = AppGraph.api.uploads.apiV1MeUploadsPost(part)
                val body = response.body()
                if (response.isSuccessful && body != null) {
                    _state.update { it.copy(uploading = false, photoUrl = body.publicUrl.toString()) }
                } else {
                    _state.update { it.copy(uploading = false, error = "Foto uploaden mislukt.") }
                }
            } catch (e: Exception) {
                _state.update { it.copy(uploading = false, error = "Foto uploaden mislukt.") }
            }
        }
    }

    fun save(dogId: String?, name: String, breed: String, note: String, birthDate: LocalDate?, onDone: () -> Unit) {
        val photo = _state.value.photoUrl?.let { runCatching { URI(it) }.getOrNull() }
        _state.update { it.copy(saving = true, error = null) }
        viewModelScope.launch {
            try {
                val response = if (dogId == null) {
                    AppGraph.api.dogs.apiV1MeDogsPost(
                        CreateDogRequest(
                            name = name.trim(),
                            breed = breed.trim().ifBlank { null },
                            birthDate = birthDate,
                            photoUrl = photo,
                            note = note.trim().ifBlank { null },
                        ),
                    )
                } else {
                    AppGraph.api.dogs.apiV1MeDogsIdPatch(
                        dogId,
                        UpdateDogRequest(
                            name = name.trim(),
                            breed = breed.trim().ifBlank { null },
                            birthDate = birthDate,
                            photoUrl = photo,
                            note = note.trim().ifBlank { null },
                        ),
                    )
                }
                if (response.isSuccessful) {
                    ProfileGateway.refresh()
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

    fun delete(dogId: String, onDone: () -> Unit) {
        _state.update { it.copy(deleting = true, error = null) }
        viewModelScope.launch {
            try {
                val response = AppGraph.api.dogs.apiV1MeDogsIdDelete(dogId)
                if (response.isSuccessful) {
                    ProfileGateway.refresh()
                    _state.update { it.copy(deleting = false) }
                    onDone()
                } else {
                    _state.update { it.copy(deleting = false, error = "Verwijderen mislukt (status ${response.code()}).") }
                }
            } catch (e: Exception) {
                _state.update { it.copy(deleting = false, error = "Verwijderen mislukt. Probeer het opnieuw.") }
            }
        }
    }
}

/** Add (dogId == null) or edit a dog. Calls [onDone] to navigate back after save/delete. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DogEditScreen(
    dogId: String?,
    onDone: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val vm: DogEditViewModel = viewModel()
    val state by vm.state.collectAsState()
    val context = LocalContext.current
    val dogs = AppGraph.session.profile.collectAsState().value?.dogs ?: emptyList()
    val existing = remember(dogId, dogs) { dogs.firstOrNull { it.id.toString() == dogId } }

    LaunchedEffect(existing) { vm.prefill(existing) }

    var name by remember { mutableStateOf(existing?.name ?: "") }
    var breed by remember { mutableStateOf(existing?.breed ?: "") }
    var note by remember { mutableStateOf(existing?.note ?: "") }
    var birthDate by remember {
        mutableStateOf(existing?.birthDate?.let { runCatching { LocalDate.parse(it) }.getOrNull() })
    }
    var hasBirthDate by remember { mutableStateOf(birthDate != null) }
    var showDatePicker by remember { mutableStateOf(false) }
    var showDeleteConfirm by remember { mutableStateOf(false) }

    val nameTrimmed = name.trim()
    val canSave = nameTrimmed.length in 1..60 && !state.saving && !state.uploading && !state.deleting

    val picker = rememberLauncherForActivityResult(
        ActivityResultContracts.PickVisualMedia(),
    ) { uri: Uri? -> if (uri != null) vm.uploadPhoto(context, uri) }

    val fieldColors = TextFieldDefaults.colors(
        focusedContainerColor = Brand.Cream,
        unfocusedContainerColor = Brand.Cream,
        focusedIndicatorColor = Brand.Moss,
        unfocusedIndicatorColor = Brand.Ink2.copy(alpha = 0.25f),
        cursorColor = Brand.Moss,
    )

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(Brand.Sand)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = Dvh.s4, vertical = Dvh.s5),
        verticalArrangement = Arrangement.spacedBy(Dvh.s5),
    ) {
        Text(
            if (dogId == null) "Hond toevoegen" else "Hond bewerken",
            style = MaterialTheme.typography.titleLarge,
            color = Brand.Ink,
        )

        // Photo
        Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
            Box(
                modifier = Modifier.clickable {
                    picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
                },
                contentAlignment = Alignment.BottomEnd,
            ) {
                Avatar(url = state.photoUrl, name = name.ifBlank { null }, size = 96.dp)
                Box(
                    modifier = Modifier
                        .size(30.dp)
                        .clip(CircleShape)
                        .background(Brand.Moss),
                    contentAlignment = Alignment.Center,
                ) {
                    if (state.uploading) {
                        CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.size(15.dp))
                    } else {
                        Icon(Icons.Filled.PhotoCamera, contentDescription = "Foto wijzigen", tint = Color.White, modifier = Modifier.size(16.dp))
                    }
                }
            }
        }

        Column(modifier = Modifier.dvhCard(), verticalArrangement = Arrangement.spacedBy(Dvh.s4)) {
            OutlinedTextField(
                value = name,
                onValueChange = { if (it.length <= 60) name = it },
                label = { Text("Naam") },
                singleLine = true,
                isError = nameTrimmed.isEmpty(),
                modifier = Modifier.fillMaxWidth(),
                colors = fieldColors,
            )

            OutlinedTextField(
                value = breed,
                onValueChange = { if (it.length <= 80) breed = it },
                label = { Text("Ras (optioneel)") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                colors = fieldColors,
            )

            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                Text("Geboortedatum bekend?", style = MaterialTheme.typography.bodyLarge, color = Brand.Ink, modifier = Modifier.weight(1f))
                Switch(
                    checked = hasBirthDate,
                    onCheckedChange = {
                        hasBirthDate = it
                        if (!it) birthDate = null
                    },
                    colors = SwitchDefaults.colors(checkedTrackColor = Brand.Moss),
                )
            }
            if (hasBirthDate) {
                OutlinedButton(onClick = { showDatePicker = true }, modifier = Modifier.fillMaxWidth()) {
                    Text(birthDate?.toString() ?: "Kies een datum", color = Brand.Moss)
                }
            }

            OutlinedTextField(
                value = note,
                onValueChange = { if (it.length <= 500) note = it },
                label = { Text("Notitie (optioneel)") },
                supportingText = { Text("${note.length}/500", color = Brand.Ink2) },
                minLines = 3,
                modifier = Modifier.fillMaxWidth(),
                colors = fieldColors,
            )
        }

        if (state.error != null) {
            Text(state.error!!, color = Brand.Rust, style = MaterialTheme.typography.bodyMedium)
        }

        Button(
            onClick = { vm.save(dogId, name, breed, note, if (hasBirthDate) birthDate else null, onDone) },
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
            Text(if (dogId == null) "Hond toevoegen" else "Opslaan")
        }

        if (dogId != null) {
            OutlinedButton(
                onClick = { showDeleteConfirm = true },
                enabled = !state.deleting,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(Dvh.controlHeight),
            ) {
                if (state.deleting) {
                    CircularProgressIndicator(color = Brand.Rust, strokeWidth = 2.dp, modifier = Modifier.size(20.dp))
                    Spacer(Modifier.width(Dvh.s2))
                }
                Text("Verwijder hond", color = Brand.Rust)
            }
        }
    }

    if (showDatePicker) {
        val pickerState = rememberDatePickerState(
            initialSelectedDateMillis = birthDate?.atStartOfDay(ZoneOffset.UTC)?.toInstant()?.toEpochMilli(),
        )
        DatePickerDialog(
            onDismissRequest = { showDatePicker = false },
            confirmButton = {
                TextButton(onClick = {
                    pickerState.selectedDateMillis?.let {
                        birthDate = Instant.ofEpochMilli(it).atZone(ZoneOffset.UTC).toLocalDate()
                    }
                    showDatePicker = false
                }) { Text("Kies", color = Brand.Moss) }
            },
            dismissButton = {
                TextButton(onClick = { showDatePicker = false }) { Text("Annuleren", color = Brand.Ink2) }
            },
        ) {
            DatePicker(state = pickerState)
        }
    }

    if (showDeleteConfirm && dogId != null) {
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { showDeleteConfirm = false },
            containerColor = Brand.Cream,
            title = { Text("Hond verwijderen?") },
            text = { Text("Dit kan niet ongedaan worden gemaakt.") },
            confirmButton = {
                TextButton(onClick = {
                    showDeleteConfirm = false
                    vm.delete(dogId, onDone)
                }) { Text("Verwijderen", color = Brand.Rust) }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteConfirm = false }) { Text("Annuleren", color = Brand.Ink2) }
            },
        )
    }
}
