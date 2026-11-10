pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        maven { url = java.net.URI("https://jitpack.io") }
        // Nothing Glyph Developer Kit repository
        maven { url = java.net.URI("https://raw.githubusercontent.com/NothingTechnologies/Glyph-Developer-Kit/main/repository") }
    }
}

rootProject.name = "GlyphStudio"
include(":app")
