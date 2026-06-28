package nl.devrijehond.app.ui.spotedit

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
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
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import nl.devrijehond.app.api.models.Category
import nl.devrijehond.app.ui.theme.Brand
import nl.devrijehond.app.ui.theme.Dvh
import java.io.ByteArrayOutputStream

/**
 * Edit a spot's descriptive fields + photo. Owner-while-unverified or staff; the
 * server enforces the policy. Geometry is not editable here. On save it PATCHes
 * /api/v1/me/spots/:id, calls [onSaved], then [onBack].
 *
 * @param slug the spot slug (route key).
 * @param onSaved called after a successful save (the presenter should refresh).
 * @param onBack pop this screen (also used after a successful save).
 */
@Composable
fun SpotEditScreen(
    slug: String,
    onSaved: () -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val vm: SpotEditViewModel = viewModel()
    androidx.compose.runtime.LaunchedEffect(slug) { vm.start(slug) }
    val state by vm.state.collectAsState()
    val context = LocalContext.current
    val scope = androidx.compose.runtime.rememberCoroutineScope()

    val photoPicker = rememberLauncherForActivityResult(
        ActivityResultContracts.PickVisualMedia(),
    ) { uri: Uri? ->
        if (uri != null) {
            // Decode + downscale off the main thread, then upload via the VM.
            scope.launch {
                val bytes = withContext(Dispatchers.IO) { decodeScaledJpeg(context, uri) }
                if (bytes != null) vm.uploadPhoto(bytes)
            }
        }
    }

    Column(modifier = modifier.fillMaxSize().background(Brand.Sand)) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Dvh.s2, vertical = Dvh.s1),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Terug", tint = Brand.Ink)
            }
            Text("Plek bewerken", style = MaterialTheme.typography.titleMedium, color = Brand.Ink)
        }

        when {
            state.loading -> Box(Modifier.fillMaxSize(), Alignment.Center) {
                CircularProgressIndicator(color = Brand.Moss)
            }

            state.loadError != null -> Box(Modifier.fillMaxSize(), Alignment.Center) {
                Text(state.loadError!!, color = Brand.Rust)
            }

            else -> EditForm(
                state = state,
                vm = vm,
                onPickPhoto = {
                    photoPicker.launch(
                        PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly),
                    )
                },
                onSave = { vm.save { onSaved(); onBack() } },
            )
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun EditForm(
    state: SpotEditViewModel.UiState,
    vm: SpotEditViewModel,
    onPickPhoto: () -> Unit,
    onSave: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(Dvh.s4),
        verticalArrangement = Arrangement.spacedBy(Dvh.s5),
    ) {
        // Photo
        Column(verticalArrangement = Arrangement.spacedBy(Dvh.s2)) {
            Text("Foto", style = MaterialTheme.typography.titleMedium, color = Brand.Ink)
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(160.dp)
                    .clip(RoundedCornerShape(Dvh.rMd))
                    .background(Brand.MossSoft)
                    .clickable(enabled = !state.uploadingPhoto, onClick = onPickPhoto),
                contentAlignment = Alignment.Center,
            ) {
                val shown = state.uploadedPhotoUrl ?: state.currentPhotoUrl
                if (shown != null) {
                    AsyncImage(
                        model = shown,
                        contentDescription = "Foto",
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Crop,
                    )
                }
                Box(
                    modifier = Modifier
                        .padding(Dvh.s2)
                        .align(Alignment.BottomEnd)
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(Brand.Moss),
                    contentAlignment = Alignment.Center,
                ) {
                    if (state.uploadingPhoto) {
                        CircularProgressIndicator(color = androidx.compose.ui.graphics.Color.White, modifier = Modifier.size(18.dp))
                    } else {
                        Icon(Icons.Filled.PhotoCamera, contentDescription = null, tint = androidx.compose.ui.graphics.Color.White, modifier = Modifier.size(18.dp))
                    }
                }
            }
            Text(
                if (state.uploadingPhoto) "Foto uploaden..." else "Tik om de foto te wijzigen",
                style = MaterialTheme.typography.labelSmall,
                color = Brand.Ink2,
            )
        }

        // Name
        FieldLabel("Naam")
        OutlinedTextField(
            value = state.name,
            onValueChange = vm::setName,
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            placeholder = { Text("Naam van de plek") },
        )

        // Category
        FieldLabel("Categorie")
        CategoryDropdown(
            categories = state.categories,
            selectedId = state.categoryId,
            onSelect = vm::setCategory,
        )

        // Description
        FieldLabel("Beschrijving")
        OutlinedTextField(
            value = state.description,
            onValueChange = vm::setDescription,
            modifier = Modifier.fillMaxWidth().height(120.dp),
        )

        // Address
        FieldLabel("Adres")
        OutlinedTextField(
            value = state.address,
            onValueChange = vm::setAddress,
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
        )

        // Website
        FieldLabel("Website")
        OutlinedTextField(
            value = state.website,
            onValueChange = vm::setWebsite,
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            placeholder = { Text("https://") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
        )

        // Phone
        FieldLabel("Telefoon")
        OutlinedTextField(
            value = state.phone,
            onValueChange = vm::setPhone,
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
        )

        // Amenities
        if (state.amenities.isNotEmpty()) {
            FieldLabel("Voorzieningen")
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(Dvh.s2),
                verticalArrangement = Arrangement.spacedBy(Dvh.s2),
            ) {
                state.amenities.forEach { amenity ->
                    val id = amenity.id.toString()
                    val selected = state.selectedAmenityIds.contains(id)
                    Row(
                        modifier = Modifier
                            .clip(CircleShape)
                            .background(if (selected) Brand.Moss else Brand.MossSoft)
                            .clickable { vm.toggleAmenity(id) }
                            .padding(horizontal = 12.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        if (selected) {
                            Icon(Icons.Filled.Check, contentDescription = null, tint = Brand.Cream, modifier = Modifier.size(14.dp))
                        }
                        Text(
                            amenity.label,
                            color = if (selected) Brand.Cream else Brand.MossDark,
                            style = MaterialTheme.typography.labelSmall,
                        )
                    }
                }
            }
        }

        val saveError = state.saveError
        if (saveError != null) {
            Text(saveError, color = Brand.Rust, style = MaterialTheme.typography.labelSmall)
        }

        Button(
            onClick = onSave,
            enabled = state.canSave,
            modifier = Modifier.fillMaxWidth().height(Dvh.controlHeight),
            colors = ButtonDefaults.buttonColors(containerColor = Brand.Moss),
        ) {
            if (state.saving) {
                CircularProgressIndicator(color = androidx.compose.ui.graphics.Color.White, modifier = Modifier.size(20.dp))
            } else {
                Text("Opslaan")
            }
        }

        Spacer(Modifier.height(Dvh.s8))
    }
}

