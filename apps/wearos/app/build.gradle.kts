plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "com.harlemmight.watch"
    // Wear Compose 1.7.x AAR metadata requires API 37; validate on SDK host.
    compileSdk = 37
    defaultConfig {
        // Data Layer enforces identical application ID and signing on phone/watch.
        applicationId = "com.harlemmight.app"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"
        val endpoint = providers.gradleProperty("HARLEM_WIDGET_FEED_URL").orNull ?: ""
        buildConfigField("String", "WIDGET_FEED_URL", "\"$endpoint\"")
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
    sourceSets["main"].java.srcDir("../../mobile/modules/walk-companion/shared/android")
}

dependencies {
    implementation("com.google.android.gms:play-services-wearable:20.0.1")
    val composeBom = platform("androidx.compose:compose-bom:2026.09.00")
    implementation(composeBom)
    implementation("androidx.activity:activity-compose:1.13.0")
    implementation("androidx.wear.compose:compose-material3:1.7.1")
    implementation("androidx.wear.compose:compose-foundation:1.7.1")
    implementation("androidx.compose.ui:ui-tooling-preview")
}
