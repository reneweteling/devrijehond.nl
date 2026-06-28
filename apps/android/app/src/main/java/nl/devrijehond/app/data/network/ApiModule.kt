package nl.devrijehond.app.data.network

import nl.devrijehond.app.BuildConfig
import nl.devrijehond.app.api.apis.AmenitiesApi
import nl.devrijehond.app.api.apis.AppConfigApi
import nl.devrijehond.app.api.apis.CategoriesApi
import nl.devrijehond.app.api.apis.DogsApi
import nl.devrijehond.app.api.apis.FeatureRequestsApi
import nl.devrijehond.app.api.apis.GeocodeApi
import nl.devrijehond.app.api.apis.MeApi
import nl.devrijehond.app.api.apis.ModeratorApi
import nl.devrijehond.app.api.apis.ReportsApi
import nl.devrijehond.app.api.apis.ReviewsApi
import nl.devrijehond.app.api.apis.SpotsApi
import nl.devrijehond.app.api.apis.UploadsApi
import nl.devrijehond.app.api.apis.VotesApi
import nl.devrijehond.app.api.infrastructure.Serializer
import nl.devrijehond.app.api.models.FeatureStatus
import nl.devrijehond.app.api.models.ModeratorApplicationStatus
import nl.devrijehond.app.api.models.ReportReason
import nl.devrijehond.app.api.models.ReportTarget
import nl.devrijehond.app.api.models.SpotStatus
import nl.devrijehond.app.api.models.SpotType
import nl.devrijehond.app.api.models.UserRole
import nl.devrijehond.app.api.models.VoteValue
import kotlinx.serialization.KSerializer
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.JsonElement
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import retrofit2.converter.scalars.ScalarsConverterFactory
import java.util.concurrent.TimeUnit

/**
 * Wires the generated Retrofit API client. Bearer-only transport (no CookieJar,
 * see spec section 6.7): the default OkHttpClient keeps no cookies, so a BetterAuth
 * Set-Cookie is never replayed. Base URL is the build-time constant
 * BuildConfig.API_BASE_URL, never a runtime env that could leak a dev host.
 *
 * The generated models annotate enum-typed properties with @Contextual, so we must
 * register a contextual serializer for each top-level enum before the Json instance
 * is first touched. Otherwise deserialization (e.g. Category.type) throws.
 */
/**
 * Treats a `@Contextual Any` property (the GeoJSON `coordinates` array) as an opaque
 * [JsonElement]. We only ever read these fields (region polygons for the map), so the
 * encode path is here for completeness.
 */
private object AnyJsonSerializer : KSerializer<Any> {
    private val delegate = JsonElement.serializer()
    override val descriptor: SerialDescriptor = delegate.descriptor
    override fun deserialize(decoder: Decoder): Any = delegate.deserialize(decoder)
    override fun serialize(encoder: Encoder, value: Any) {
        delegate.serialize(encoder, value as JsonElement)
    }
}

class ApiModule(tokenProvider: () -> String?) {

    init {
        Serializer.kotlinxSerializationAdaptersConfiguration = {
            contextual(SpotType::class, SpotType.serializer())
            contextual(SpotStatus::class, SpotStatus.serializer())
            contextual(UserRole::class, UserRole.serializer())
            contextual(VoteValue::class, VoteValue.serializer())
            contextual(ReportReason::class, ReportReason.serializer())
            contextual(ReportTarget::class, ReportTarget.serializer())
            contextual(FeatureStatus::class, FeatureStatus.serializer())
            contextual(ModeratorApplicationStatus::class, ModeratorApplicationStatus.serializer())
            // Geometry `coordinates` is generated as `@Contextual kotlin.Any?` (the OpenAPI
            // GeoJSON coordinates are an untyped nested array). Decode it as a raw JsonElement
            // so SpotDetail / SpotGeometry deserialize instead of throwing "Serializer for
            // class 'Any' is not found".
            contextual(Any::class, AnyJsonSerializer)
        }
    }

    private val json = Serializer.kotlinxSerializationJson

    private val okHttp: OkHttpClient = OkHttpClient.Builder()
        // No cookieJar on purpose: bearer-only transport.
        .addInterceptor(AuthInterceptor(tokenProvider))
        .addInterceptor(
            HttpLoggingInterceptor().apply {
                level = if (BuildConfig.DEBUG) {
                    HttpLoggingInterceptor.Level.BASIC
                } else {
                    HttpLoggingInterceptor.Level.NONE
                }
            },
        )
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build()

    private val retrofit: Retrofit = Retrofit.Builder()
        .baseUrl(BuildConfig.API_BASE_URL)
        .client(okHttp)
        .addConverterFactory(ScalarsConverterFactory.create())
        .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
        .build()

    val categories: CategoriesApi by lazy { retrofit.create(CategoriesApi::class.java) }
    val amenities: AmenitiesApi by lazy { retrofit.create(AmenitiesApi::class.java) }
    val spots: SpotsApi by lazy { retrofit.create(SpotsApi::class.java) }
    val me: MeApi by lazy { retrofit.create(MeApi::class.java) }
    val featureRequests: FeatureRequestsApi by lazy { retrofit.create(FeatureRequestsApi::class.java) }
    val votes: VotesApi by lazy { retrofit.create(VotesApi::class.java) }
    val reviews: ReviewsApi by lazy { retrofit.create(ReviewsApi::class.java) }
    val reports: ReportsApi by lazy { retrofit.create(ReportsApi::class.java) }
    val uploads: UploadsApi by lazy { retrofit.create(UploadsApi::class.java) }
    val dogs: DogsApi by lazy { retrofit.create(DogsApi::class.java) }
    val moderator: ModeratorApi by lazy { retrofit.create(ModeratorApi::class.java) }
    val geocode: GeocodeApi by lazy { retrofit.create(GeocodeApi::class.java) }
    val appConfig: AppConfigApi by lazy { retrofit.create(AppConfigApi::class.java) }
}
