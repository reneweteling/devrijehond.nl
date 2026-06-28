package nl.devrijehond.app.ui.wensen

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.launch
import nl.devrijehond.app.AppGraph
import nl.devrijehond.app.api.models.FeatureRequest
import nl.devrijehond.app.api.models.FeatureStatus
import nl.devrijehond.app.ui.theme.Brand
import nl.devrijehond.app.ui.theme.Dvh

/**
 * Wensen tab: community feature requests. Anyone can browse and filter; voting and
 * submitting require sign-in (handled via [onRequireSignIn]). Mirrors the iOS
 * WensenScreen.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WensenScreen(
    onRequireSignIn: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val vm: WensenViewModel = viewModel()
    val state by vm.state.collectAsState()
    val token by AppGraph.session.token.collectAsState()
    val isAuthenticated = token != null

    var showNew by remember { mutableStateOf(false) }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val scope = rememberCoroutineScope()

    Scaffold(
        modifier = modifier,
        containerColor = Brand.Sand,
        floatingActionButton = {
            FloatingActionButton(
                onClick = { if (isAuthenticated) showNew = true else onRequireSignIn() },
                containerColor = Brand.Moss,
                contentColor = Color.White,
            ) {
                Icon(Icons.Filled.Add, contentDescription = "Idee indienen")
            }
        },
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding),
        ) {
            Text(
                text = "Wensen",
                style = MaterialTheme.typography.displaySmall,
                color = Brand.Ink,
                modifier = Modifier.padding(start = Dvh.s4, top = Dvh.s4),
            )
            Text(
                text = "Stem op ideeën of dien er zelf een in.",
                style = MaterialTheme.typography.bodyMedium,
                color = Brand.Ink2,
                modifier = Modifier.padding(start = Dvh.s4, top = Dvh.s1, bottom = Dvh.s3),
            )

            FilterRow(selected = state.filter, onSelect = vm::selectFilter)

            when {
                state.loading && state.requests.isEmpty() -> CenterBox {
                    CircularProgressIndicator(color = Brand.Moss)
                }

                state.error != null && state.requests.isEmpty() -> CenterBox {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(state.error!!, color = Brand.Rust)
                        Button(
                            onClick = vm::load,
                            modifier = Modifier.padding(top = Dvh.s3),
                            colors = ButtonDefaults.buttonColors(containerColor = Brand.Moss),
                        ) { Text("Opnieuw") }
                    }
                }

                state.requests.isEmpty() -> CenterBox {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("Nog geen wensen", color = Brand.Ink, fontWeight = FontWeight.SemiBold)
                        Text(
                            "Wees de eerste die een idee indient.",
                            color = Brand.Ink2,
                            modifier = Modifier.padding(top = Dvh.s1),
                        )
                    }
                }

                else -> LazyColumn(
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(
                        start = Dvh.s4,
                        end = Dvh.s4,
                        top = Dvh.s3,
                        bottom = 96.dp,
                    ),
                    verticalArrangement = Arrangement.spacedBy(Dvh.s3),
                ) {
                    items(state.requests, key = { it.id.toString() }) { req ->
                        WishCard(
                            request = req,
                            voting = state.votingIds.contains(req.id.toString()),
                            onUpvote = {
                                if (isAuthenticated) vm.toggleVote(req) else onRequireSignIn()
                            },
                        )
                    }
                }
            }
        }
    }

    if (showNew) {
        ModalBottomSheet(
            onDismissRequest = { showNew = false },
            sheetState = sheetState,
            containerColor = Brand.Cream,
        ) {
            NewWishSheet(
                onSubmit = { title, body, component, onResult ->
                    vm.create(title, body, component) { error ->
                        if (error == null) {
                            scope.launch {
                                sheetState.hide()
                                showNew = false
                            }
                        }
                        onResult(error)
                    }
                },
            )
        }
    }
}

@Composable
private fun FilterRow(
    selected: FeatureStatus?,
    onSelect: (FeatureStatus?) -> Unit,
) {
    val options: List<Pair<FeatureStatus?, String>> = listOf(
        null to "Populair",
        FeatureStatus.CONSIDERING to "In overweging",
        FeatureStatus.PLANNED to "Gepland",
        FeatureStatus.DONE to "Klaar",
        FeatureStatus.DECLINED to "Afgewezen",
    )
    LazyRow(
        contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = Dvh.s4),
        horizontalArrangement = Arrangement.spacedBy(Dvh.s2),
    ) {
        items(options) { (status, label) ->
            val isSelected = status == selected
            Text(
                text = label,
                style = MaterialTheme.typography.labelLarge,
                color = if (isSelected) Color.White else Brand.Ink2,
                modifier = Modifier
                    .clip(CircleShape)
                    .background(if (isSelected) Brand.Moss else Brand.MossSoft)
                    .clickable { onSelect(status) }
                    .padding(horizontal = Dvh.s3, vertical = Dvh.s2),
            )
        }
    }
}

@Composable
private fun WishCard(
    request: FeatureRequest,
    voting: Boolean,
    onUpvote: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(Dvh.rLg))
            .background(Brand.Cream)
            .padding(Dvh.s4),
        horizontalArrangement = Arrangement.spacedBy(Dvh.s3),
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                request.title,
                style = MaterialTheme.typography.titleMedium,
                color = Brand.Ink,
            )
            if (!request.body.isNullOrBlank()) {
                Text(
                    request.body!!,
                    style = MaterialTheme.typography.bodyMedium,
                    color = Brand.Ink2,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = Dvh.s1),
                )
            }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Dvh.s2),
                modifier = Modifier.padding(top = Dvh.s2),
            ) {
                StatusPill(request.status)
                if (!request.component.isNullOrBlank()) {
                    Text(
                        request.component!!,
                        style = MaterialTheme.typography.labelSmall,
                        color = Brand.MossDark,
                        modifier = Modifier
                            .clip(CircleShape)
                            .background(Brand.MossSoft)
                            .padding(horizontal = Dvh.s2, vertical = 3.dp),
                    )
                }
            }
        }

        UpvoteButton(
            count = request.upvoteCount,
            active = request.viewerHasVoted,
            voting = voting,
            onClick = onUpvote,
        )
    }
}

@Composable
private fun UpvoteButton(
    count: Int,
    active: Boolean,
    voting: Boolean,
    onClick: () -> Unit,
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .clip(RoundedCornerShape(Dvh.rMd))
            .background(if (active) Brand.MossSoft else Color.Transparent)
            .border(
                width = 1.dp,
                color = if (active) Brand.Moss else Brand.Ink2.copy(alpha = 0.25f),
                shape = RoundedCornerShape(Dvh.rMd),
            )
            .clickable(enabled = !voting) { onClick() }
            .padding(horizontal = Dvh.s3, vertical = Dvh.s2),
    ) {
        if (voting) {
            CircularProgressIndicator(
                color = Brand.Moss,
                strokeWidth = 2.dp,
                modifier = Modifier.size(20.dp),
            )
        } else {
            Icon(
                Icons.Filled.KeyboardArrowUp,
                contentDescription = "Upvote",
                tint = if (active) Brand.Moss else Brand.Ink2,
                modifier = Modifier.size(22.dp),
            )
        }
        Text(
            "$count",
            style = MaterialTheme.typography.labelLarge,
            color = if (active) Brand.MossDark else Brand.Ink2,
        )
    }
}

@Composable
private fun StatusPill(status: FeatureStatus) {
    val (label, color) = when (status) {
        FeatureStatus.CONSIDERING -> "In overweging" to Brand.Terra
        FeatureStatus.PLANNED -> "Gepland" to Brand.Moss
        FeatureStatus.DONE -> "Klaar" to Brand.MossDark
        FeatureStatus.DECLINED -> "Afgewezen" to Brand.Rust
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

@Composable
private fun NewWishSheet(
    onSubmit: (title: String, body: String?, component: String?, onResult: (String?) -> Unit) -> Unit,
) {
    var title by remember { mutableStateOf("") }
    var body by remember { mutableStateOf("") }
    var component by remember { mutableStateOf<String?>(null) }
    var submitting by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    val components = listOf("Kaart", "Inzenden", "Profiel", "Anders")
    val canSubmit = title.trim().length >= 3 && !submitting

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = Dvh.s4)
            .padding(bottom = Dvh.s6),
        verticalArrangement = Arrangement.spacedBy(Dvh.s3),
    ) {
        Text(
            "Nieuwe wens",
            style = MaterialTheme.typography.titleLarge,
            color = Brand.Ink,
        )

        val fieldColors = TextFieldDefaults.colors(
            focusedContainerColor = Brand.Sand,
            unfocusedContainerColor = Brand.Sand,
            focusedIndicatorColor = Brand.Moss,
            unfocusedIndicatorColor = Brand.Ink2.copy(alpha = 0.25f),
            cursorColor = Brand.Moss,
        )

        OutlinedTextField(
            value = title,
            onValueChange = { if (it.length <= 120) title = it },
            label = { Text("Titel") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Next),
            modifier = Modifier.fillMaxWidth(),
            colors = fieldColors,
        )

        OutlinedTextField(
            value = body,
            onValueChange = { if (it.length <= 1000) body = it },
            label = { Text("Omschrijving (optioneel)") },
            minLines = 3,
            modifier = Modifier.fillMaxWidth(),
            colors = fieldColors,
        )

        Text("Onderdeel", style = MaterialTheme.typography.labelLarge, color = Brand.Ink2)
        LazyRow(horizontalArrangement = Arrangement.spacedBy(Dvh.s2)) {
            items(components) { c ->
                val isSelected = component == c
                Text(
                    text = c,
                    style = MaterialTheme.typography.labelLarge,
                    color = if (isSelected) Color.White else Brand.Ink2,
                    modifier = Modifier
                        .clip(CircleShape)
                        .background(if (isSelected) Brand.Moss else Brand.MossSoft)
                        .clickable { component = if (isSelected) null else c }
                        .padding(horizontal = Dvh.s3, vertical = Dvh.s2),
                )
            }
        }

        if (error != null) {
            Text(error!!, color = Brand.Rust, style = MaterialTheme.typography.bodyMedium)
        }

        Button(
            onClick = {
                submitting = true
                error = null
                onSubmit(title, body, component) { err ->
                    submitting = false
                    error = err
                }
            },
            enabled = canSubmit,
            colors = ButtonDefaults.buttonColors(containerColor = Brand.Moss),
            modifier = Modifier
                .fillMaxWidth()
                .height(Dvh.controlHeight),
        ) {
            if (submitting) {
                CircularProgressIndicator(
                    color = Color.White,
                    strokeWidth = 2.dp,
                    modifier = Modifier.size(20.dp),
                )
                Spacer(Modifier.width(Dvh.s2))
            }
            Text("Wens indienen")
        }
    }
}

@Composable
private fun CenterBox(content: @Composable () -> Unit) {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { content() }
}
