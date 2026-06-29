package nl.devrijehond.app.ui.auth

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import nl.devrijehond.app.data.auth.AuthRepository

/**
 * Drives [SignInScreen]. Holds the form state and runs the three flows through
 * [AuthRepository], which stores the bearer via the shared Session on success. The
 * screen observes the Session token to know when to call its onSignedIn callback, so
 * this ViewModel only owns the in-progress UI state (working / error / magicSent).
 */
class SignInViewModel(
    private val repo: AuthRepository = AuthRepository(),
) : ViewModel() {

    data class State(
        val email: String = "",
        val working: Boolean = false,
        val magicSent: Boolean = false,
        val sentTo: String = "",
        val error: String? = null,
    ) {
        val emailValid: Boolean
            get() = email.trim().let { it.contains("@") && it.contains(".") && it.length >= 5 }
    }

    private val _state = MutableStateFlow(State())
    val state: StateFlow<State> = _state.asStateFlow()

    fun onEmailChange(value: String) {
        _state.update { it.copy(email = value, error = null) }
    }

    fun sendMagicLink() {
        val address = _state.value.email.trim()
        if (!_state.value.emailValid || _state.value.working) return
        _state.update { it.copy(working = true, error = null) }
        viewModelScope.launch {
            when (val result = repo.requestMagicLink(address)) {
                is AuthRepository.AuthResult.Success ->
                    _state.update { it.copy(working = false, magicSent = true, sentTo = address) }
                is AuthRepository.AuthResult.Error ->
                    _state.update { it.copy(working = false, error = result.message) }
                AuthRepository.AuthResult.Cancelled ->
                    _state.update { it.copy(working = false) }
            }
        }
    }

    fun signInWithGoogle(context: Context) {
        if (_state.value.working) return
        _state.update { it.copy(working = true, error = null) }
        viewModelScope.launch {
            // On Success the repo stores the bearer via Session; the screen reacts to
            // the token change and calls onSignedIn, so nothing else to do here.
            when (val result = repo.signInWithGoogle(context)) {
                is AuthRepository.AuthResult.Success ->
                    _state.update { it.copy(working = false) }
                AuthRepository.AuthResult.Cancelled ->
                    _state.update { it.copy(working = false) }
                is AuthRepository.AuthResult.Error ->
                    _state.update { it.copy(working = false, error = result.message) }
            }
        }
    }

    fun useAnotherEmail() {
        _state.update { it.copy(magicSent = false, error = null) }
    }
}
