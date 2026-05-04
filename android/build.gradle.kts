plugins {
    // Versions partagées – les modules Android utilisent les plugins via leur own Gradle build
    kotlin("jvm") version "1.9.24" apply false
    id("com.android.application") version "8.4.0" apply false
    id("com.android.library") version "8.4.0" apply false
    id("org.jetbrains.kotlin.android") version "1.9.24" apply false
}
