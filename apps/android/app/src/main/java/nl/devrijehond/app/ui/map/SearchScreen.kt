package nl.devrijehond.app.ui.map

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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Map
import androidx.compose.material.icons.filled.Place
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import nl.devrijehond.app.AppGraph
import nl.devrijehond.app.api.models.Category
import nl.devrijehond.app.api.models.GeocodeHit
import nl.devrijehond.app.ui.theme.Brand
import nl.devrijehond.app.ui.theme.Dvh
import nl.devrijehond.app.ui.theme.categoryIcon

/**
 * Full-screen search surface for the Kaart tab, mirroring the iOS `SearchView`.
 *
 * Two result sources, like iOS:
 *  - "Locaties": geocoded addresses/areas from GET /api/v1/geocode, debounced as
 *    you type (~300 ms, min 2 chars).
 *  - "In onze gids": a client-side name/category filter over the spots already
 *    loaded in the map viewport ([spots]).
 *
 * Picking a location recenters the map camera (handled by the caller via
 * [onSelectPlace]); picking a spot opens its detail sheet (via [onSelectSpot]).
 *
 * @param spots the map's currently loaded items, filtered offline by name.
 * @param categoriesById category lookup for labels + glyphs in the spot rows.
 * @param onSelectPlace called with (lat, lng) when a geocode hit is chosen.
 * @param onSelectSpot called with the spot slug when a guide hit is chosen.
 * @param onClose dismiss the search surface without a selection.
 */
@Composable
fun MapSearchScreen(
    spots: List<MapItemDto>,
    categoriesById: Map<String, Category>,
    onSelectPlace: (Double, Double) -> Unit,
    onSelectSpot: (String) -> Unit,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var query by remember { mutableStateOf("") }
    var geocodeResults by remember { mutableStateOf<List<GeocodeHit>>(emptyList()) }
    var isSearching by remember { mutableStateOf(false) }
    val focusRequester = remember { FocusRequester() }

    val trimmed = query.trim()

    // Instant client-side filter over the already-loaded spots (name or category).
    val spotResults = remember(query, spots, categoriesById) {
        val q = trimmed.lowercase()
        if (q.length < 2) {
            emptyList()
        } else {
            spots.asSequence()
                .filter { it.position != null }
                .filter { item ->
                    item.name.lowercase().contains(q) ||
                        (categoriesById[item.categoryId]?.label?.lowercase()?.contains(q) == true)
                }
                .distinctBy { it.id }
                .take(20)
                .toList()
        }
    }

    // Debounced geocode lookup. Skips under 2 chars and clears stale results.
    LaunchedEffect(query) {
        val q = query.trim()
        if (q.length < 2) {
            geocodeResults = emptyList()
            isSearching = false
            return@LaunchedEffect
        }
        isSearching = true
        delay(300)
        try {
            val resp = AppGraph.api.geocode.apiV1GeocodeGet(q)
            geocodeResults = if (resp.isSuccessful) resp.body()?.items.orEmpty() else emptyList()
        } catch (_: Exception) {
            // Network error: keep the local spot filter usable, just no locations.
            geocodeResults = emptyList()
        } finally {
            isSearching = false
        }
    }

    LaunchedEffect(Unit) { focusRequester.requestFocus() }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(Brand.Sand),
    ) {
        // Header: close affordance + search field, mirroring the iOS search bar.
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Dvh.s1),
            modifier = Modifier
                .fillMaxWidth()
                .padding(start = Dvh.s2, end = Dvh.s3, top = Dvh.s2, bottom = Dvh.s2),
        ) {
            IconButton(onClick = onClose) {
                Icon(
                    imageVector = Icons.Filled.Close,
                    contentDescription = "Sluiten",
                    tint = Brand.MossDark,
                )
            }
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                placeholder = { Text("Zoek een plek, gebied of adres", color = Brand.Ink2) },
                leadingIcon = {
                    Icon(Icons.Filled.Search, contentDescription = null, tint = Brand.Moss)
                },
                trailingIcon = {
                    if (query.isNotEmpty()) {
                        IconButton(onClick = { query = "" }) {
                            Icon(Icons.Filled.Close, contentDescription = "Wissen", tint = Brand.Ink2)
                        }
                    }
                },
                singleLine = true,
                shape = CircleShape,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = Brand.Cream,
                    unfocusedContainerColor = Brand.Cream,
                    focusedBorderColor = Brand.Moss,
                    unfocusedBorderColor = Brand.Ink.copy(alpha = 0.10f),
                ),
                keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
                    imeAction = ImeAction.Search,
                ),
                modifier = Modifier
                    .weight(1f)
                    .focusRequester(focusRequester),
            )
        }

        when {
            isSearching && geocodeResults.isEmpty() && spotResults.isEmpty() -> LoadingState()
            trimmed.length < 2 -> HintState()
            geocodeResults.isEmpty() && spotResults.isEmpty() -> NoResultsState(query)
            else -> ResultsList(
                geocodeResults = geocodeResults,
                spotResults = spotResults,
                categoriesById = categoriesById,
                onSelectPlace = onSelectPlace,
                onSelectSpot = onSelectSpot,
            )
        }
    }
}

