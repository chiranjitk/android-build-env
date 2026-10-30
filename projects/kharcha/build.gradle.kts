// Root build file — Kharcha (Bangla expense tracker)
buildscript {
    repositories {
        maven { url = uri("https://maven-central.storage-download.googleapis.com/maven2") }
        google()
        mavenCentral()
    }
    dependencies {
        classpath("com.android.tools.build:gradle:9.2.1")
        // AGP 9 requires KGP at runtime even for java-only projects
        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:2.4.10")
    }
}
