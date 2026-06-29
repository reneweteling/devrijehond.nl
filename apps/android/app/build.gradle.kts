import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
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

android {
    namespace = "nl.devrijehond.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "nl.devrijehond.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"

        // Injected into AndroidManifest as com.google.android.geo.API_KEY.
        manifestPlaceholders["MAPS_API_KEY"] = mapsApiKey
    }

    buildTypes {
        debug {
            // The API is public; debug and release talk to the same production origin.
            // Base URL is a build-time constant, never a runtime env that could leak.
            buildConfigField("String", "API_BASE_URL", "\"https://api.devrijehond.nl/\"")
            buildConfigField("String", "MAPS_API_KEY", "\"$mapsApiKey\"")
        }
        release {
            isMinifyEnabled = false
            buildConfigField("String", "API_BASE_URL", "\"https://api.devrijehond.nl/\"")
            buildConfigField("String", "MAPS_API_KEY", "\"$mapsApiKey\"")
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
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
