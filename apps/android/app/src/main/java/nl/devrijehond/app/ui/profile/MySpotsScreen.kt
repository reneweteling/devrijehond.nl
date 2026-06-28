package nl.devrijehond.app.ui.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import nl.devrijehond.app.AppGraph
import nl.devrijehond.app.api.models.SpotStatus
import nl.devrijehond.app.api.models.SpotSummary
import nl.devrijehond.app.ui.theme.Brand
import nl.devrijehond.app.ui.theme.Dvh

class MySpotsViewModel : ViewModel() {
    data class UiState(
        val loading: Boolean = true,
        val spots: List<SpotSummary> = emptyList(),
        val error: String? = null,
    )

    private val _state = MutableStateFlow(UiState())
    val state: StateFlow<UiState> = _state.asStateFlow()

    init {
        load()
    }

    fun load() {
        _state.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            try {
                val response = AppGraph.api.spots.apiV1MeSpotsGet()
                if (response.isSuccessful) {
                    _state.update { it.copy(loading = false, spots = response.body()?.items.orEmpty()) }
                } else {
                    _state.update { it.copy(loading = false, error = "Server gaf status ${response.code()}.") }
                }
            } catch (e: Exception) {
                _state.update { it.copy(loading = false, error = "Er is iets misgegaan.") }
            }
        }
    }
}

/** Lists the signed-in user's submitted spots. */
@Composable
fun MySpotsScreen(modifier: Modifier = Modifier) {
    val vm: MySpotsViewModel = viewModel()
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

            state.error != null -> Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(Dvh.s6),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Text(state.error!!, color = Brand.Rust)
                Button(
                    onClick = vm::load,
                    colors = ButtonDefaults.buttonColors(containerColor = Brand.Moss),
                    modifier = Modifier.padding(top = Dvh.s3),
                ) { Text("Opnieuw") }
            }

            state.spots.isEmpty() -> Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(Dvh.s6),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Text("Nog geen inzendingen", color = Brand.Ink, fontWeight = FontWeight.SemiBold)
                Text(
                    "Plekken die je toevoegt verschijnen hier.",
                    color = Brand.Ink2,
                    modifier = Modifier.padding(top = Dvh.s1),
                )
            }

            else -> LazyColumn(
                contentPadding = PaddingValues(Dvh.s4),
                verticalArrangement = Arrangement.spacedBy(Dvh.s3),
            ) {
                items(state.spots, key = { it.id.toString() }) { spot -> SpotRow(spot) }
            }
        }
    }
}

@Composable
private fun SpotRow(spot: SpotSummary) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(Dvh.rLg))
            .background(Brand.Cream)
            .padding(Dvh.s3),
    ) {
        val photo = spot.photoUrl?.toString()
        if (!photo.isNullOrBlank()) {
            AsyncImage(
                model = photo,
                contentDescription = spot.name,
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .size(48.dp)
                    .clip(RoundedCornerShape(Dvh.rSm))
                    .background(Brand.MossSoft),
            )
        } else {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .clip(RoundedCornerShape(Dvh.rSm))
                    .background(Brand.MossSoft),
            )
        }
        Spacer(Modifier.width(Dvh.s3))
        Column(modifier = Modifier.weight(1f)) {
            Text(spot.name, style = MaterialTheme.typography.bodyLarge, color = Brand.Ink, fontWeight = FontWeight.Medium)
            Spacer(Modifier.size(Dvh.s1))
            StatusBadge(spot.status)
        }
    }
}

@Composable
private fun StatusBadge(status: SpotStatus) {
    val (label, color) = when (status) {
        SpotStatus.VERIFIED -> "Geverifieerd" to Brand.Moss
        SpotStatus.UNVERIFIED -> "In afwachting" to Brand.Terra
        SpotStatus.HIDDEN -> "Verborgen" to Brand.Rust
        SpotStatus.REMOVED -> "Verwijderd" to Brand.Rust
    }
    Text(
        text = label,
        style = MaterialTheme.typography.labelSmall,
        color = color,
        modifier = Modifier
            .clip(CircleShape)
            .background(color.copy(alpha = 0.12f))
            .padding(horizontal = Dvh.s2, vertical = 3.dp),
    )
}
