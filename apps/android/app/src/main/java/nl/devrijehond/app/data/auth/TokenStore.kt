package nl.devrijehond.app.data.auth

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * Securely stores the BetterAuth bearer token in EncryptedSharedPreferences
 * (Android Keystore-backed). Equivalent of the iOS Keychain wrapper. Anonymous
 * until a token is set; clearing drops back to anonymous.
 */
class TokenStore(context: Context) {

    private val prefs: SharedPreferences = run {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            context,
            "nl.devrijehond.secure",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    var token: String?
        get() = prefs.getString(KEY_TOKEN, null)
        set(value) {
            prefs.edit().apply {
                if (value == null) remove(KEY_TOKEN) else putString(KEY_TOKEN, value)
            }.apply()
        }

    var expiresAt: String?
        get() = prefs.getString(KEY_EXPIRES, null)
        set(value) {
            prefs.edit().apply {
                if (value == null) remove(KEY_EXPIRES) else putString(KEY_EXPIRES, value)
            }.apply()
        }

    fun clear() {
        prefs.edit().remove(KEY_TOKEN).remove(KEY_EXPIRES).apply()
    }

    private companion object {
        const val KEY_TOKEN = "token"
        const val KEY_EXPIRES = "expiresAt"
    }
}
