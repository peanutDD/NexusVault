pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
plugins {
    id("org.gradle.toolchains.foojay-resolver-convention") version "1.0.0"
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "upload-download-native"

include(":app")
include(":core:common")
include(":core:domain")
include(":core:network")
include(":core:data")
include(":core:designsystem")
include(":core:database")
include(":core:storage")
include(":feature:auth")
include(":feature:files")
include(":feature:upload")
include(":feature:preview")
include(":feature:settings")
