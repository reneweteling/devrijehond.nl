package nl.devrijehond.app.ui.auth

import android.content.ActivityNotFoundException
import android.content.Intent
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.MailOutline
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import nl.devrijehond.app.AppGraph
import nl.devrijehond.app.R
import nl.devrijehond.app.ui.theme.Brand
import nl.devrijehond.app.ui.theme.Dvh

/**
 * Sign-in surface: native Google, Apple (binnenkort), and magic-link e-mail. Mirrors
 * the iOS SignInView. On a successful sign-in the bearer lands in the shared Session;
 * this screen observes that token and calls [onSignedIn] once it appears (covers both
 * the in-screen Google flow and a magic-link deep link redeemed elsewhere).
 *
 * @param onSignedIn invoked once after the Session becomes authenticated.
 * @param reason optional line explaining why sign-in is asked for right now.
 * @param onClose when non-null, shows a close affordance (use when presented as a
 *   gating sheet); null hides it (use as the signed-out Profile state).
 */
@Composable
fun SignInScreen(
    onSignedIn: () -> Unit,
    modifier: Modifier = Modifier,
    reason: String? = null,
    onClose: (() -> Unit)? = null,
    vm: SignInViewModel = viewModel(),
) {
    val state by vm.state.collectAsState()
    val token by AppGraph.session.token.collectAsState()
    val context = LocalContext.current

    LaunchedEffect(token) {
        if (token != null) onSignedIn()
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Brand.Sand),
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = Dvh.s5, vertical = Dvh.s8),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(Dvh.s5),
        ) {
            Hero(reason = reason)

            if (state.magicSent) {
                MagicSentCard(
                    email = state.sentTo,
                    onOpenMail = { openEmailApp(context) },
                    onAnotherEmail = vm::useAnotherEmail,
                )
            } else {
                DvhCard {
                    ProviderButtons(
                        working = state.working,
                        onApple = vm::signInWithApple,
                        onGoogle = { vm.signInWithGoogle(context) },
                    )
                    OrDivider()
                    MagicLinkForm(
                        email = state.email,
                        emailValid = state.emailValid,
                        working = state.working,
                        onEmailChange = vm::onEmailChange,
                        onSend = vm::sendMagicLink,
                    )
                }
            }

            state.error?.let { message ->
                Text(
                    text = message,
                    style = MaterialTheme.typography.bodyMedium,
                    color = Brand.Rust,
                    textAlign = TextAlign.Center,
                )
            }

            Text(
                text = "Door in te loggen ga je akkoord met onze voorwaarden en privacybeleid.",
                style = MaterialTheme.typography.labelSmall,
                color = Brand.Ink2,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(start = Dvh.s6, end = Dvh.s6, top = Dvh.s1),
            )
        }

        if (onClose != null) {
            IconButton(
                onClick = onClose,
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(Dvh.s4)
                    .clip(CircleShape)
                    .background(Brand.Cream),
            ) {
                Icon(Icons.Filled.Close, contentDescription = "Sluiten", tint = Brand.Ink2)
            }
        }
    }
}

private fun openEmailApp(context: android.content.Context) {
    val intent = Intent(Intent.ACTION_MAIN).apply {
        addCategory(Intent.CATEGORY_APP_EMAIL)
        flags = Intent.FLAG_ACTIVITY_NEW_TASK
    }
    try {
        context.startActivity(intent)
    } catch (e: ActivityNotFoundException) {
        // No e-mail app installed; leave the user on the card.
    }
}

@Composable
private fun Hero(reason: String?) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Dvh.s4),
        modifier = Modifier.padding(top = Dvh.s6),
    ) {
        Image(
            painter = painterResource(R.drawable.dvh_logo),
            contentDescription = "De Vrije Hond",
            modifier = Modifier.size(width = 180.dp, height = 150.dp),
        )
        Text(
            text = "Welkom",
            style = MaterialTheme.typography.displaySmall,
            color = Brand.Ink,
        )
        Text(
            text = reason
                ?: "Log in om plekken toe te voegen, te bevestigen en je honden te beheren.",
            style = MaterialTheme.typography.bodyLarge,
            color = Brand.Ink2,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(horizontal = Dvh.s4),
        )
    }
}

@Composable
private fun DvhCard(content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(Dvh.rLg))
            .background(Brand.Cream)
            .padding(Dvh.s5),
        verticalArrangement = Arrangement.spacedBy(Dvh.s4),
        content = content,
    )
}

@Composable
private fun ProviderButtons(
    working: Boolean,
    onApple: () -> Unit,
    onGoogle: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Dvh.s3)) {
        // Apple: shown for parity with iOS, but not yet available on Android.
        FilledTile(
            label = "Doorgaan met Apple",
            container = Color.Black,
            contentColor = Color.White,
            enabled = !working,
            onClick = onApple,
        )
        OutlinedTile(
            label = "Verder met Google",
            enabled = !working,
            onClick = onGoogle,
            leading = { GoogleGlyph() },
        )
    }
}

