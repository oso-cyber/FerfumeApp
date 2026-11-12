plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.jetbrains.kotlin.android)
    id("com.google.gms.google-services")
    id("io.gitlab.arturbosch.detekt") version "1.23.6"
}

android {
    namespace = "com.example.ferfume"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.example.ferfume"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }

    kotlinOptions {
        jvmTarget = "11"
    }

    buildFeatures {
        compose = true
        viewBinding = true
    }

    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.10"
    }
}

// ✅ Move detekt config OUTSIDE android { }
detekt {
    buildUponDefaultConfig = true
    allRules = false
    ignoreFailures = true // <--- THIS prevents build failure
}




dependencies {
    implementation(libs.androidx.appcompat)
    implementation(libs.material)
    implementation(libs.androidx.activity)
    implementation(libs.androidx.constraintlayout)
    // Add the Firebase BOM to manage versions
    implementation(platform("com.google.firebase:firebase-bom:33.0.0"))

    // Firebase Firestore (The BOM manages the version, so you can remove the ktx part if you want)
    implementation("com.google.firebase:firebase-firestore-ktx")

    // Firebase Storage (The BOM manages the version)
    implementation("com.google.firebase:firebase-storage-ktx")

    // For image handling
    implementation("com.squareup.picasso:picasso:2.71828")

        // Core
        implementation("androidx.core:core-ktx:1.13.1")
        implementation("androidx.appcompat:appcompat:1.6.1")
        implementation("com.google.android.material:material:1.11.0")
    implementation("com.google.android.flexbox:flexbox:3.0.0")
        // UI
        implementation("androidx.constraintlayout:constraintlayout:2.1.4")
        implementation("androidx.recyclerview:recyclerview:1.3.2")
        implementation("com.squareup.picasso:picasso:2.71828")
        implementation("com.github.bumptech.glide:glide:4.16.0")
    // Firebase Storage (The BOM manages the version)
    implementation("com.google.firebase:firebase-storage-ktx")
        // Jetpack
        implementation("androidx.activity:activity-ktx:1.9.0")
        implementation("androidx.lifecycle:lifecycle-livedata-ktx:2.7.0")
        implementation("androidx.lifecycle:lifecycle-viewmodel-ktx:2.7.0")
        implementation("androidx.navigation:navigation-fragment-ktx:2.7.7")
        implementation("androidx.navigation:navigation-ui-ktx:2.7.7")

        // Compose (manual versions)
        implementation("androidx.compose.ui:ui:1.5.4")
        implementation("androidx.compose.animation:animation:1.5.4")
        implementation("androidx.compose.ui:ui-tooling-preview:1.5.4")
        implementation("androidx.compose.material3:material3:1.1.0")
    implementation(libs.androidx.legacy.support.v4)
    implementation(libs.androidx.fragment.ktx) // Required by Paystack SDK
        debugImplementation("androidx.compose.ui:ui-tooling:1.5.4")

        // Firebase (manual versions)
        implementation("com.google.firebase:firebase-auth:22.3.0")
        implementation("com.google.firebase:firebase-firestore:25.0.0")

        // Google Services
        implementation("com.google.android.gms:play-services-auth:21.2.0")
        implementation("com.google.android.gms:play-services-maps:19.0.0")
        implementation("com.google.android.gms:play-services-location:21.0.1")
        implementation("com.google.android.gms:play-services-wallet:19.2.0")

        // Network & JSON
        implementation("com.squareup.retrofit2:retrofit:2.9.0")
        implementation("com.squareup.retrofit2:converter-gson:2.9.0")
        implementation("com.squareup.okhttp3:okhttp:4.12.0")
        implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")

        // Payments
        implementation("co.paystack.android:paystack:3.1.3")


        // Social Login
        implementation("com.facebook.android:facebook-login:16.3.0")

        // Tests
        testImplementation("junit:junit:4.13.2")
        androidTestImplementation("androidx.test.ext:junit:1.1.5")
        androidTestImplementation("androidx.test.espresso:espresso-core:3.5.1")


}