@Composable
private fun ResultsList(
    geocodeResults: List<GeocodeHit>,
    spotResults: List<MapItemDto>,
    categoriesById: Map<String, Category>,
    onSelectPlace: (Double, Double) -> Unit,
    onSelectSpot: (String) -> Unit,
) {
    LazyColumn(modifier = Modifier.fillMaxSize()) {
        if (geocodeResults.isNotEmpty()) {
            item { SectionHeader("Locaties") }
            items(geocodeResults, key = { "geo_${it.label}_${it.lat}_${it.lng}" }) { hit ->
                GeoRow(hit) { onSelectPlace(hit.lat.toDouble(), hit.lng.toDouble()) }
            }
        }
        if (spotResults.isNotEmpty()) {
            item { SectionHeader("In onze gids") }
            items(spotResults, key = { "spot_${it.id}" }) { spot ->
                SpotRow(spot, categoriesById[spot.categoryId]) { onSelectSpot(spot.slug) }
            }
        }
        item { Spacer(Modifier.height(Dvh.s6)) }
    }
}

@Composable
private fun SectionHeader(title: String) {
    Text(
        text = title,
        style = MaterialTheme.typography.labelSmall,
        color = Brand.Ink2,
        modifier = Modifier.padding(horizontal = Dvh.s4, vertical = Dvh.s2),
    )
}

@Composable
private fun GeoRow(hit: GeocodeHit, onClick: () -> Unit) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Dvh.s3),
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() }
            .padding(horizontal = Dvh.s4, vertical = Dvh.s3),
    ) {
        Box(
            modifier = Modifier
                .size(40.dp)
                .clip(CircleShape)
                .background(Brand.MossSoft),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Filled.Place, contentDescription = null, tint = Brand.Terra, modifier = Modifier.size(22.dp))
        }
        Text(
            text = hit.label,
            style = MaterialTheme.typography.bodyLarge,
            color = Brand.Ink,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f),
        )
    }
}

@Composable
private fun SpotRow(spot: MapItemDto, category: Category?, onClick: () -> Unit) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Dvh.s3),
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() }
            .padding(horizontal = Dvh.s4, vertical = Dvh.s3),
    ) {
        Box(
            modifier = Modifier
                .size(40.dp)
                .clip(RoundedCornerShape(Dvh.rSm))
                .background(Brand.MossSoft),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = categoryIcon(category?.slug),
                contentDescription = null,
                tint = Brand.categoryColor(category?.slug),
                modifier = Modifier.size(20.dp),
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = spot.name,
                style = MaterialTheme.typography.bodyLarge,
                color = Brand.Ink,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            if (category != null) {
                Text(
                    text = category.label,
                    style = MaterialTheme.typography.labelSmall,
                    color = Brand.Ink2,
                )
            }
        }
    }
}

@Composable
private fun HintState() {
    CenteredState {
        Icon(
            imageVector = Icons.Filled.Map,
            contentDescription = null,
            tint = Brand.MossSoft,
            modifier = Modifier.size(48.dp),
        )
        Spacer(Modifier.height(Dvh.s4))
        Text(
            text = "Typ minimaal 2 tekens",
            style = MaterialTheme.typography.titleMedium,
            color = Brand.Ink,
        )
        Spacer(Modifier.height(Dvh.s1))
        Text(
            text = "Zoek op naam van een plek, categorie of een adres.",
            style = MaterialTheme.typography.bodyMedium,
            color = Brand.Ink2,
        )
    }
}

@Composable
private fun LoadingState() {
    CenteredState {
        CircularProgressIndicator(color = Brand.Moss)
        Spacer(Modifier.height(Dvh.s3))
        Text("Zoeken...", style = MaterialTheme.typography.bodyMedium, color = Brand.Ink2)
    }
}

@Composable
private fun NoResultsState(query: String) {
    CenteredState {
        Icon(
            imageVector = Icons.Filled.Search,
            contentDescription = null,
            tint = Brand.MossSoft,
            modifier = Modifier.size(48.dp),
        )
        Spacer(Modifier.height(Dvh.s4))
        Text(
            text = "Geen resultaten",
            style = MaterialTheme.typography.titleMedium,
            color = Brand.Ink,
        )
        Spacer(Modifier.height(Dvh.s1))
        Text(
            text = "Niets gevonden voor '${query.trim()}'. Probeer een andere zoekterm.",
            style = MaterialTheme.typography.bodyMedium,
            color = Brand.Ink2,
        )
    }
}

@Composable
private fun CenteredState(content: @Composable () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = Dvh.s8),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            content()
        }
    }
}
