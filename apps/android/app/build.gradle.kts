import com.github.triplet.gradle.androidpublisher.ReleaseStatus
import java.io.File
import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.play.publisher)
}

// Read the Google Maps key from local.properties (gitignored) or a -P gradle property.
// Mirrors NEXT_PUBLIC_GOOGLE_MAPS_API_KEY from the web .env.local. Empty string when
// absent so the build still works; the map tab then degrades to its list fallback.
val mapsApiKey: String = run {
    val fromProp = (project.findProperty("MAPS_API_KEY") as String?)?.takeIf { it.isNotBlank() }
    val fromLocal = rootProject.file("local.properties").takeIf { it.exists() }?.let { file ->
        Properties().apply { file.inputStream().use { load(it) } }.getProperty("MAPS_API_KEY")
    }?.takeIf { it.isNotBlank() }
    fromProp ?: fromLocal ?: ""
}

// Release signing. The upload keystore and its passwords live in keystore.properties
// (gitignored), never in the repo. When the file is absent (CI, a fresh clone, a debug
// build) the release build stays unsigned so non-publishing builds still work; uploading
// a bundle to Play requires the file to be present.
val keystoreProps: Properties? = rootProject.file("keystore.properties")
    .takeIf { it.exists() }
    ?.let { file -> Properties().apply { file.inputStream().use { load(it) } } }

android {
    namespace = "nl.devrijehond.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "nl.devrijehond.app"
        minSdk = 26
        targetSdk = 35
        // Versions live in gradle.properties so release-android.sh can bump the code.
        versionCode = (project.findProperty("VERSION_CODE") as String? ?: "1").toInt()
        versionName = project.findProperty("VERSION_NAME") as String? ?: "1.0.0"

        // Injected into AndroidManifest as com.google.android.geo.API_KEY.
        manifestPlaceholders["MAPS_API_KEY"] = mapsApiKey
    }

    signingConfigs {
        keystoreProps?.let { props ->
            create("release") {
                storeFile = rootProject.file(props.getProperty("storeFile"))
                storePassword = props.getProperty("storePassword")
                keyAlias = props.getProperty("keyAlias")
                keyPassword = props.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        debug {
            // The API is public; debug and release talk to the same production origin.
            // Base URL is a build-time constant, never a runtime env that could leak.
            buildConfigField("String", "API_BASE_URL", "\"https://api.devrijehond.nl/\"")
            buildConfigField("String", "MAPS_API_KEY", "\"$mapsApiKey\"")
        }
        release {
            // Only wire the signing config when the keystore is present, so a plain
            // `assembleRelease` on a machine without the key still configures.
            if (keystoreProps != null) {
                signingConfig = signingConfigs.getByName("release")
            }
            isMinifyEnabled = false
            buildConfigField("String", "API_BASE_URL", "\"https://api.devrijehond.nl/\"")
            buildConfigField("String", "MAPS_API_KEY", "\"$mapsApiKey\"")
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
            // Bundle native debug symbols so native crashes/ANRs (from Maps SDK and
            // other .so deps) symbolicate in Play. SYMBOL_TABLE keeps function names
            // at a modest size; use FULL to also get line numbers.
            ndk {
                debugSymbolLevel = "SYMBOL_TABLE"
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.core.splashscreen)

    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.ui)
    implementation(libs.androidx.ui.graphics)
    implementation(libs.androidx.ui.tooling.preview)
    implementation(libs.androidx.material3)
    implementation(libs.androidx.material.icons.extended)
    implementation(libs.androidx.navigation.compose)
    debugImplementation(libs.androidx.ui.tooling)

    // Secure token storage
    implementation(libs.androidx.security.crypto)

    // Networking (generated API client + hand-wired Retrofit/OkHttp)
    implementation(libs.retrofit)
    implementation(libs.retrofit.converter.kotlinx.serialization)
    implementation(libs.retrofit.converter.scalars)
    implementation(libs.okhttp)
    implementation(libs.okhttp.logging.interceptor)
    implementation(libs.kotlinx.serialization.json)

    // Remote images
    implementation(libs.coil.compose)

    // Auth: Credential Manager + Google ID token
    implementation(libs.androidx.credentials)
    implementation(libs.androidx.credentials.play.services.auth)
    implementation(libs.googleid)

    // Maps + location
    implementation(libs.maps.compose)
    implementation(libs.play.services.maps)
    implementation(libs.play.services.location)

    // Image cropping (add-spot, profile/dog photos)
    implementation(libs.android.image.cropper)
}

// Gradle Play Publisher: `./gradlew publishReleaseBundle` builds the signed AAB and
// uploads it to Google Play. The service-account JSON (publish rights, gitignored) is
// taken from PLAY_SERVICE_ACCOUNT_JSON, else secrets/play-service-account.json at the
// repo root, mirroring where the iOS release script keeps its App Store key. Absent
// credentials leave the tasks registered but failing, so normal builds are unaffected.
play {
    val credsFile: File = System.getenv("PLAY_SERVICE_ACCOUNT_JSON")?.let { File(it) }
        ?: rootProject.file("../../secrets/play-service-account.json")
    if (credsFile.exists()) {
        serviceAccountCredentials.set(credsFile)
    }
    track.set("internal")
    defaultToAppBundles.set(true)
    releaseStatus.set(ReleaseStatus.COMPLETED)
}
