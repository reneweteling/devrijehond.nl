package nl.devrijehond.app.ui.addspot

import android.graphics.Bitmap
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AddAPhoto
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import coil.compose.AsyncImage
import com.canhub.cropper.CropImageContract
import com.canhub.cropper.CropImageContractOptions
import com.canhub.cropper.CropImageOptions
import nl.devrijehond.app.ui.theme.Brand
import nl.devrijehond.app.ui.theme.Dvh

/**
 * Step 2: the descriptive form. Mirrors the iOS SpotFormView. Name, category
 * (filtered to the chosen type), description, and for a POI also address + website,
 * amenity chips (filtered to the category), and photos. Photos are picked + square
 * cropped via the cropper contract and uploaded in the background; submit collects
 * the resulting public URLs.
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun FormStep(
    vm: AddSpotViewModel,
    onBack: () -> Unit,
    onSubmit: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val cropLauncher = rememberLauncherForActivityResult(CropImageContract()) { result ->
        if (result.isSuccessful) result.uriContent?.let { vm.addPhoto(it) }
    }
    fun pickPhoto() {
        cropLauncher.launch(
            CropImageContractOptions(
                uri = null,
                cropImageOptions = CropImageOptions(
                    imageSourceIncludeGallery = true,
                    imageSourceIncludeCamera = true,
                    fixAspectRatio = true,
                    aspectRatioX = 1,
                    aspectRatioY = 1,
                    outputCompressFormat = Bitmap.CompressFormat.JPEG,
                    outputCompressQuality = 85,
                ),
            ),
        )
    }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(Brand.Sand)
            .verticalScroll(rememberScrollState())
            .padding(Dvh.s4),
        verticalArrangement = Arrangement.spacedBy(Dvh.s4),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            TextButton(onClick = onBack) { Text("Terug", color = Brand.Moss) }
            Spacer(Modifier.weight(1f))
            Text(
                text = "Gegevens",
                style = MaterialTheme.typography.titleMedium,
                color = Brand.Ink,
            )
            Spacer(Modifier.weight(1f))
            Spacer(Modifier.width(64.dp))
        }

        SectionLabel("Naam")
        OutlinedTextField(
            value = vm.name,
            onValueChange = { if (it.length <= 120) vm.name = it },
            placeholder = { Text(if (vm.isRegion) "Naam van het gebied" else "Naam van de plek") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )

        SectionLabel("Categorie")
        CategoryDropdown(vm)

        SectionLabel("Beschrijving")
        OutlinedTextField(
            value = vm.description,
            onValueChange = { if (it.length <= 4000) vm.description = it },
            placeholder = { Text("Wat is hier leuk voor honden?") },
            minLines = 3,
            modifier = Modifier.fillMaxWidth(),
        )

        if (!vm.isRegion) {
            SectionLabel("Details (optioneel)")
            OutlinedTextField(
                value = vm.address,
                onValueChange = { vm.address = it },
                placeholder = { Text("Adres") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = vm.website,
                onValueChange = { vm.website = it },
                placeholder = { Text("Website") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Uri,
                    imeAction = ImeAction.Done,
                ),
                modifier = Modifier.fillMaxWidth(),
            )
        }

        if (vm.amenities.isNotEmpty()) {
            SectionLabel("Voorzieningen")
            FlowRow(horizontalArrangement = Arrangement.spacedBy(Dvh.s2)) {
                vm.amenities.forEach { amenity ->
                    val selected = vm.selectedAmenities.contains(amenity.id)
                    AmenityChip(
                        label = amenity.label,
                        selected = selected,
                        onClick = { vm.toggleAmenity(amenity.id) },
                    )
                }
            }
        }

        SectionLabel("Foto's")
        PhotoRow(vm = vm, onAdd = ::pickPhoto)

        vm.error?.let {
            Text(it, color = Brand.Rust, style = MaterialTheme.typography.bodyMedium)
        }

        Button(
            onClick = onSubmit,
            enabled = vm.canSubmit,
            colors = ButtonDefaults.buttonColors(
                containerColor = Brand.Moss,
                contentColor = Brand.Cream,
            ),
            modifier = Modifier.fillMaxWidth().height(Dvh.controlHeight),
        ) {
            if (vm.submitting) {
                CircularProgressIndicator(
                    color = Brand.Cream,
                    strokeWidth = 2.dp,
                    modifier = Modifier.size(20.dp),
                )
                Spacer(Modifier.width(Dvh.s2))
            }
            Text("Plek plaatsen", fontWeight = FontWeight.SemiBold)
        }

        Spacer(Modifier.height(Dvh.s6))
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CategoryDropdown(vm: AddSpotViewModel) {
    var expanded by remember { mutableStateOf(false) }
    val options = vm.pickableCategories
    val selectedLabel = options.firstOrNull { it.id == vm.categoryId }?.label ?: ""

    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = !expanded },
    ) {
        OutlinedTextField(
            value = selectedLabel,
            onValueChange = {},
            readOnly = true,
            placeholder = { Text("Kies een categorie") },
            trailingIcon = { Icon(Icons.Filled.ArrowDropDown, contentDescription = null) },
            modifier = Modifier
                .fillMaxWidth()
                .menuAnchor(),
        )
        ExposedDropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false },
        ) {
            options.forEach { category ->
                DropdownMenuItem(
                    text = { Text(category.label) },
                    onClick = {
                        vm.selectCategory(category.id)
                        expanded = false
                    },
                )
            }
        }
    }
}

@Composable
private fun AmenityChip(label: String, selected: Boolean, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .padding(vertical = Dvh.s1)
            .clip(RoundedCornerShape(Dvh.rXl))
            .background(if (selected) Brand.Moss else Brand.MossSoft)
            .clickable(onClick = onClick)
            .padding(horizontal = Dvh.s3, vertical = Dvh.s2),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (selected) {
                Icon(
                    Icons.Filled.Check,
                    contentDescription = null,
                    tint = Brand.Cream,
                    modifier = Modifier.size(16.dp),
                )
                Spacer(Modifier.width(Dvh.s1))
            }
            Text(
                text = label,
                color = if (selected) Brand.Cream else Brand.MossDark,
                style = MaterialTheme.typography.labelLarge,
            )
        }
    }
}

@Composable
private fun PhotoRow(vm: AddSpotViewModel, onAdd: () -> Unit) {
    LazyRow(horizontalArrangement = Arrangement.spacedBy(Dvh.s2)) {
        item {
            Box(
                modifier = Modifier
                    .size(80.dp)
                    .clip(RoundedCornerShape(Dvh.rMd))
                    .background(Brand.MossSoft)
                    .clickable(enabled = vm.photos.size < 10, onClick = onAdd),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    Icons.Filled.AddAPhoto,
                    contentDescription = "Foto toevoegen",
                    tint = Brand.MossDark,
                )
            }
        }
        items(vm.photos, key = { it.id }) { photo ->
            Box(modifier = Modifier.size(80.dp)) {
                AsyncImage(
                    model = photo.localUri,
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier
                        .size(80.dp)
                        .clip(RoundedCornerShape(Dvh.rMd)),
                )
                if (photo.uploading) {
                    Box(
                        modifier = Modifier
                            .size(80.dp)
                            .clip(RoundedCornerShape(Dvh.rMd))
                            .background(Brand.Ink.copy(alpha = 0.35f)),
                        contentAlignment = Alignment.Center,
                    ) {
                        CircularProgressIndicator(color = Brand.Cream, strokeWidth = 2.dp, modifier = Modifier.size(22.dp))
                    }
                } else if (photo.failed) {
                    Box(
                        modifier = Modifier
                            .size(80.dp)
                            .clip(RoundedCornerShape(Dvh.rMd))
                            .background(Brand.Rust.copy(alpha = 0.45f)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(Icons.Filled.ErrorOutline, contentDescription = "Upload mislukt", tint = Brand.Cream)
                    }
                }
                IconButton(
                    onClick = { vm.removePhoto(photo.id) },
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(2.dp)
                        .size(24.dp)
                        .clip(CircleShape)
                        .background(Brand.Ink.copy(alpha = 0.55f)),
                ) {
                    Icon(
                        Icons.Filled.Close,
                        contentDescription = "Verwijder foto",
                        tint = Brand.Cream,
                        modifier = Modifier.size(16.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text = text,
        style = MaterialTheme.typography.labelLarge,
        color = Brand.Ink2,
        fontWeight = FontWeight.SemiBold,
    )
}
