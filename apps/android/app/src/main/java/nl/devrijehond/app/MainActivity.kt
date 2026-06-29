package nl.devrijehond.app

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeOut
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import nl.devrijehond.app.data.auth.AuthRepository
import nl.devrijehond.app.ui.AppShell
import nl.devrijehond.app.ui.SplashScreen
import nl.devrijehond.app.ui.theme.DeVrijeHondTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        // Android-12 system splash: holds the sand ground (no masked icon) until Compose
        // draws, then we cross-fade from the custom splash to the app shell.
        installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        // Cold start: the launching intent may carry a magic-link uri.
        handleDeepLink(intent?.data)
        setContent {
            DeVrijeHondTheme {
                var showSplash by remember { mutableStateOf(true) }
                LaunchedEffect(Unit) {
                    delay(900)
                    showSplash = false
                }
                Box(Modifier.fillMaxSize()) {
                    AppShell()
                    AnimatedVisibility(
                        visible = showSplash,
                        exit = fadeOut(animationSpec = tween(durationMillis = 350)),
                    ) {
                        SplashScreen()
                    }
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        // singleTask: a magic-link tap while the app is alive arrives here.
        setIntent(intent)
        handleDeepLink(intent.data)
    }

    private fun handleDeepLink(uri: Uri?) {
        val data = uri ?: return
        lifecycleScope.launch {
            // Returns null when the uri is not a magic link, which we ignore.
            AuthRepository().handleMagicLinkUri(data)
        }
    }
}
