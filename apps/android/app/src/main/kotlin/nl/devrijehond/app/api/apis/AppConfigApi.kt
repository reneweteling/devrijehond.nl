package nl.devrijehond.app.api.apis

import nl.devrijehond.app.api.infrastructure.CollectionFormats.*
import retrofit2.http.*
import retrofit2.Response
import okhttp3.RequestBody
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

import nl.devrijehond.app.api.models.AppConfig

interface AppConfigApi {
    /**
     * GET api/v1/app-config
     * Runtime app config (force-update flow)
     * 
     * Responses:
     *  - 200: Mobile runtime configuration.
     *
     * @return [AppConfig]
     */
    @GET("api/v1/app-config")
    suspend fun apiV1AppConfigGet(): Response<AppConfig>

}