@Composable
private fun OrDivider() {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Dvh.s3),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Box(
            modifier = Modifier
                .weight(1f)
                .height(1.dp)
                .background(Brand.Ink2.copy(alpha = 0.2f)),
        )
        Text(
            text = "of met e-mail",
            style = MaterialTheme.typography.labelLarge,
            color = Brand.Ink2,
        )
        Box(
            modifier = Modifier
                .weight(1f)
                .height(1.dp)
                .background(Brand.Ink2.copy(alpha = 0.2f)),
        )
    }
}

@Composable
private fun MagicLinkForm(
    email: String,
    emailValid: Boolean,
    working: Boolean,
    onEmailChange: (String) -> Unit,
    onSend: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Dvh.s3)) {
        OutlinedTextField(
            value = email,
            onValueChange = onEmailChange,
            singleLine = true,
            placeholder = { Text("jij@email.nl", color = Brand.Ink2) },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(Dvh.rMd),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = Brand.Moss,
                unfocusedBorderColor = Brand.Ink2.copy(alpha = 0.3f),
                focusedTextColor = Brand.Ink,
                unfocusedTextColor = Brand.Ink,
                cursorColor = Brand.Moss,
                focusedContainerColor = Brand.Cream,
                unfocusedContainerColor = Brand.Cream,
            ),
        )
        PrimaryTile(
            label = "Stuur inloglink",
            enabled = emailValid && !working,
            working = working,
            onClick = onSend,
        )
    }
}

@Composable
private fun MagicSentCard(
    email: String,
    onOpenMail: () -> Unit,
    onAnotherEmail: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(Dvh.rLg))
            .background(Brand.Cream)
            .padding(Dvh.s6),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Dvh.s3),
    ) {
        Box(
            modifier = Modifier
                .size(76.dp)
                .clip(CircleShape)
                .background(Brand.MossSoft),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                Icons.Filled.MailOutline,
                contentDescription = null,
                tint = Brand.Moss,
                modifier = Modifier.size(32.dp),
            )
        }
        Text("Check je inbox", style = MaterialTheme.typography.titleLarge, color = Brand.Ink)
        Text(
            text = "We hebben een inloglink gestuurd naar $email. Open hem op deze telefoon, dan ben je ingelogd.",
            style = MaterialTheme.typography.bodyLarge,
            color = Brand.Ink2,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(Dvh.s1))
        PrimaryTile(label = "Open je e-mailapp", enabled = true, working = false, onClick = onOpenMail)
        TextButton(onClick = onAnotherEmail) {
            Text("Ander e-mailadres", color = Brand.Moss, fontWeight = FontWeight.SemiBold)
        }
    }
}

// MARK: - Brand-styled tiles (flat, matching the iOS DesignKit button styles)

@Composable
private fun PrimaryTile(
    label: String,
    enabled: Boolean,
    working: Boolean,
    onClick: () -> Unit,
) {
    val alpha = if (enabled) 1f else 0.5f
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(Dvh.controlHeight)
            .clip(RoundedCornerShape(Dvh.rMd))
            .background(Brand.Moss.copy(alpha = alpha))
            .clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Dvh.s2),
        ) {
            if (working) {
                CircularProgressIndicator(
                    color = Brand.Cream,
                    strokeWidth = 2.dp,
                    modifier = Modifier.size(18.dp),
                )
            }
            Text(label, color = Brand.Cream, style = MaterialTheme.typography.titleMedium)
        }
    }
}

@Composable
private fun FilledTile(
    label: String,
    container: Color,
    contentColor: Color,
    enabled: Boolean,
    onClick: () -> Unit,
    leading: @Composable (() -> Unit)? = null,
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(Dvh.controlHeight)
            .clip(RoundedCornerShape(Dvh.rMd))
            .background(container.copy(alpha = if (enabled) 1f else 0.5f))
            .clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Dvh.s2),
        ) {
            leading?.invoke()
            Text(label, color = contentColor, style = MaterialTheme.typography.titleMedium)
        }
    }
}

@Composable
private fun OutlinedTile(
    label: String,
    enabled: Boolean,
    onClick: () -> Unit,
    leading: @Composable (() -> Unit)? = null,
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(Dvh.controlHeight)
            .clip(RoundedCornerShape(Dvh.rMd))
            .background(Brand.Cream)
            .border(
                BorderStroke(1.dp, Brand.Ink2.copy(alpha = 0.3f)),
                RoundedCornerShape(Dvh.rMd),
            )
            .clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Dvh.s2),
        ) {
            leading?.invoke()
            Text(label, color = Brand.Ink, style = MaterialTheme.typography.titleMedium)
        }
    }
}

/** The real four-colour Google mark (vector), matching the iOS GoogleLogo asset. */
@Composable
private fun GoogleGlyph() {
    Image(
        painter = painterResource(R.drawable.ic_google),
        contentDescription = null,
        modifier = Modifier.size(20.dp),
    )
}
