package nl.devrijehond.app

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch
import nl.devrijehond.app.data.auth.AuthRepository
import nl.devrijehond.app.ui.AppShell
import nl.devrijehond.app.ui.theme.DeVrijeHondTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        // Cold start: the launching intent may carry a magic-link uri.
        handleDeepLink(intent?.data)
        setContent {
            DeVrijeHondTheme {
                AppShell()
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
