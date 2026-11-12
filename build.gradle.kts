
plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.jetbrains.kotlin.android) apply false
    id("io.gitlab.arturbosch.detekt") version "1.23.6" apply false
    id("org.owasp.dependencycheck") version "9.2.0"
}

buildscript {
    repositories {

    }
    dependencies {
        classpath("com.android.tools.build:gradle:8.8.0") // Ensure this is the correct version
        classpath("com.google.gms:google-services:4.4.2") // Google Services plugin (if needed)
    }
}

allprojects {
    repositories {


        // Ensure all sub-projects can access JitPack
    }
}
tasks.register<Delete>("clean") {
    delete(rootProject.buildDir)
}