@Composable
private fun FieldLabel(text: String) {
    Text(text, style = MaterialTheme.typography.titleMedium, color = Brand.Ink)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CategoryDropdown(categories: List<Category>, selectedId: String?, onSelect: (String) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    val selectedLabel = categories.firstOrNull { it.id.toString() == selectedId }?.label ?: "Kies een categorie"

    ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = it }) {
        OutlinedTextField(
            value = selectedLabel,
            onValueChange = {},
            readOnly = true,
            modifier = Modifier
                .fillMaxWidth()
                .menuAnchor(androidx.compose.material3.MenuAnchorType.PrimaryNotEditable),
            trailingIcon = { Icon(Icons.Filled.ArrowDropDown, contentDescription = null) },
        )
        ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            categories.forEach { category ->
                DropdownMenuItem(
                    text = { Text(category.label) },
                    onClick = {
                        onSelect(category.id.toString())
                        expanded = false
                    },
                )
            }
        }
    }
}

// MARK: - Image helper

// MARK: - Image decode

private const val MAX_EDGE = 1280

internal fun decodeScaledJpeg(context: Context, uri: Uri): ByteArray? {
    return try {
        val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() } ?: return null
        val opts = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, opts)
        var sample = 1
        val longest = maxOf(opts.outWidth, opts.outHeight)
        while (longest / sample > MAX_EDGE * 2) sample *= 2
        val decodeOpts = BitmapFactory.Options().apply { inSampleSize = sample }
        val bitmap: Bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size, decodeOpts) ?: return null
        val scale = MAX_EDGE.toFloat() / maxOf(bitmap.width, bitmap.height).toFloat()
        val scaled = if (scale < 1f) {
            Bitmap.createScaledBitmap(bitmap, (bitmap.width * scale).toInt(), (bitmap.height * scale).toInt(), true)
        } else {
            bitmap
        }
        ByteArrayOutputStream().use { out ->
            scaled.compress(Bitmap.CompressFormat.JPEG, 85, out)
            out.toByteArray()
        }
    } catch (e: Exception) {
        null
    }
}
