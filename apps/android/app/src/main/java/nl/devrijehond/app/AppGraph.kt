package nl.devrijehond.app

import android.content.Context
import nl.devrijehond.app.data.Session
import nl.devrijehond.app.data.auth.TokenStore
import nl.devrijehond.app.data.network.ApiModule

/**
 * Tiny manual dependency graph (no DI framework yet). Holds the app-wide
 * singletons: secure token store, session, and the generated API client wired to
 * the live backend. Initialized once from [DvhApp.onCreate].
 */
object AppGraph {
    lateinit var tokens: TokenStore
        private set
    lateinit var session: Session
        private set
    lateinit var api: ApiModule
        private set

    fun init(context: Context) {
        if (::api.isInitialized) return
        tokens = TokenStore(context.applicationContext)
        session = Session(tokens)
        api = ApiModule(tokenProvider = session::currentToken)
    }
}
